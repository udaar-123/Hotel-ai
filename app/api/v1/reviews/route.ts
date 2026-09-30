import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { ReviewsService } from "@/modules/reviews/service";
import { ReviewsRepository } from "@/modules/reviews/repository";
import { decryptSession } from "@/modules/auth/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session || session.role !== "CUSTOMER") throw new UnauthorizedError();

    const body = await req.json();
    const review = await ReviewsService.submitReview(session.userId, {
      bookingId: body.bookingId,
      rating: body.rating,
      comment: body.comment
    });

    return formatSuccessResponse(review, "Review submitted and pending moderation");
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const hotel = await prisma.hotels.findFirst();
    if (!hotel) throw new Error("Hotel not found");

    const reviews = await ReviewsRepository.getPublishedReviews(hotel.id);
    return formatSuccessResponse(reviews);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
