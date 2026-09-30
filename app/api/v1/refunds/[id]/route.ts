import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError, ForbiddenError } from "@/shared/errors";
import { PaymentsService } from "@/modules/payments/service";
import { decryptSession } from "@/modules/auth/utils";

// Approve/Reject Refund (Manager)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    if (session.role === "CUSTOMER") throw new ForbiddenError("Not allowed");
    const resolvedParams = await params;

    const { action } = await req.json(); // "APPROVE" or "REJECT"
    if (action !== "APPROVE" && action !== "REJECT") {
      throw new Error("Action must be APPROVE or REJECT");
    }

    const processed = await PaymentsService.processRefund(resolvedParams.id, action, session.userId);
    return formatSuccessResponse(processed, `Refund ${action.toLowerCase()}d successfully`);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
