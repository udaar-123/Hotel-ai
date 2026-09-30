import { NextRequest } from "next/server";
import { formatSuccessResponse, formatErrorResponse, UnauthorizedError } from "@/shared/errors";
import { AuditService } from "@/modules/audit/service";
import { decryptSession } from "@/modules/auth/utils";
import { authorize } from "@/shared/authorization";

export async function GET(req: NextRequest) {
  try {
    const session = await decryptSession(req.cookies.get("session")?.value);
    if (!session) throw new UnauthorizedError();
    
    // Both ADMIN and MANAGER can view some subset of audit logs
    authorize({ id: session.userId, role: session.role }, "audit:view:scoped");

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || undefined;
    
    const logs = await AuditService.getAuditLogs(session.role, { action });
    return formatSuccessResponse(logs);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
