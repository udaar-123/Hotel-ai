import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { UpdateProfileSchema } from "@/modules/users/validation";
import { UsersService } from "@/modules/users/service";
import { decryptSession } from "@/modules/auth/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const profile = await UsersService.getProfile(session.userId);
    return formatSuccessResponse(profile);
  } catch (error) {
    return formatErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = UpdateProfileSchema.parse(body);

    const profile = await UsersService.updateProfile(session.userId, parsed);
    return formatSuccessResponse(profile, "Profile updated successfully");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
