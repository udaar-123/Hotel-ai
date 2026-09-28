import { NextRequest, NextResponse } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { CreateStaffSchema } from "@/modules/users/validation";
import { UsersService } from "@/modules/users/service";
import { decryptSession } from "@/modules/auth/utils";
import { UserRole } from "@/modules/auth/types";
import { initializeSubscribers } from "@/shared/events/subscribers";

// Initialize subscribers globally for the API route
initializeSubscribers();

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const url = new URL(req.url);
    const roleParam = url.searchParams.get("role") as UserRole | undefined;

    const users = await UsersService.getStaff({ id: session.userId, role: session.role }, roleParam);
    return formatSuccessResponse(users);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = CreateStaffSchema.parse(body);

    const user = await UsersService.createStaff(
      { id: session.userId, role: session.role },
      { name: parsed.name, email: parsed.email, role: parsed.role }
    );
    return formatSuccessResponse(user, "Staff created successfully");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
