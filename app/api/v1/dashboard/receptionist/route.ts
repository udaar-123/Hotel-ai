import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { DashboardService } from "@/modules/dashboard/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session || !["ADMIN", "MANAGER", "RECEPTIONIST"].includes(session.role)) throw new UnauthorizedError();

    // Since it's a single hotel system right now, fetch first hotel
    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) throw new Error("No hotel found");

    const data = await DashboardService.getReceptionistDashboard(hotel.id);
    return formatSuccessResponse(data);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
