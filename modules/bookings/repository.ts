import { prisma } from "@/lib/prisma";
import { BookingStatus, BookingSource } from "./types";
import { Prisma } from "@prisma/client";

const UNPAID_BOOKING_EXPIRY_MINUTES = 15;

async function withSerializableRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // P2034 is Prisma's code for transaction failed due to a write conflict or deadlock (Serializable isolation)
      const isSerializationConflict =
        error?.code === "P2034" ||
        (typeof error?.message === "string" &&
          (error.message.includes("could not serialize access") ||
            error.message.includes("deadlock detected")));
      if (!isSerializationConflict || attempt === maxRetries) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 40 * attempt));
    }
  }
  throw lastError;
}

export const BookingsRepository = {
  /**
   * Automatically cancels PENDING_PAYMENT bookings older than `expiryMinutes` (default 15 mins)
   * that do not have a COMPLETED payment, releasing the held rooms back to inventory.
   */
  async expireStalePendingBookings(
    hotelId?: string,
    expiryMinutes: number = UNPAID_BOOKING_EXPIRY_MINUTES,
    dbClient: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);

    const staleBookings = await dbClient.bookings.findMany({
      where: {
        ...(hotelId ? { hotelId } : {}),
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
        OR: [
          { payments: { is: null } },
          { payments: { is: { status: { not: "COMPLETED" } } } },
        ],
      },
      select: { id: true, roomId: true },
    });

    if (staleBookings.length === 0) {
      return { expiredCount: 0, bookingIds: [] as string[] };
    }

    const staleIds = staleBookings.map((b) => b.id);
    await dbClient.bookings.updateMany({
      where: { id: { in: staleIds } },
      data: {
        status: BookingStatus.CANCELLED,
        updatedAt: new Date(),
      },
    });

    return { expiredCount: staleIds.length, bookingIds: staleIds };
  },

  async getAvailableRooms(hotelId: string, checkIn: Date, checkOut: Date, guests: number) {
    // Release any expired PENDING_PAYMENT holds before checking availability
    await this.expireStalePendingBookings(hotelId);

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
    return withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // 1. Acquire row-level lock on the target room so concurrent bookings for this room serialize
          await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${data.roomId} FOR UPDATE`;

          // 2. Expire any stale unpaid bookings holding this hotel's rooms
          await this.expireStalePendingBookings(data.hotelId, UNPAID_BOOKING_EXPIRY_MINUTES, tx);

          // 3. Re-check availability inside Serializable transaction
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
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 20000,
        }
      )
    );
  },

  async createOfflineBooking(data: {
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
    amountPaid: number;
    createdByStaffId: string;
  }) {
    return withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // 1. Acquire row-level lock on the target room
          await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${data.roomId} FOR UPDATE`;

          // 2. Expire any stale unpaid bookings holding this hotel's rooms
          await this.expireStalePendingBookings(data.hotelId, UNPAID_BOOKING_EXPIRY_MINUTES, tx);

          // 3. Re-check availability inside Serializable transaction
          const overlapping = await tx.bookings.findFirst({
            where: {
              roomId: data.roomId,
              status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
              OR: [
                { checkInDate: { lt: data.checkOutDate }, checkOutDate: { gt: data.checkInDate } }
              ]
            }
          });

          if (overlapping) throw new Error("Room is no longer available for these dates");

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
              status: BookingStatus.CONFIRMED,
              source: BookingSource.OFFLINE,
              createdByStaffId: data.createdByStaffId,
              guestCount: data.guests,
              booking_guests: {
                create: {
                  id: crypto.randomUUID(),
                  name: data.guestName,
                  email: data.guestEmail,
                  phone: data.guestPhone
                }
              },
              payments: {
                create: {
                  id: crypto.randomUUID(),
                  amount: data.amountPaid,
                  status: data.amountPaid >= data.totalAmount ? "COMPLETED" : "PENDING",
                  method: "CASH"
                }
              }
            },
            include: {
              booking_guests: true,
              rooms: { include: { room_types: true } }
            }
          });

          return booking;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 20000,
        }
      )
    );
  },

  async getBookingsByUser(userId: string) {
    await this.expireStalePendingBookings();
    return prisma.bookings.findMany({
      where: { userId },
      include: {
        rooms: { include: { room_types: true, room_images: true } },
        booking_guests: true
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async getAllBookings(hotelId: string) {
    await this.expireStalePendingBookings(hotelId);
    return prisma.bookings.findMany({
      where: { hotelId },
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
        identity_docs: true,
        payments: {
          include: { refunds: true }
        }
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

  async checkIn(bookingId: string, roomId: string) {
    return prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_IN },
        include: { rooms: { include: { room_types: true } } }
      });

      await tx.checkins.upsert({
        where: { bookingId },
        update: { status: "COMPLETED", arrivalTime: new Date().toISOString() },
        create: {
          id: crypto.randomUUID(),
          bookingId,
          status: "COMPLETED",
          arrivalTime: new Date().toISOString()
        }
      });

      await tx.rooms.update({
        where: { id: roomId },
        data: { status: "OCCUPIED" }
      });

      return updatedBooking;
    }, { maxWait: 10000, timeout: 20000 });
  },

  async checkOut(bookingId: string, roomId: string) {
    return prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.bookings.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CHECKED_OUT },
        include: { rooms: { include: { room_types: true } } }
      });

      await tx.rooms.update({
        where: { id: roomId },
        data: { status: "CHECKED_OUT" }
      });

      return updatedBooking;
    }, { maxWait: 10000, timeout: 20000 });
  },

  async addIdentityDocument(bookingId: string, url: string, publicId: string, documentType: string) {
    return prisma.identity_documents.create({
      data: { id: crypto.randomUUID(), bookingId, url, publicId, documentType }
    });
  }
};
