import { NextRequest, NextResponse } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { ChangePasswordSchema } from "@/modules/users/validation";
import { AuthService } from "@/modules/auth/service";
import { decryptSession } from "@/modules/auth/utils";

const SESSION_COOKIE = 'session';

export async function POST(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) throw new UnauthorizedError();

    const body = await req.json();
    const parsed = ChangePasswordSchema.parse(body);

    const newToken = await AuthService.changePassword(session.userId, parsed.password);

    const response = NextResponse.json({ success: true, message: "Password updated successfully" });
    
    response.cookies.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    return formatErrorResponse(error);
  }
}
