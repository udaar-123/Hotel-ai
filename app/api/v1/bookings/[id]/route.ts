import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { BookingsService } from "@/modules/bookings/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const booking = await BookingsService.getBookingById(
      { id: session.userId, role: session.role },
      resolvedParams.id
    );
    return formatSuccessResponse(booking);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
