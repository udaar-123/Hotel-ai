import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError, ValidationError } from "@/shared/errors";
import { BookingsService } from "@/modules/bookings/service";
import { decryptSession } from "@/modules/auth/utils";
import { generateUploadSignature } from "@/lib/cloudinary";
import { z } from "zod";

const AddIdentityDocSchema = z.object({
  url: z.string().url(),
  publicId: z.string(),
  documentType: z.string()
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    const resolvedParams = await params;

    // Check if user has access to booking
    await BookingsService.getBookingById({ id: session.userId, role: session.role }, resolvedParams.id);

    const sig = await generateUploadSignature(`booking_docs/${resolvedParams.id}`);
    return formatSuccessResponse(sig);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    const resolvedParams = await params;

    const body = await req.json();
    const parsed = AddIdentityDocSchema.parse(body);

    const doc = await BookingsService.addIdentityDocument(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      parsed.url,
      parsed.publicId,
      parsed.documentType
    );

    return formatSuccessResponse(doc, "Identity document uploaded");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
// rebuild 

// trigger rebuild
