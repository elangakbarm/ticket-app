import { Prisma } from '@prisma/client';

export function maskIdentityNumber(value: string): string {
  if (!value || value.length <= 4) {
    return '****';
  }
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}

export function generateBookingCode(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, '0');
  return `BK-${dateStr}-${random}`;
}

export function generatePaymentReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

export function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TKT-${timestamp}-${random}`;
}

export function generateQrCodeValue(): string {
  const uuid = crypto.randomUUID();
  return `QR-${uuid}`;
}

export function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

export function sanitizeUser<T extends Record<string, unknown>>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _, ...rest } = user as T & { passwordHash?: string };
  return rest;
}
