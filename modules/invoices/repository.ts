import { prisma } from "@/lib/prisma";

export const InvoicesRepository = {
  async getInvoiceByBookingId(bookingId: string) {
    return prisma.invoices.findUnique({
      where: { bookingId },
      include: {
        bookings: {
          include: {
            hotels: true,
            rooms: { include: { room_types: true } },
            booking_guests: true,
            payments: true
          }
        }
      }
    });
  },

  async createInvoice(data: {
    bookingId: string;
    invoiceNum: string;
    totalAmount: number;
    status: string;
  }) {
    return prisma.invoices.create({
      data: {
        id: crypto.randomUUID(),
        bookingId: data.bookingId,
        invoiceNum: data.invoiceNum,
        totalAmount: data.totalAmount,
        status: data.status,
      },
      include: {
        bookings: {
          include: {
            hotels: true,
            rooms: { include: { room_types: true } },
            booking_guests: true,
            payments: true
          }
        }
      }
    });
  },
  
  async updateInvoiceStatus(invoiceId: string, status: string) {
    return prisma.invoices.update({
      where: { id: invoiceId },
      data: { status }
    });
  }
};
