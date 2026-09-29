import { InvoicesRepository } from "./repository";
import { BookingsRepository } from "@/modules/bookings/repository";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { EventBus } from "@/shared/events";

export const InvoicesService = {
  async getInvoiceByBooking(bookingId: string) {
    const invoice = await InvoicesRepository.getInvoiceByBookingId(bookingId);
    if (!invoice) throw new NotFoundError("Invoice not found");
    return invoice;
  },

  async generateInvoice(bookingId: string) {
    // Check if it already exists
    let invoice = await InvoicesRepository.getInvoiceByBookingId(bookingId);
    if (invoice) {
      return invoice;
    }

    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    if (booking.status === "PENDING_PAYMENT" || booking.status === "CANCELLED") {
      throw new ValidationError("Cannot generate invoice for pending or cancelled booking");
    }

    // Generate Invoice Number (e.g., INV-20260929-XXXX)
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const invoiceNum = `INV-${dateStr}-${randomHash}`;
    
    // Determine status (PAID if they checked in or payment is completed)
    let status = "ISSUED";
    if (booking.payments?.status === "COMPLETED" || booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT") {
      status = "PAID";
    }

    invoice = await InvoicesRepository.createInvoice({
      bookingId,
      invoiceNum,
      totalAmount: booking.totalAmount,
      status
    });

    EventBus.emit("invoice.generated", { invoice });
    return invoice;
  }
};
