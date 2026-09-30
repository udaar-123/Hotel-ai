import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { DashboardService } from "@/modules/dashboard/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session || session.role !== "CUSTOMER") throw new UnauthorizedError();

    const data = await DashboardService.getCustomerDashboard(session.userId);
    return formatSuccessResponse(data);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
