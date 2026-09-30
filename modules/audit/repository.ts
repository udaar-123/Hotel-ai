import { prisma } from "@/lib/prisma";

export const AuditRepository = {
  async logAction(data: {
    userId: string;
    action: string;
    targetTable: string;
    oldValue?: string | null;
    newValue?: string | null;
  }) {
    return prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
      }
    });
  },

  async getAuditLogs(filters?: { action?: string; limit?: number }) {
    return prisma.audit_logs.findMany({
      where: {
        ...(filters?.action ? { action: filters.action } : {}),
      },
      take: filters?.limit || 50,
      orderBy: { createdAt: "desc" },
      include: {
        users: { select: { name: true, email: true } }
      }
    });
  }
};
