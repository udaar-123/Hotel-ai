import { NextRequest, NextResponse } from "next/server";
import { generateUploadSignature } from "@/lib/cloudinary";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const folder = `grand-elegance/users/${session.userId}`;
    const sig = generateUploadSignature(folder);
    
    return NextResponse.json({ success: true, data: sig });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
