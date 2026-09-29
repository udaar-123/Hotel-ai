import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { InvoicesService } from "@/modules/invoices/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    const resolvedParams = await params;

    const invoice = await InvoicesService.getInvoiceByBooking(resolvedParams.bookingId);
    
    // Auth check: if customer, must own the booking
    if (session.role === "CUSTOMER") {
      if (invoice.bookings.userId !== session.userId) {
        throw new UnauthorizedError("Not your invoice");
      }
    }

    return formatSuccessResponse(invoice);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
