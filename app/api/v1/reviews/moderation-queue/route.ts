import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { ReviewsRepository } from "@/modules/reviews/repository";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session || !["ADMIN", "MANAGER"].includes(session.role)) throw new UnauthorizedError();

    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    
    const queue = await ReviewsRepository.getPendingReviews(hotel?.id);
    return formatSuccessResponse(queue);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
