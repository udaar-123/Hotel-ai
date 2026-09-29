import { prisma } from "@/lib/prisma";
import { PaymentStatus, RefundStatus } from "./types";
import { BookingStatus } from "@/modules/bookings/types";

export const PaymentsRepository = {
  async upsertPayment(data: { bookingId: string; amount: number; method: string }) {
    return prisma.payments.upsert({
      where: { bookingId: data.bookingId },
      update: {
        amount: data.amount,
        method: data.method,
        status: PaymentStatus.PENDING,
        updatedAt: new Date()
      },
      create: {
        id: crypto.randomUUID(),
        bookingId: data.bookingId,
        amount: data.amount,
        status: PaymentStatus.PENDING,
        method: data.method,
      }
    });
  },

  async getPaymentByBooking(bookingId: string) {
    return prisma.payments.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' }
    });
  },

  async updatePaymentStatus(paymentId: string, status: string, transactionId?: string) {
    return prisma.payments.update({
      where: { id: paymentId },
      data: { 
        status, 
        ...(transactionId && { transactionId }),
        updatedAt: new Date()
      },
      include: { bookings: true }
    });
  },

  async requestRefund(paymentId: string, amount: number, reason: string) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refunds.create({
        data: {
          id: crypto.randomUUID(),
          paymentId,
          amount,
          reason,
          status: RefundStatus.REQUESTED,
          updatedAt: new Date()
        }
      });
      return refund;
    }, { maxWait: 10000, timeout: 20000 });
  },

  async getRefundQueue() {
    return prisma.refunds.findMany({
      include: {
        payments: {
          include: { bookings: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async updateRefundStatus(refundId: string, status: string) {
    return prisma.refunds.update({
      where: { id: refundId },
      data: { status, updatedAt: new Date() },
      include: { payments: { include: { bookings: true } } }
    });
  },

  async logPaymentEvent(paymentId: string, action: string, payload?: any) {
    return prisma.payment_logs.create({
      data: {
        id: crypto.randomUUID(),
        paymentId,
        action,
        payload: payload ? JSON.stringify(payload) : null
      }
    });
  },

  async confirmPaymentAndBooking(paymentId: string, transactionId: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payments.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.COMPLETED, transactionId, updatedAt: new Date() }
      });

      const booking = await tx.bookings.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED }
      });

      return { payment, booking };
    }, { maxWait: 10000, timeout: 20000 });
  }
};
