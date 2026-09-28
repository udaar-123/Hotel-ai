import { prisma } from "@/lib/prisma";
import {
  users,
  staff_profiles,
  otp_verifications,
  password_reset_tokens,
} from "@prisma/client";
import { UserRole } from "./types";

export const AuthRepository = {
  async findUserByIdentifier(
    identifier: string,
  ): Promise<(users & { role?: UserRole, staff_profile?: staff_profiles | null }) | null> {
    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
      include: {
        user_roles: {
          include: {
            roles: true,
          },
        },
        staff_profile: true,
      },
    });

    if (!user) return null;

    const roleName = user.user_roles[0]?.roles?.name as UserRole | undefined;

    return {
      ...user,
      role: roleName ?? UserRole.CUSTOMER,
    };
  },

  async findUserById(
    id: string,
  ): Promise<(users & { role?: UserRole, staff_profile?: staff_profiles | null }) | null> {
    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        user_roles: {
          include: {
            roles: true,
          },
        },
        staff_profile: true,
      },
    });

    if (!user) return null;

    const roleName = user.user_roles[0]?.roles?.name as UserRole | undefined;

    return {
      ...user,
      role: roleName ?? UserRole.CUSTOMER,
    };
  },

  async createCustomer(
    identifier: string,
  ): Promise<users & { role: UserRole }> {
    const isEmail = identifier.includes("@");
    const userId = crypto.randomUUID();

    // Create or find CUSTOMER role
    let role = await prisma.roles.findUnique({
      where: { name: UserRole.CUSTOMER },
    });
    if (!role) {
      role = await prisma.roles.create({
        data: {
          id: crypto.randomUUID(),
          name: UserRole.CUSTOMER,
        },
      });
    }

    const user = await prisma.users.create({
      data: {
        id: userId,
        email: isEmail ? identifier : null,
        phone: !isEmail ? identifier : null,
        updatedAt: new Date(),
        user_roles: {
          create: {
            id: crypto.randomUUID(),
            roleId: role.id,
          },
        },
      },
    });

    return { ...user, role: UserRole.CUSTOMER };
  },

  async upsertOtpVerification(
    userId: string,
    identifier: string,
    otpHash: string,
    expiresAt: Date,
  ): Promise<otp_verifications> {
    // Note: The schema doesn't have an identifier on otp_verifications, just userId.
    await prisma.otp_verifications.deleteMany({
      where: { userId },
    });

    return prisma.otp_verifications.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        code: otpHash,
        expiresAt,
      },
    });
  },

  async getOtpVerificationByUserId(
    userId: string,
  ): Promise<otp_verifications | null> {
    return prisma.otp_verifications.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async incrementOtpAttempt(id: string): Promise<void> {
    // Attempt count isn't in this schema.
    // In a real app we might add it or rely on redis rate limiters.
  },

  async deleteOtpVerification(id: string): Promise<void> {
    await prisma.otp_verifications.delete({ where: { id } });
  },

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<password_reset_tokens> {
    await prisma.password_reset_tokens.deleteMany({ where: { userId } });

    return prisma.password_reset_tokens.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt,
      },
    });
  },

  async getPasswordResetToken(
    tokenHash: string,
  ): Promise<(password_reset_tokens & { users: users }) | null> {
    return prisma.password_reset_tokens.findUnique({
      where: { tokenHash },
      include: { users: true },
    });
  },

  async deletePasswordResetToken(id: string): Promise<void> {
    await prisma.password_reset_tokens.delete({ where: { id } });
  },

  async updateUserPassword(
    userId: string,
    passwordHash: string,
  ): Promise<users> {
    return prisma.users.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: new Date() },
    });
  },
};
