import prisma from "@/lib/prisma";
import { RoomStatus } from "./types";

export const RoomsRepository = {
  // Room Types
  async getRoomTypes(hotelId: string) {
    return prisma.room_types.findMany({ where: { hotelId }, orderBy: { name: 'asc' } });
  },

  async getRoomTypeById(id: string) {
    return prisma.room_types.findUnique({ where: { id } });
  },

  async createRoomType(hotelId: string, data: any) {
    return prisma.room_types.create({
      data: { ...data, hotelId },
    });
  },

  async updateRoomType(id: string, data: any) {
    return prisma.room_types.update({
      where: { id },
      data,
    });
  },

  // Rooms
  async getRooms(hotelId: string) {
    return prisma.rooms.findMany({
      where: { hotelId },
      include: {
        room_types: true,
        room_images: true,
      },
      orderBy: { roomNumber: 'asc' }
    });
  },

  async getRoomById(id: string) {
    return prisma.rooms.findUnique({
      where: { id },
      include: {
        room_types: true,
        room_images: true,
      }
    });
  },

  async createRoom(hotelId: string, data: any) {
    return prisma.rooms.create({
      data: {
        hotelId,
        roomNumber: data.roomNumber,
        roomTypeId: data.roomTypeId,
        priceOverride: data.priceOverride,
        isActive: data.isActive,
        status: RoomStatus.AVAILABLE,
      },
      include: { room_types: true }
    });
  },

  async updateRoom(id: string, data: any) {
    return prisma.rooms.update({
      where: { id },
      data,
      include: { room_types: true }
    });
  },

  async addRoomImage(roomId: string, url: string, publicId: string, isPrimary: boolean = false) {
    if (isPrimary) {
      await prisma.room_images.updateMany({
        where: { roomId },
        data: { isPrimary: false }
      });
    }
    return prisma.room_images.create({
      data: { roomId, url, publicId, isPrimary }
    });
  },

  async deleteRoomImage(id: string) {
    return prisma.room_images.delete({ where: { id } });
  },
  
  async getRoomImage(id: string) {
    return prisma.room_images.findUnique({ where: { id } });
  }
};
