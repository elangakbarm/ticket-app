import { JourneyCompletionService } from './journey-completion.service';

describe('Journey completion', () => {
  it('reconciles elapsed schedules and only paid/confirmed bookings atomically', async () => {
    const tx = {
      schedule: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };
    const prisma = { $transaction: jest.fn((work) => work(tx)) };
    const service = new JourneyCompletionService(prisma as any);
    await service.onApplicationBootstrap();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.schedule.updateMany).toHaveBeenCalledWith({
      where: { deletedAt: null, arrivalTime: { lte: expect.any(Date) },
        status: { in: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED'] } },
      data: { status: 'ARRIVED' },
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { status: { in: ['PAID', 'CONFIRMED'] },
        schedule: { deletedAt: null, status: 'ARRIVED' } },
      data: { status: 'COMPLETED' },
    });
    await service.completeJourneys();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
