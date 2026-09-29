import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { decryptSession } from "@/modules/auth/utils";
import { authorize } from "@/shared/authorization";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    
    // Authorize explicitly for housekeeping view
    authorize({ id: session.userId, role: session.role }, "housekeeping:view");

    const { prisma } = await import("@/lib/prisma");

    const queue = await prisma.rooms.findMany({
      where: {
        status: { in: ["CHECKED_OUT", "CLEANING", "MAINTENANCE"] }
      },
      include: {
        room_types: true,
      },
      orderBy: { updatedAt: "asc" } // Oldest state changes first
    });

    return formatSuccessResponse(queue);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
