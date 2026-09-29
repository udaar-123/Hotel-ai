import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { NotificationsRepository } from "@/modules/notifications/repository";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const notifications = await NotificationsRepository.getUserNotifications(session.userId);
    return formatSuccessResponse(notifications);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
