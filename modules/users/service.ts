import { UsersRepository } from "./repository";
import { UserRole } from "@/modules/auth/types";
import { hashPassword, generateRandomToken } from "@/modules/auth/utils";
import { AuthRepository } from "@/modules/auth/repository";
import { ApiError } from "@/shared/errors";
import { authorize } from "@/shared/authorization";

import { EventBus, Events } from "@/shared/events";

export const UsersService = {
  async getStaff(currentUser: { id: string; role: UserRole }, roleFilter?: UserRole) {
    if (roleFilter === UserRole.MANAGER) {
      authorize(currentUser, "staff:create:manager");
      return UsersRepository.getStaffByRoles([UserRole.MANAGER]);
    } else {
      authorize(currentUser, "staff:create:staff");
      return UsersRepository.getStaffByRoles([UserRole.RECEPTIONIST, UserRole.HOUSEKEEPER]);
    }
  },

  async createStaff(
    currentUser: { id: string; role: UserRole },
    data: { name: string; email: string; role: UserRole }
  ) {
    // RBAC
    if (data.role === UserRole.MANAGER) {
      authorize(currentUser, "staff:create:manager");
    } else if (data.role === UserRole.RECEPTIONIST || data.role === UserRole.HOUSEKEEPER) {
      authorize(currentUser, "staff:create:staff");
    } else {
      throw new ApiError(400, "Invalid role for staff creation");
    }

    // Check existing
    const existing = await AuthRepository.findUserByIdentifier(data.email);
    if (existing) {
      throw new ApiError(409, "User with this email already exists");
    }

    const tempPassword = generateRandomToken().slice(0, 8);
    const passwordHash = await hashPassword(tempPassword);
    
    const user = await UsersRepository.createUser(
      { id: crypto.randomUUID(), email: data.email, name: data.name, passwordHash },
      data.role,
      currentUser.id
    );

    EventBus.emit(Events.STAFF_CREATED, { user, tempPassword });

    return user;
  },

  async updateStaff(
    currentUser: { id: string; role: UserRole },
    id: string,
    data: { name?: string; deactivated?: boolean }
  ) {
    const target = await AuthRepository.findUserById(id);
    if (!target) throw new ApiError(404, "User not found");

    if (target.role === UserRole.MANAGER) {
      authorize(currentUser, "staff:create:manager");
    } else {
      authorize(currentUser, "staff:create:staff");
    }

    const deactivatedAt = data.deactivated === true ? new Date() : (data.deactivated === false ? null : undefined);
    
    const updated = await UsersRepository.updateStaff(id, { name: data.name, deactivatedAt });
    
    if (data.deactivated === true) {
       EventBus.emit(Events.STAFF_DEACTIVATED, { user: updated });
    }

    return updated;
  },

  async getProfile(userId: string) {
    const user = await AuthRepository.findUserById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return UsersRepository.mapToProfile(user);
  },

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    return UsersRepository.updateProfile(userId, data);
  }
};
