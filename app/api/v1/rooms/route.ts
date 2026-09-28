import { NextRequest, NextResponse } from "next/server";
import { RoomsService } from "@/modules/rooms/service";
import { CreateRoomSchema } from "@/modules/rooms/validation";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { formatSuccessResponse } from "@/shared/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    
    const rooms = await RoomsService.getRooms("hotel-1");
    return NextResponse.json(formatSuccessResponse(rooms));
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = CreateRoomSchema.parse(body);

    const room = await RoomsService.createRoom(
      { id: session.userId, role: session.role },
      "hotel-1",
      parsed
    );
    return NextResponse.json(formatSuccessResponse(room, "Room created"), { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
