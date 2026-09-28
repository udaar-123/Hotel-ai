import { NextRequest, NextResponse } from "next/server";
import { RoomsRepository } from "@/modules/rooms/repository";
import { deleteImage } from "@/lib/cloudinary";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { authorize } from "@/shared/authorization";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    authorize({ id: session.userId, role: session.role }, "room:edit");

    const resolvedParams = await params;
    const image = await RoomsRepository.getRoomImage(resolvedParams.imageId);
    if (!image) throw new Error("Image not found");

    // Delete from Cloudinary
    await deleteImage(image.publicId);
    
    // Delete from DB
    await RoomsRepository.deleteRoomImage(resolvedParams.imageId);

    return NextResponse.json({ success: true, message: "Image deleted" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
