import { NextRequest, NextResponse } from "next/server";
import { RoomsService } from "@/modules/rooms/service";
import { UpdateRoomTypeSchema } from "@/modules/rooms/validation";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { formatSuccessResponse } from "@/shared/errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const body = await req.json();
    const parsed = UpdateRoomTypeSchema.parse(body);

    const type = await RoomsService.updateRoomType(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      parsed
    );
    return formatSuccessResponse(type, "Room type updated");
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
