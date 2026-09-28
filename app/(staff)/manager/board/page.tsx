"use client";
import { useState, useEffect } from "react";
import { RoomStatus } from "@/modules/rooms/types";
import { Button } from "@/components/ui/button";

export default function RoomBoardPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = () => {
    setLoading(true);
    fetch("/api/v1/rooms")
      .then(res => res.json())
      .then(data => {
        if (data.success) setRooms(data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRooms(); }, []);

  const changeStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/rooms/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error?.message || "Failed to update status");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case RoomStatus.AVAILABLE: return "bg-green-500/20 text-green-400 border-green-500/50";
      case RoomStatus.BOOKED: return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case RoomStatus.OCCUPIED: return "bg-purple-500/20 text-purple-400 border-purple-500/50";
      case RoomStatus.CHECKED_OUT: return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case RoomStatus.CLEANING: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      case RoomStatus.MAINTENANCE: return "bg-red-500/20 text-red-400 border-red-500/50";
      default: return "bg-slate-800 text-slate-400";
    }
  };

  const getNextStatuses = (status: string) => {
    switch (status) {
      case RoomStatus.AVAILABLE: return [RoomStatus.BOOKED, RoomStatus.MAINTENANCE];
      case RoomStatus.BOOKED: return [RoomStatus.OCCUPIED, RoomStatus.AVAILABLE];
      case RoomStatus.OCCUPIED: return [RoomStatus.CHECKED_OUT];
      case RoomStatus.CHECKED_OUT: return [RoomStatus.CLEANING];
      case RoomStatus.CLEANING: return [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE];
      case RoomStatus.MAINTENANCE: return [RoomStatus.AVAILABLE];
      default: return [];
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Room Status Board</h1>
        <Button onClick={fetchRooms} variant="outline" className="bg-slate-800 text-white border-slate-700">Refresh</Button>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map(room => (
            <div key={room.id} className={`p-4 rounded-xl border ${getStatusColor(room.status)}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{room.roomNumber}</h3>
                  <p className="text-sm opacity-80">{room.room_types?.name}</p>
                </div>
                {!room.isActive && <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">Inactive</span>}
              </div>
              
              <div className="mb-4">
                <span className="text-xs font-mono uppercase tracking-wider">{room.status.replace('_', ' ')}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {getNextStatuses(room.status).map(next => (
                  <Button 
                    key={next} 
                    size="sm" 
                    variant="outline" 
                    className="text-xs border-current bg-transparent hover:bg-white/10 text-inherit"
                    onClick={() => changeStatus(room.id, next)}
                  >
                    &rarr; {next.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          {rooms.length === 0 && <p className="col-span-full text-slate-400">No rooms found.</p>}
        </div>
      )}
    </div>
  );
}
