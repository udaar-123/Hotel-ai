import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { ReportsService } from "@/modules/reports/service";
import { decryptSession } from "@/modules/auth/utils";
import { authorize } from "@/shared/authorization";
import { startOfDay, endOfDay, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    authorize({ id: session.userId, role: session.role }, "reports:view");

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("startDate") ? new Date(searchParams.get("startDate") as string) : subDays(new Date(), 30);
    const end = searchParams.get("endDate") ? new Date(searchParams.get("endDate") as string) : endOfDay(new Date());

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();

    const data = await ReportsService.getRevenue(hotel!.id, startOfDay(start), endOfDay(end));
    return formatSuccessResponse(data);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
