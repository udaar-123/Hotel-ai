import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { BookingsService } from "@/modules/bookings/service";
import { SearchAvailabilitySchema } from "@/modules/bookings/validation";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const checkInDate = url.searchParams.get("checkInDate");
    const checkOutDate = url.searchParams.get("checkOutDate");
    const guests = url.searchParams.get("guests");

    if (!checkInDate || !checkOutDate || !guests) {
      return formatSuccessResponse([]);
    }

    const parsed = SearchAvailabilitySchema.parse({
      checkInDate,
      checkOutDate,
      guests
    });

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) return formatSuccessResponse([]);

    const available = await BookingsService.getAvailableRooms(hotel.id, parsed);
    return formatSuccessResponse(available);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
