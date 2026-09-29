import Razorpay from "razorpay";
import { PaymentsRepository } from "./repository";
import crypto from "crypto";
import { PaymentStatus, RefundStatus } from "./types";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { EventBus } from "@/shared/events";

// Initialize Razorpay conditionally so build doesn't crash if env missing
let razorpay: Razorpay | null = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

export const PaymentsService = {
  async createOrder(bookingId: string, amount: number) {
    if (!razorpay) throw new Error("Razorpay is not configured");

    const payment = await PaymentsRepository.upsertPayment({
      bookingId,
      amount,
      method: "ONLINE"
    });

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise (cents)
      currency: "INR", // Changed to INR to support default Indian Razorpay test accounts
      receipt: `receipt_${bookingId}`,
    };

    const order = await razorpay.orders.create(options);

    await PaymentsRepository.updatePaymentStatus(payment.id, PaymentStatus.PENDING, order.id);
    await PaymentsRepository.logPaymentEvent(payment.id, "ORDER_CREATED", { orderId: order.id });

    return {
      orderId: order.id,
      paymentId: payment.id,
      amount: options.amount,
      currency: options.currency
    };
  },

  async verifyWebhook(signature: string, rawBody: string) {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw new Error("Webhook secret not configured");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new ValidationError("Invalid signature");
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentData = payload.payload.payment.entity;
    
    // Find payment by providerRef (order_id)
    // For simplicity, assuming razorpay provides order_id in paymentData
    // Usually it's paymentData.order_id
    const orderId = paymentData.order_id;
    
    // We need a helper to find payment by transactionId
    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.payments.findFirst({ where: { transactionId: orderId } });
    
    if (!payment) {
      console.error(`Payment not found for order ${orderId}`);
      return;
    }

    if (event === "payment.captured" || event === "payment.authorized") {
      const result = await PaymentsRepository.confirmPaymentAndBooking(payment.id, paymentData.id);
      await PaymentsRepository.logPaymentEvent(payment.id, "PAYMENT_CAPTURED", paymentData);
      EventBus.emit("booking.confirmed", { booking: result.booking });
    } else if (event === "payment.failed") {
      await PaymentsRepository.updatePaymentStatus(payment.id, PaymentStatus.FAILED, paymentData.id);
      await PaymentsRepository.logPaymentEvent(payment.id, "PAYMENT_FAILED", paymentData);
    }
  },

  async requestRefund(userId: string, bookingId: string, reason: string) {
    const payment = await PaymentsRepository.getPaymentByBooking(bookingId);
    if (!payment) throw new NotFoundError("Payment not found");
    
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new ValidationError("Only completed payments can be refunded");
    }

    const refund = await PaymentsRepository.requestRefund(payment.id, payment.amount, reason);
    EventBus.emit("refund.requested", { refund });
    return refund;
  },

  async getRefundQueue() {
    return PaymentsRepository.getRefundQueue();
  },

  async processRefund(refundId: string, action: "APPROVE" | "REJECT") {
    if (action === "REJECT") {
      const rejected = await PaymentsRepository.updateRefundStatus(refundId, RefundStatus.REJECTED);
      EventBus.emit("refund.rejected", { refund: rejected });
      return rejected;
    }

    const approved = await PaymentsRepository.updateRefundStatus(refundId, RefundStatus.APPROVED);
    EventBus.emit("refund.approved", { refund: approved });
    
    // Process refund in Razorpay if online payment
    if (approved.payments.method === "ONLINE" && razorpay) {
      try {
        const rzpRefund = await razorpay.payments.refund(approved.payments.transactionId!, {
          amount: Math.round(approved.amount * 100)
        });
        
        const processed = await PaymentsRepository.updateRefundStatus(refundId, RefundStatus.PROCESSED);
        EventBus.emit("refund.processed", { refund: processed });
        return processed;
      } catch (error) {
        console.error("Razorpay refund error:", error);
        throw new Error("Razorpay refund failed");
      }
    } else {
      // Manual refund (cash) - just mark processed
      const processed = await PaymentsRepository.updateRefundStatus(refundId, RefundStatus.PROCESSED);
      return processed;
    }
  }
};
