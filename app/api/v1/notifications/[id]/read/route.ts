import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { NotificationsRepository } from "@/modules/notifications/repository";
import { decryptSession } from "@/modules/auth/utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    const resolvedParams = await params;

    await NotificationsRepository.markAsRead(resolvedParams.id);
    return formatSuccessResponse(null, "Notification marked as read");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
