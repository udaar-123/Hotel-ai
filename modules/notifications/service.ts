import { NotificationsRepository } from "./repository";
import { EventBus } from "@/shared/events";

export const NotificationsService = {
  async sendNotification(data: {
    userId: string;
    title: string;
    message: string;
    channel: string;
    link?: string;
  }) {
    // In a real app, you might also push to WebSockets here for real-time delivery
    return NotificationsRepository.createNotification(data);
  },
};

// Register Event Listeners
EventBus.on("booking.confirmed", async (payload: any) => {
  try {
    const booking = payload.booking;
    if (!booking) return;
    
    // Notify the customer
    await NotificationsService.sendNotification({
      userId: booking.userId,
      title: "Booking Confirmed",
      message: `Your booking for ${new Date(booking.checkInDate).toLocaleDateString()} is confirmed!`,
      channel: "IN_APP",
      link: `/bookings/${booking.id}`,
    });
  } catch (err) {
    console.error("Failed to process booking.confirmed event", err);
  }
});

EventBus.on("refund.requested", async (payload: any) => {
  try {
    const refund = payload.refund;
    // Notify admins/managers - we would need to fetch manager IDs, or just broadcast it generically.
    // For now, if we know who the user is, we notify them, or we can notify a generic "manager" 
    // Since we don't easily have manager IDs here, we'll skip manager broadcast for now or fetch them.
    const { prisma } = await import("@/lib/prisma");
    const managers = await prisma.users.findMany({
      where: { user_roles: { some: { roles: { name: "MANAGER" } } } }
    });
    
    for (const manager of managers) {
      await NotificationsService.sendNotification({
        userId: manager.id,
        title: "Refund Requested",
        message: `A new refund of $${refund.amount} has been requested.`,
        channel: "IN_APP",
        link: `/manager/refunds`,
      });
    }
  } catch (err) {
    console.error(err);
  }
});

EventBus.on("refund.approved", async (payload: any) => {
  try {
    const refund = payload.refund;
    if (!refund.payments?.bookings?.userId) return;
    
    await NotificationsService.sendNotification({
      userId: refund.payments.bookings.userId,
      title: "Refund Approved",
      message: `Your refund of $${refund.amount} has been approved and processed.`,
      channel: "IN_APP",
      link: `/bookings/${refund.payments.bookings.id}`,
    });
  } catch (err) {}
});

EventBus.on("invoice.generated", async (payload: any) => {
  try {
    const invoice = payload.invoice;
    if (!invoice.bookings?.userId) return;
    
    await NotificationsService.sendNotification({
      userId: invoice.bookings.userId,
      title: "Invoice Available",
      message: `Invoice ${invoice.invoiceNum} is ready to view.`,
      channel: "IN_APP",
      link: `/shared/invoice/${invoice.bookingId}`,
    });
  } catch (err) {}
});
