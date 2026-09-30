import { UserRole } from "@/modules/auth/types";
import { Permission, RolePermissions } from "./permissions";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors";

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = RolePermissions[role] || [];
  return permissions.includes(permission);
}

export function authorize(
  user: { id?: string; role?: UserRole | string } | null | undefined,
  permission: Permission
): void {
  if (!user) {
    throw new UnauthorizedError("Authentication required.");
  }

  const role = user.role as UserRole;

  if (!hasPermission(role, permission)) {
    throw new ForbiddenError("You do not have permission to perform this action.");
  }
}
