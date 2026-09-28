import { NextRequest, NextResponse } from "next/server";
import { RoomsService } from "@/modules/rooms/service";
import { CreateRoomTypeSchema } from "@/modules/rooms/validation";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { formatSuccessResponse } from "@/shared/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    // Anyone logged in can get types
    if (!session) throw new UnauthorizedError();
    
    // For now hardcoding hotelId since it's a single tenant app
    const types = await RoomsService.getRoomTypes("hotel-1");
    return NextResponse.json(formatSuccessResponse(types));
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = CreateRoomTypeSchema.parse(body);

    const type = await RoomsService.createRoomType(
      { id: session.userId, role: session.role },
      "hotel-1",
      parsed
    );
    return NextResponse.json(formatSuccessResponse(type, "Room type created"), { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
