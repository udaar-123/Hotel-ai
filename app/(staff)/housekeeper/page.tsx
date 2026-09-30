"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Room = {
  id: string;
  roomNumber: string;
  status: string;
  room_types?: {
    name: string;
  };
};

export default function HousekeeperDashboard() {
  const { data: resData, error: swrError, isLoading: loading, mutate: fetchRooms } = useSWR("/api/v1/rooms/housekeeping-queue", fetcher);
  const rooms = resData?.data || [];
  const error = swrError?.message || null;

  const updateStatus = async (roomId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      // Refetch the queue after successful update
      await fetchRooms();
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Housekeeping Tasks</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {rooms.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-gray-500 text-lg">No rooms in the queue right now.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => (
          <div 
            key={room.id || room.roomNumber} 
            className="border rounded-xl p-5 shadow-sm bg-white flex flex-col justify-between"
          >
            <div className="mb-5">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-gray-900">Room {room.roomNumber}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                  ${room.status === 'CHECKED_OUT' ? 'bg-orange-100 text-orange-800' : ''}
                  ${room.status === 'CLEANING' ? 'bg-blue-100 text-blue-800' : ''}
                  ${room.status === 'MAINTENANCE' ? 'bg-red-100 text-red-800' : ''}
                  ${!['CHECKED_OUT', 'CLEANING', 'MAINTENANCE'].includes(room.status) ? 'bg-gray-100 text-gray-800' : ''}
                `}>
                  {room.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-600 font-medium">
                {room.room_types?.name || "Standard Room"}
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              {room.status === "CHECKED_OUT" && (
                <button
                  onClick={() => updateStatus(room.id, "CLEANING")}
                  className="w-full py-4 px-4 bg-black hover:bg-gray-800 active:bg-blue-800 text-white rounded-xl font-bold text-lg shadow-sm transition-colors"
                >
                  Start Cleaning
                </button>
              )}

              {room.status === "CLEANING" && (
                <>
                  <button
                    onClick={() => updateStatus(room.id, "AVAILABLE")}
                    className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl font-bold text-lg shadow-sm transition-colors"
                  >
                    Mark Clean & Available
                  </button>
                  <button
                    onClick={() => updateStatus(room.id, "MAINTENANCE")}
                    className="w-full py-4 px-4 bg-orange-100 hover:bg-orange-200 active:bg-orange-300 text-orange-800 rounded-xl font-bold text-lg transition-colors"
                  >
                    Report Maintenance
                  </button>
                </>
              )}

              {room.status === "MAINTENANCE" && (
                <button
                  onClick={() => updateStatus(room.id, "AVAILABLE")}
                  className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-xl font-bold text-lg shadow-sm transition-colors"
                >
                  Maintenance Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
