import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export const DashboardService = {
  async getCustomerDashboard(userId: string) {
    const today = startOfDay(new Date());
    
    const upcomingBookings = await prisma.bookings.findMany({
      where: {
        userId,
        checkOutDate: { gte: today },
        status: { in: ["CONFIRMED", "PENDING_PAYMENT", "CHECKED_IN"] }
      },
      include: { rooms: { include: { room_types: true } } },
      orderBy: { checkInDate: "asc" },
      take: 3
    });

    const pastBookingsCount = await prisma.bookings.count({
      where: {
        userId,
        checkOutDate: { lt: today },
        status: { in: ["CHECKED_OUT", "CANCELLED"] }
      }
    });

    return {
      upcomingBookings,
      pastBookingsCount
    };
  },

  async getReceptionistDashboard(hotelId: string) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const arrivals = await prisma.bookings.count({
      where: { hotelId, checkInDate: { gte: todayStart, lte: todayEnd }, status: "CONFIRMED" }
    });

    const departures = await prisma.bookings.count({
      where: { hotelId, checkOutDate: { gte: todayStart, lte: todayEnd }, status: "CHECKED_IN" }
    });

    const availableRooms = await prisma.rooms.count({
      where: { hotelId, status: "AVAILABLE" }
    });

    const occupiedRooms = await prisma.rooms.count({
      where: { hotelId, status: "OCCUPIED" }
    });

    return {
      arrivals,
      departures,
      availableRooms,
      occupiedRooms
    };
  },

  async getManagerDashboard(hotelId: string) {
    const totalRooms = await prisma.rooms.count({ where: { hotelId } });
    const occupiedRooms = await prisma.rooms.count({ where: { hotelId, status: "OCCUPIED" } });
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    const pendingRefunds = await prisma.refunds.count({
      where: { status: "REQUESTED" }
    });

    const activeStaff = await prisma.users.count({
      where: {
        user_roles: { some: { roles: { name: { in: ["RECEPTIONIST", "HOUSEKEEPER"] } } } },
        staff_profile: { deactivatedAt: null }
      }
    });

    // Approximate Revenue (total amount of completed payments for this hotel)
    const revenueAggr = await prisma.payments.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED", bookings: { hotelId } }
    });

    return {
      occupancyRate: Math.round(occupancyRate),
      pendingRefunds,
      activeStaff,
      totalRevenue: revenueAggr._sum.amount || 0
    };
  },

  async getAdminDashboard() {
    const totalManagers = await prisma.users.count({
      where: {
        user_roles: { some: { roles: { name: "MANAGER" } } },
        staff_profile: { deactivatedAt: null }
      }
    });

    const totalHotels = await prisma.hotels.count();

    const revenueAggr = await prisma.payments.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" }
    });

    return {
      totalManagers,
      totalHotels,
      totalPlatformRevenue: revenueAggr._sum.amount || 0
    };
  }
};
