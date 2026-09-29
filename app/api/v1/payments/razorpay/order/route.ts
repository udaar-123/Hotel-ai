import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError, NotFoundError } from "@/shared/errors";
import { PaymentsService } from "@/modules/payments/service";
import { decryptSession } from "@/modules/auth/utils";
import { BookingsRepository } from "@/modules/bookings/repository";

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("bookingId is required");

    const booking = await BookingsRepository.getBookingById(bookingId);
    if (!booking) throw new NotFoundError("Booking not found");

    if (booking.userId !== session.userId) {
      throw new UnauthorizedError("Not your booking");
    }

    const order = await PaymentsService.createOrder(booking.id, booking.totalAmount);
    return formatSuccessResponse(order);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
