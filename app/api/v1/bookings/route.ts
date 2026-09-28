import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { BookingsService } from "@/modules/bookings/service";
import { CreateBookingSchema } from "@/modules/bookings/validation";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const bookings = await BookingsService.getCustomerBookings(session.userId);
    return formatSuccessResponse(bookings);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = CreateBookingSchema.parse(body);

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) throw new Error("No hotel found");

    const booking = await BookingsService.createBooking(
      { id: session.userId, role: session.role },
      hotel.id,
      parsed
    );
    return formatSuccessResponse(booking, "Booking created");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
