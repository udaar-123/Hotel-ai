import { NextRequest, NextResponse } from "next/server";
import { RoomsService } from "@/modules/rooms/service";
import { UpdateRoomSchema } from "@/modules/rooms/validation";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { formatSuccessResponse } from "@/shared/errors";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const room = await RoomsService.getRoomById(resolvedParams.id);
    return formatSuccessResponse(room);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const body = await req.json();
    const parsed = UpdateRoomSchema.parse(body);

    const room = await RoomsService.updateRoom(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      parsed
    );
    return formatSuccessResponse(room, "Room updated");
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
