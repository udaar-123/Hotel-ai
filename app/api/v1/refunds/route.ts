import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError, ForbiddenError } from "@/shared/errors";
import { PaymentsService } from "@/modules/payments/service";
import { decryptSession } from "@/modules/auth/utils";

// Request Refund (Customer)
export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const { bookingId, reason } = await req.json();
    if (!bookingId || !reason) throw new Error("bookingId and reason are required");

    const refund = await PaymentsService.requestRefund(session.userId, bookingId, reason);
    return formatSuccessResponse(refund, "Refund requested successfully");
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// Get Refund Queue (Manager)
export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    if (session.role === "CUSTOMER") throw new ForbiddenError("Not allowed");

    const refunds = await PaymentsService.getRefundQueue();
    return formatSuccessResponse(refunds);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
