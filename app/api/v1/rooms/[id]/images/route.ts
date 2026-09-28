import { NextRequest, NextResponse } from "next/server";
import { RoomsRepository } from "@/modules/rooms/repository";
import { generateUploadSignature } from "@/lib/cloudinary";
import { decryptSession } from "@/modules/auth/utils";
import { UnauthorizedError } from "@/shared/errors";
import { authorize } from "@/shared/authorization";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    authorize({ id: session.userId, role: session.role }, "room:edit");

    const resolvedParams = await params;
    const { timestamp, signature, folder, apiKey, cloudName } = await generateUploadSignature(`rooms/${resolvedParams.id}`);
    
    return NextResponse.json({ success: true, data: { timestamp, signature, folder, apiKey, cloudName } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    authorize({ id: session.userId, role: session.role }, "room:edit");

    const resolvedParams = await params;
    const body = await req.json();
    const { url, publicId, isPrimary } = body;

    const image = await RoomsRepository.addRoomImage(resolvedParams.id, url, publicId, isPrimary);
    return NextResponse.json({ success: true, data: image }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: error.statusCode || 500 });
  }
}
