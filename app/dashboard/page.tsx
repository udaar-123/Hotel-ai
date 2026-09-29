"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/ui/NotificationBell";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setProfile(data.data);
        }
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/auth/staff/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 text-white p-8 relative">
      <div className="absolute top-6 right-8">
        <NotificationBell />
      </div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      {profile ? (
        <div className="text-center space-y-4">
          <p className="text-slate-300">Welcome back, {profile.name || profile.email}!</p>
          <p className="text-slate-400 text-sm">Role: <span className="font-mono bg-slate-800 px-2 py-1 rounded">{profile.role}</span></p>
          
          <div className="flex gap-4 justify-center mt-6 flex-wrap">
            <Button onClick={() => router.push("/profile")} variant="outline" className="bg-slate-800 text-white border-slate-700">
              My Profile
            </Button>
            
            {profile.role === "ADMIN" && (
              <Button onClick={() => router.push("/admin/managers")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                Manage Managers
              </Button>
            )}
            
            {(profile.role === "ADMIN" || profile.role === "MANAGER") && (
              <>
                <Button onClick={() => router.push("/manager/staff")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                  Manage Staff
                </Button>
                <Button onClick={() => router.push("/manager/room-types")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                  Room Types
                </Button>
                <Button onClick={() => router.push("/manager/rooms")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                  Rooms Inventory
                </Button>
                <Button onClick={() => router.push("/manager/refunds")} variant="outline" className="bg-orange-600 hover:bg-orange-700 text-white border-0">
                  Refunds Queue
                </Button>
              </>
            )}

            {(profile.role === "ADMIN" || profile.role === "MANAGER" || profile.role === "RECEPTIONIST" || profile.role === "HOUSEKEEPER") && (
              <>
                <Button onClick={() => router.push("/manager/bookings")} variant="outline" className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                  Manage Bookings
                </Button>
                <Button onClick={() => router.push("/manager/board")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                  Status Board
                </Button>
              </>
            )}

            {profile.role === "CUSTOMER" && (
              <>
                <Button onClick={() => router.push("/book")} variant="outline" className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                  Book a Room
                </Button>
                <Button onClick={() => router.push("/bookings")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                  My Bookings
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-slate-400">Loading your information...</p>
      )}

      <div className="mt-8">
        <Button variant="destructive" onClick={handleLogout}>Logout</Button>
      </div>
    </div>
  );
}
