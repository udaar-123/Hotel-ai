import { prisma } from "@/lib/prisma";
import { UserRole } from "@/modules/auth/types";
import { UserProfile } from "./types";

export const UsersRepository = {
  async getStaffByRoles(roles: UserRole[]): Promise<UserProfile[]> {
    const roleRecords = await prisma.roles.findMany({
      where: { name: { in: roles } },
    });
    const roleIds = roleRecords.map((r) => r.id);

    const usersList = await prisma.users.findMany({
      where: {
        user_roles: {
          some: { roleId: { in: roleIds } },
        },
      },
      include: {
        user_roles: { include: { roles: true } },
        staff_profile: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return usersList.map(this.mapToProfile);
  },

  async createUser(
    data: { id: string; email: string; name: string; passwordHash: string },
    role: UserRole,
    creatorId: string
  ) {
    const roleRecord = await prisma.roles.findUnique({
      where: { name: role },
    });

    if (!roleRecord) throw new Error(`Role ${role} not found`);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: {
          id: data.id,
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          updatedAt: new Date(),
          user_roles: {
            create: {
              id: crypto.randomUUID(),
              roleId: roleRecord.id,
            },
          },
          staff_profile: {
            create: {
              id: crypto.randomUUID(),
              mustChangePassword: true,
              createdByUserId: creatorId,
            },
          },
        },
        include: {
          user_roles: { include: { roles: true } },
          staff_profile: true,
        },
      });
      return u;
    }, { maxWait: 10000, timeout: 20000 });
    
    return this.mapToProfile(user);
  },

  async updateStaff(id: string, data: { name?: string; deactivatedAt?: Date | null }) {
    return prisma.$transaction(async (tx) => {
      if (data.name !== undefined) {
        await tx.users.update({
          where: { id },
          data: { name: data.name, updatedAt: new Date() },
        });
      }
      
      if (data.deactivatedAt !== undefined) {
        await tx.staff_profiles.update({
          where: { userId: id },
          data: { deactivatedAt: data.deactivatedAt },
        });
      }
      
      const user = await tx.users.findUnique({
        where: { id },
        include: {
          user_roles: { include: { roles: true } },
          staff_profile: true,
        },
      });
      return this.mapToProfile(user as any);
    }, { maxWait: 10000, timeout: 20000 });
  },

  async updateProfile(id: string, data: { name?: string; phone?: string }) {
    const user = await prisma.users.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        updatedAt: new Date(),
      },
      include: {
        user_roles: { include: { roles: true } },
        staff_profile: true,
      },
    });
    return this.mapToProfile(user);
  },

  mapToProfile(user: any): UserProfile {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.user_roles?.[0]?.roles?.name as UserRole,
      deactivatedAt: user.staff_profile?.deactivatedAt || null,
      createdAt: user.createdAt,
    };
  },
};
