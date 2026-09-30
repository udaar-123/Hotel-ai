import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { ReviewsService } from "@/modules/reviews/service";
import { decryptSession } from "@/modules/auth/utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    
    const body = await req.json(); // { action: "PUBLISHED" | "REJECTED" }
    const resolvedParams = await params;

    const review = await ReviewsService.moderateReview(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      body.action
    );

    return formatSuccessResponse(review, `Review ${body.action.toLowerCase()} successfully`);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
