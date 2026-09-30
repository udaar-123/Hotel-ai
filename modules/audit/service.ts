import { AuditRepository } from "./repository";
import { EventBus } from "@/shared/events";

export const AuditService = {
  async getAuditLogs(userRole: string, filters?: { action?: string }) {
    // Basic scoping based on role could be added here.
    return AuditRepository.getAuditLogs(filters);
  }
};

// Event Listeners for Audit
EventBus.on("booking.created", async (payload: any) => {
  const booking = payload.booking;
  await AuditRepository.logAction({
    userId: booking.userId, // Customer or staff
    action: "BOOKING_CREATED",
    targetTable: "bookings",
    newValue: JSON.stringify({ id: booking.id, hotelId: booking.hotelId })
  });
});

EventBus.on("booking.confirmed", async (payload: any) => {
  const booking = payload.booking;
  await AuditRepository.logAction({
    userId: booking.userId,
    action: "BOOKING_CONFIRMED",
    targetTable: "bookings",
    newValue: JSON.stringify({ id: booking.id, status: "CONFIRMED" })
  });
});

EventBus.on("booking.cancelled", async (payload: any) => {
  const booking = payload.booking;
  await AuditRepository.logAction({
    userId: booking.userId,
    action: "BOOKING_CANCELLED",
    targetTable: "bookings",
    newValue: JSON.stringify({ id: booking.id, status: "CANCELLED" })
  });
});

EventBus.on("booking.checked_in", async (payload: any) => {
  const booking = payload.booking;
  await AuditRepository.logAction({
    userId: booking.userId, // Note: For a more robust system, we would pass the actor ID
    action: "BOOKING_CHECKED_IN",
    targetTable: "bookings",
    newValue: JSON.stringify({ id: booking.id })
  });
});

EventBus.on("booking.checked_out", async (payload: any) => {
  const booking = payload.booking;
  await AuditRepository.logAction({
    userId: booking.userId,
    action: "BOOKING_CHECKED_OUT",
    targetTable: "bookings",
    newValue: JSON.stringify({ id: booking.id })
  });
});

EventBus.on("room.status.changed", async (payload: any) => {
  const { room, newStatus } = payload;
  // If we don't have the actor, we might use a system ID or fallback. 
  // We'll just grab any admin for now as a fallback if actor isn't in payload.
  const actorId = payload.actorId || "SYSTEM"; 
  if (actorId !== "SYSTEM") {
    await AuditRepository.logAction({
      userId: actorId,
      action: "ROOM_STATUS_CHANGED",
      targetTable: "rooms",
      newValue: JSON.stringify({ id: room.id, status: newStatus })
    });
  }
});

EventBus.on("refund.approved", async (payload: any) => {
  const refund = payload.refund;
  const actorId = payload.actorId || refund.userId || "SYSTEM";
  // We need a valid UUID for userId, so if actorId is SYSTEM it might crash.
  // We must skip if we don't have a valid user ID, but we should always have payload.actorId now.
  if (actorId && actorId !== "SYSTEM") {
    await AuditRepository.logAction({
      userId: actorId,
      action: "REFUND_APPROVED",
      targetTable: "refunds",
      newValue: JSON.stringify({ id: refund.id, amount: refund.amount })
    });
  }
});

EventBus.on("review.moderated", async (payload: any) => {
  const review = payload.review;
  await AuditRepository.logAction({
    userId: review.userId, 
    action: `REVIEW_MODERATED_${review.status}`,
    targetTable: "reviews",
    newValue: JSON.stringify({ id: review.id })
  });
});
