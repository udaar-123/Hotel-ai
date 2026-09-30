import { prisma } from "@/lib/prisma";

export const ReportsService = {
  async getOccupancy(hotelId: string, startDate: Date, endDate: Date) {
    const totalRooms = await prisma.rooms.count({ where: { hotelId } });
    if (totalRooms === 0) return { rate: 0, totalRooms: 0, bookedNights: 0 };

    // Find all bookings overlapping with this date range
    const bookings = await prisma.bookings.findMany({
      where: {
        hotelId,
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkInDate: { lte: endDate },
        checkOutDate: { gte: startDate }
      },
      select: { checkInDate: true, checkOutDate: true }
    });

    const totalPossibleNights = totalRooms * (Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    let bookedNights = 0;
    for (const b of bookings) {
      const overlapStart = new Date(Math.max(b.checkInDate.getTime(), startDate.getTime()));
      const overlapEnd = new Date(Math.min(b.checkOutDate.getTime(), endDate.getTime()));
      if (overlapEnd > overlapStart) {
        bookedNights += (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24);
      }
    }

    const rate = totalPossibleNights > 0 ? (bookedNights / totalPossibleNights) * 100 : 0;

    return {
      rate: Math.round(rate * 100) / 100,
      totalRooms,
      bookedNights,
      totalPossibleNights
    };
  },

  async getRevenue(hotelId: string, startDate: Date, endDate: Date) {
    const payments = await prisma.payments.findMany({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: startDate, lte: endDate },
        bookings: { hotelId }
      },
      include: {
        bookings: {
          include: { rooms: { include: { room_types: true } } }
        }
      }
    });

    let totalRevenue = 0;
    const byMethod: Record<string, number> = {};
    const byRoomType: Record<string, number> = {};

    for (const p of payments) {
      totalRevenue += p.amount;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      
      const roomType = p.bookings?.rooms?.room_types?.name || "Unknown";
      byRoomType[roomType] = (byRoomType[roomType] || 0) + p.amount;
    }

    return { totalRevenue, byMethod, byRoomType };
  },

  async getBookingsSummary(hotelId: string, startDate: Date, endDate: Date) {
    const bookings = await prisma.bookings.findMany({
      where: {
        hotelId,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: { status: true, totalAmount: true }
    });

    let totalBookings = bookings.length;
    let totalValue = 0;
    const byStatus: Record<string, number> = {};

    for (const b of bookings) {
      totalValue += b.totalAmount;
      byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    }

    const refunds = await prisma.refunds.aggregate({
      _count: { id: true },
      _sum: { amount: true },
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: "APPROVED",
        payments: { bookings: { hotelId } }
      }
    });

    return {
      totalBookings,
      totalValue,
      byStatus,
      refundsProcessed: refunds._count.id,
      refundsAmount: refunds._sum.amount || 0
    };
  }
};
