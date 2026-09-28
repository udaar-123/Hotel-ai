import { prisma } from "@/lib/prisma";
import { BookingStatus, BookingSource } from "./types";
import { Prisma } from "@prisma/client";

export const BookingsRepository = {
  async getAvailableRooms(hotelId: string, checkIn: Date, checkOut: Date, guests: number) {
    // A room is available if it's ACTIVE, has enough capacity, and has NO overlapping bookings
    // that are in CONFIRMED, CHECKED_IN, or PENDING_PAYMENT status.
    const overlappingBookings = await prisma.bookings.findMany({
      where: {
        hotelId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        OR: [
          { checkInDate: { lt: checkOut }, checkOutDate: { gt: checkIn } }
        ]
      },
      select: { roomId: true }
    });

    const bookedRoomIds = overlappingBookings.map(b => b.roomId);

    return prisma.rooms.findMany({
      where: {
        hotelId,
        isActive: true,
        id: { notIn: bookedRoomIds },
        room_types: {
          capacity: { gte: guests }
        }
      },
      include: {
        room_types: true,
        room_images: true
      },
      orderBy: { roomNumber: 'asc' }
    });
  },

  async createBooking(data: {
    hotelId: string;
    userId: string;
    roomId: string;
    checkInDate: Date;
    checkOutDate: Date;
    guests: number;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    totalAmount: number;
    source: string;
    createdByStaffId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // Re-check availability with a lock or inside transaction to prevent race conditions
      const overlapping = await tx.bookings.findFirst({
        where: {
          roomId: data.roomId,
          status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
          OR: [
            { checkInDate: { lt: data.checkOutDate }, checkOutDate: { gt: data.checkInDate } }
          ]
        }
      });

      if (overlapping) {
        throw new Error("Room is no longer available for these dates");
      }

      const bookingId = crypto.randomUUID();
      const booking = await tx.bookings.create({
        data: {
          id: bookingId,
          hotelId: data.hotelId,
          userId: data.userId,
          roomId: data.roomId,
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          totalAmount: data.totalAmount,
          status: BookingStatus.PENDING_PAYMENT,
          source: data.source,
          createdByStaffId: data.createdByStaffId,
          guestCount: data.guests,
          booking_guests: {
            create: {
              id: crypto.randomUUID(),
              name: data.guestName,
              email: data.guestEmail,
              phone: data.guestPhone
            }
          }
        },
        include: {
          booking_guests: true,
          rooms: { include: { room_types: true } }
        }
      });

      return booking;
    });
  },

  async getBookingsByUser(userId: string) {
    return prisma.bookings.findMany({
      where: { userId },
      include: {
        rooms: { include: { room_types: true, room_images: true } },
        booking_guests: true
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getBookingById(id: string) {
    return prisma.bookings.findUnique({
      where: { id },
      include: {
        rooms: { include: { room_types: true, room_images: true } },
        booking_guests: true,
        identity_docs: true
      }
    });
  },

  async updateBookingStatus(id: string, status: string) {
    return prisma.bookings.update({
      where: { id },
      data: { status },
      include: {
        rooms: { include: { room_types: true } }
      }
    });
  },

  async addIdentityDocument(bookingId: string, url: string, publicId: string, documentType: string) {
    return prisma.identity_documents.create({
      data: { id: crypto.randomUUID(), bookingId, url, publicId, documentType }
    });
  }
};
