import { SeatsService } from './seats.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TrainClass } from '../../common/enums';

describe('seat generation', () => {
  const dto = { carriages: 5, seatsPerCarriage: 20, seatClass: TrainClass.ECONOMY };
  let service: SeatsService;
  let rows: any[];
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    rows = [];
    tx = {
      seat: {
        createManyAndReturn: jest.fn(async ({ data, skipDuplicates }) => {
          const created: any[] = [];
          for (const seat of data) {
            const existing = rows.find(
              (row) =>
                row.trainId === seat.trainId &&
                row.carriageNumber === seat.carriageNumber &&
                row.seatNumber === seat.seatNumber,
            );
            if (existing) {
              if (!skipDuplicates) throw new Error('Unique constraint failed');
              continue;
            }
            const row = {
              ...seat,
              id: rows.length + 1,
              publicId: `seat-${rows.length + 1}`,
              isActive: true,
            };
            rows.push(row);
            created.push(row);
          }
          return created.reverse();
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      train: { findFirst: jest.fn().mockResolvedValue({ id: 7 }) },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    service = new SeatsService(prisma as PrismaService, {} as AuditLogService);
  });

  it('creates the requested 100 seats, returns natural order, and records counts', async () => {
    const result = await service.generateSeats('train', dto, 1);
    expect(result.meta).toEqual({ requested: 100, created: 100, skipped: 0 });
    expect(result.data[0].seatNumber).toBe('A1');
    expect(result.data[1].seatNumber).toBe('A2');
    expect(result.data[99].seatNumber).toBe('E20');
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 1, newData: result.meta }),
    });
  });

  it('repeated generation succeeds without changing existing seats', async () => {
    await service.generateSeats('train', dto, 1);
    const original = JSON.stringify(rows);
    const result = await service.generateSeats('train', dto, 1);
    expect(result.meta).toEqual({ requested: 100, created: 0, skipped: 100 });
    expect(result.data).toEqual([]);
    expect(JSON.stringify(rows)).toBe(original);
  });

  it('fills gaps while preserving inactive seats, classes, and IDs', async () => {
    const existing = {
      id: 123,
      publicId: 'booked-seat',
      trainId: 7,
      carriageNumber: 1,
      seatNumber: 'A1',
      seatClass: TrainClass.EXECUTIVE,
      isActive: false,
    };
    rows.push({ ...existing });
    const result = await service.generateSeats('train', dto, 1);
    expect(result.meta).toEqual({ requested: 100, created: 99, skipped: 1 });
    expect(rows[0]).toEqual(existing);
    expect(rows).toHaveLength(100);
  });

  it('does not treat another train seat as a duplicate', async () => {
    rows.push({ trainId: 8, carriageNumber: 1, seatNumber: 'A1' });
    const result = await service.generateSeats('train', dto, 1);
    expect(result.meta.created).toBe(100);
  });

  it('fails before writing when the train is absent', async () => {
    prisma.train.findFirst.mockResolvedValue(null);
    await expect(service.generateSeats('missing', dto, 1)).rejects.toThrow('Train not found');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates database failures rather than claiming duplicates were skipped', async () => {
    tx.seat.createManyAndReturn.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.generateSeats('train', dto, 1)).rejects.toThrow('Database unavailable');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
