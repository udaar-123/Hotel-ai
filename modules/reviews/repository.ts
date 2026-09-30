import { prisma } from "@/lib/prisma";

export const ReviewsRepository = {
  async createReview(data: {
    bookingId: string;
    userId: string;
    hotelId: string;
    rating: number;
    comment: string | null;
  }) {
    return prisma.reviews.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
      },
      include: {
        users: true,
        bookings: { include: { rooms: { include: { room_types: true } } } }
      }
    });
  },

  async getPublishedReviews(hotelId: string) {
    return prisma.reviews.findMany({
      where: { hotelId, status: "PUBLISHED" },
      include: {
        users: { select: { name: true } },
        bookings: { include: { rooms: { include: { room_types: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async getPendingReviews(hotelId?: string) {
    return prisma.reviews.findMany({
      where: { status: "PENDING", hotelId },
      include: {
        users: { select: { name: true } },
        bookings: { include: { rooms: { include: { room_types: true } } } }
      },
      orderBy: { createdAt: "asc" }
    });
  },

  async getReviewById(id: string) {
    return prisma.reviews.findUnique({
      where: { id },
      include: { users: true, bookings: true }
    });
  },

  async updateReviewStatus(id: string, status: "PUBLISHED" | "REJECTED") {
    return prisma.reviews.update({
      where: { id },
      data: { status },
      include: { users: true, bookings: true }
    });
  }
};
