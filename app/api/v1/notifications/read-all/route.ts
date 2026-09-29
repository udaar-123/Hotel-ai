import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { NotificationsRepository } from "@/modules/notifications/repository";
import { decryptSession } from "@/modules/auth/utils";

export async function PATCH(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    await NotificationsRepository.markAllAsRead(session.userId);
    return formatSuccessResponse(null, "All notifications marked as read");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
