import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError, ForbiddenError } from "@/shared/errors";
import { BookingsService } from "@/modules/bookings/service";
import { CreateOfflineBookingSchema } from "@/modules/bookings/validation";
import { decryptSession } from "@/modules/auth/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    if (session.role === "CUSTOMER") throw new ForbiddenError();

    const body = await req.json();
    const parsed = CreateOfflineBookingSchema.parse(body);

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) throw new Error("No hotel found");

    const booking = await BookingsService.createOfflineBooking(
      { id: session.userId, role: session.role },
      hotel.id,
      parsed
    );
    return formatSuccessResponse(booking, "Offline booking created");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
