import { ReviewsRepository } from "./repository";
import { BookingsRepository } from "@/modules/bookings/repository";
import { EventBus } from "@/shared/events";
import { ValidationError, NotFoundError } from "@/shared/errors";
import { authorize } from "@/shared/authorization";
import { UserRole } from "@/modules/auth/types";

export const ReviewsService = {
  async submitReview(userId: string, data: { bookingId: string; rating: number; comment?: string }) {
    const booking = await BookingsRepository.getBookingById(data.bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    if (booking.userId !== userId) {
      throw new ValidationError("You can only review your own bookings");
    }

    if (booking.status !== "CHECKED_OUT") {
      throw new ValidationError("You can only review completed stays");
    }

    const existing = await import("@/lib/prisma").then(m => m.prisma.reviews.findUnique({ where: { bookingId: data.bookingId } }));
    if (existing) {
      throw new ValidationError("You have already submitted a review for this booking");
    }

    const review = await ReviewsRepository.createReview({
      bookingId: data.bookingId,
      userId,
      hotelId: booking.hotelId,
      rating: data.rating,
      comment: data.comment || null
    });

    EventBus.emit("review.created", { review });
    return review;
  },

  async moderateReview(
    currentUser: { id: string; role: UserRole },
    reviewId: string,
    action: "PUBLISHED" | "REJECTED"
  ) {
    // Both ADMIN and MANAGER can moderate reviews
    if (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER") {
      throw new ValidationError("Unauthorized to moderate reviews");
    }

    const review = await ReviewsRepository.getReviewById(reviewId);
    if (!review) throw new NotFoundError("Review not found");

    if (review.status !== "PENDING") {
      throw new ValidationError(`Review is already ${review.status}`);
    }

    const updated = await ReviewsRepository.updateReviewStatus(reviewId, action);
    
    EventBus.emit("review.moderated", { review: updated });
    return updated;
  }
};

// Event Subscriptions for Notifications
EventBus.on("review.created", async (payload: any) => {
  try {
    const { NotificationsService } = await import("@/modules/notifications/service");
    const { prisma } = await import("@/lib/prisma");

    const review = payload.review;
    const managers = await prisma.users.findMany({
      where: { user_roles: { some: { roles: { name: "MANAGER" } } } }
    });
    
    for (const manager of managers) {
      await NotificationsService.sendNotification({
        userId: manager.id,
        title: "New Review Pending",
        message: `A new ${review.rating}-star review requires moderation.`,
        channel: "IN_APP",
        link: `/manager/reviews`,
      });
    }
  } catch (err) {}
});

EventBus.on("review.moderated", async (payload: any) => {
  try {
    const { NotificationsService } = await import("@/modules/notifications/service");
    const review = payload.review;

    await NotificationsService.sendNotification({
      userId: review.userId,
      title: "Review Update",
      message: `Your review has been ${review.status.toLowerCase()}.`,
      channel: "IN_APP",
      link: `/bookings/${review.bookingId}`,
    });
  } catch (err) {}
});
