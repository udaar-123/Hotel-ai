import { UserRole } from "@/modules/auth/types";

export type Permission =
  | "room:create"
  | "room:edit"
  | "room:delete"
  | "room:status:update"
  | "booking:create:offline"
  | "booking:cancel:any"
  | "refund:approve"
  | "staff:create:manager"
  | "staff:create:staff"
  | "audit:view:all"
  | "audit:view:scoped"
  | "housekeeping:view";

export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    "room:create",
    "room:edit",
    "room:delete",
    "room:status:update",
    "booking:create:offline",
    "booking:cancel:any",
    "refund:approve",
    "staff:create:manager",
    "staff:create:staff",
    "audit:view:all",
    "audit:view:scoped",
    "housekeeping:view",
  ],
  [UserRole.MANAGER]: [
    "room:create",
    "room:edit",
    "room:delete",
    "room:status:update",
    "booking:create:offline",
    "booking:cancel:any",
    "refund:approve",
    "staff:create:staff",
    "audit:view:scoped",
    "housekeeping:view",
  ],
  [UserRole.RECEPTIONIST]: [
    "room:status:update",
    "booking:create:offline",
  ],
  [UserRole.HOUSEKEEPER]: [
    "room:status:update",
    "housekeeping:view",
  ],
  [UserRole.CUSTOMER]: [],
};
