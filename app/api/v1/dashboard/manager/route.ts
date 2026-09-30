import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { DashboardService } from "@/modules/dashboard/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session || !["ADMIN", "MANAGER"].includes(session.role)) throw new UnauthorizedError();

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) throw new Error("No hotel found");

    const data = await DashboardService.getManagerDashboard(hotel.id);
    return formatSuccessResponse(data);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
