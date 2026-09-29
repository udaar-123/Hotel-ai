import { prisma } from "@/lib/prisma";

export const NotificationsRepository = {
  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    channel: string;
    link?: string;
  }) {
    return prisma.notifications.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
      },
    });
  },

  async getUserNotifications(userId: string) {
    return prisma.notifications.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async markAsRead(notificationId: string) {
    return prisma.notifications.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};
