import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

export type RemoteService = 'bookings' | 'payments';

@Injectable()
export class ServiceCaller {
  private readonly bases: Record<RemoteService, string>;
  private readonly timeout: number;

  constructor(config: ConfigService) {
    this.bases = {
      bookings: config.get<string>('BOOKINGS_SERVICE_URL') || 'http://localhost:3002/api/v1',
      payments: config.get<string>('PAYMENTS_SERVICE_URL') || 'http://localhost:3001/api/v1',
    };
    for (const [service, base] of Object.entries(this.bases)) {
      const url = new URL(base);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error(`Invalid ${service} service URL`);
      }
    }
    this.timeout = Number(config.get('SERVICE_HTTP_TIMEOUT_MS') ?? 20000);
    if (!Number.isInteger(this.timeout) || this.timeout < 1 || this.timeout > 120000) {
      throw new Error('SERVICE_HTTP_TIMEOUT_MS must be between 1 and 120000');
    }
  }

  async forward(
    service: RemoteService,
    method: 'GET' | 'POST' | 'PATCH',
    segments: string[],
    req: Request,
    res: Response,
    body?: unknown,
    query?: object,
  ): Promise<unknown> {
    if (segments.some((segment) => segment === '.' || segment === '..')) {
      throw new BadRequestException('Invalid resource identifier');
    }
    const url = new URL(
      `${this.bases[service].replace(/\/+$/, '')}/${segments.map(encodeURIComponent).join('/')}`,
    );
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    for (const name of ['authorization', 'idempotency-key', 'x-correlation-id']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    const correlationId = res.getHeader('x-correlation-id');
    if (typeof correlationId === 'string') headers['x-correlation-id'] = correlationId;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const signal = AbortSignal.timeout(this.timeout);
    try {
      // Never retry mutations automatically: a timeout can occur after the remote commit.
      const upstream = await fetch(url, {
        method,
        headers,
        signal,
        redirect: 'manual',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (upstream.status >= 300 && upstream.status < 400) throw new Error('Unexpected redirect');
      const payload: unknown = await upstream.json();
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('success' in payload) ||
        typeof payload.success !== 'boolean'
      ) {
        throw new Error('Invalid service response');
      }
      res.status(upstream.status);
      const retryAfter = upstream.headers.get('retry-after');
      if (retryAfter) res.setHeader('retry-after', retryAfter);
      return payload;
    } catch {
      if (signal.aborted) throw new GatewayTimeoutException(`${service} service timed out`);
      throw new BadGatewayException(
        `${service} service unavailable or returned an invalid response`,
      );
    }
  }
}
