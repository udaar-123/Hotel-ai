import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse } from "@/shared/errors";
import { PaymentsRepository } from "@/modules/payments/repository";

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id } = await req.json();

    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.payments.findFirst({ where: { transactionId: razorpay_order_id } });
    
    if (!payment) throw new Error("Payment not found");

    // Since this is local testing without a webhook tunnel, we manually confirm it from the client callback.
    const result = await PaymentsRepository.confirmPaymentAndBooking(payment.id, razorpay_payment_id);
    await PaymentsRepository.logPaymentEvent(payment.id, "PAYMENT_CAPTURED_CLIENT", { razorpay_payment_id });
    
    return formatSuccessResponse(result.booking);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
