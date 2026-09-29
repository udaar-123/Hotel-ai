import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { InvoicesService } from "@/modules/invoices/service";
import { decryptSession } from "@/modules/auth/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    
    // Both Customer and Staff can generate the invoice as long as it's eligible
    const resolvedParams = await params;
    
    const invoice = await InvoicesService.generateInvoice(resolvedParams.bookingId);
    
    // If customer, ensure it belongs to them
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
