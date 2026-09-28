import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { UpdateStaffSchema } from "@/modules/users/validation";
import { UsersService } from "@/modules/users/service";
import { decryptSession } from "@/modules/auth/utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();

    const resolvedParams = await params;
    const body = await req.json();
    const parsed = UpdateStaffSchema.parse(body);

    const user = await UsersService.updateStaff(
      { id: session.userId, role: session.role },
      resolvedParams.id,
      { name: parsed.name, deactivated: parsed.deactivated }
    );
    return formatSuccessResponse(user, "Staff updated successfully");
  } catch (error) {
    return formatErrorResponse(error);
  }
}
