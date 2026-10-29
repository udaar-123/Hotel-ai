import { NextRequest, NextResponse } from "next/server";
import { BookingsService } from "@/modules/bookings/service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    let expiryMinutes = 15;
    try {
      const body = await req.json();
      if (typeof body?.expiryMinutes === "number" && body.expiryMinutes >= 1) {
        expiryMinutes = body.expiryMinutes;
      }
    } catch {
      // Optional JSON body
    }

    const hotel = await prisma.hotels.findFirst();
    const result = await BookingsService.expireStalePendingBookings(hotel?.id, expiryMinutes);
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        expiryMinutes,
        message: `Released ${result.expiredCount} stale unpaid booking(s).`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to expire stale bookings" },
      { status: 500 }
    );
  }
}
