import { NextRequest, NextResponse } from "next/server";
import { RoomsService } from "@/modules/rooms/service";
import { UpdateRoomStatusSchema } from "@/modules/rooms/validation";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { formatSuccessResponse } from "@/shared/errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const body = await req.json();
    const parsed = UpdateRoomStatusSchema.parse(body);

    const room = await RoomsService.changeRoomStatus(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      parsed.status
    );
    return formatSuccessResponse(room, "Room status updated");
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
