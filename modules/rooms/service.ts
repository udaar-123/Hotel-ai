import { RoomsRepository } from "./repository";
import { RoomStatus } from "./types";
import { RoomEvents } from "./events";
import { EventBus } from "@/shared/events";
import { authorize } from "@/shared/authorization";
import { ApiError } from "@/shared/errors";
import { UserRole } from "@/modules/auth/types";

// State machine for room status
const VALID_TRANSITIONS: Record<string, string[]> = {
  [RoomStatus.AVAILABLE]: [RoomStatus.BOOKED, RoomStatus.MAINTENANCE],
  [RoomStatus.BOOKED]: [RoomStatus.OCCUPIED, RoomStatus.AVAILABLE],
  [RoomStatus.OCCUPIED]: [RoomStatus.CHECKED_OUT],
  [RoomStatus.CHECKED_OUT]: [RoomStatus.CLEANING],
  [RoomStatus.CLEANING]: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE],
  [RoomStatus.MAINTENANCE]: [RoomStatus.AVAILABLE],
};

export const RoomsService = {
  // Types
  async getRoomTypes(hotelId: string) {
    return RoomsRepository.getRoomTypes(hotelId);
  },
  async createRoomType(currentUser: { id: string; role: UserRole }, hotelId: string, data: any) {
    authorize(currentUser, "room:create");
    return RoomsRepository.createRoomType(hotelId, data);
  },
  async updateRoomType(currentUser: { id: string; role: UserRole }, id: string, data: any) {
    authorize(currentUser, "room:edit");
    return RoomsRepository.updateRoomType(id, data);
  },

  // Rooms
  async getRooms(hotelId: string) {
    return RoomsRepository.getRooms(hotelId);
  },
  async getRoomById(id: string) {
    const room = await RoomsRepository.getRoomById(id);
    if (!room) throw new ApiError(404, "Room not found");
    return room;
  },
  async createRoom(currentUser: { id: string; role: UserRole }, hotelId: string, data: any) {
    authorize(currentUser, "room:create");
    const roomType = await RoomsRepository.getRoomTypeById(data.roomTypeId);
    if (!roomType) throw new ApiError(404, "Room type not found");

    const room = await RoomsRepository.createRoom(hotelId, data);
    EventBus.emit(RoomEvents.ROOM_CREATED, { room });
    return room;
  },
  async updateRoom(currentUser: { id: string; role: UserRole }, id: string, data: any) {
    authorize(currentUser, "room:edit");
    const existing = await RoomsRepository.getRoomById(id);
    if (!existing) throw new ApiError(404, "Room not found");
    
    // Status can only be updated via changeStatus
    if (data.status) delete data.status;

    const room = await RoomsRepository.updateRoom(id, data);
    EventBus.emit(RoomEvents.ROOM_UPDATED, { room });
    return room;
  },

  async changeRoomStatus(currentUser: { id: string; role: UserRole }, id: string, newStatus: RoomStatus) {
    authorize(currentUser, "room:status:update");

    const room = await RoomsRepository.getRoomById(id);
    if (!room) throw new ApiError(404, "Room not found");

    const currentStatus = room.status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    
    if (!allowedNext.includes(newStatus)) {
      throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    const updated = await RoomsRepository.updateRoom(id, { status: newStatus });
    EventBus.emit(RoomEvents.ROOM_STATUS_CHANGED, { room: updated, oldStatus: currentStatus, newStatus });
    return updated;
  }
};
