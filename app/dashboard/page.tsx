"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const userRes = await fetch("/api/v1/users/me");
        const userData = await userRes.json();
        if (userData.success) {
          const user = userData.data;
          setProfile(user);

          const role = user.role;
          let combinedData = {};

          if (role === "CUSTOMER") {
            const res = await fetch("/api/v1/dashboard/customer").then(r => r.json());
            if (res.success) combinedData = { ...combinedData, ...res.data };
          }

          if (role === "RECEPTIONIST" || role === "MANAGER" || role === "ADMIN") {
            const res = await fetch("/api/v1/dashboard/receptionist").then(r => r.json());
            if (res.success) combinedData = { ...combinedData, receptionist: res.data };
          }

          if (role === "MANAGER" || role === "ADMIN") {
            const res = await fetch("/api/v1/dashboard/manager").then(r => r.json());
            if (res.success) combinedData = { ...combinedData, manager: res.data };
          }

          if (role === "ADMIN") {
            const res = await fetch("/api/v1/dashboard/admin").then(r => r.json());
            if (res.success) combinedData = { ...combinedData, admin: res.data };
          }
          
          setDashboardData(combinedData);
        }
      } catch (err) {
        console.error("Error loading dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/auth/staff/login");
    router.refresh();
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 w-full max-w-6xl">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
          <CardHeader className="pb-2">
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-slate-700 rounded w-3/4"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-8 relative text-white">
      <div className="absolute top-6 right-8 flex gap-4">
        <NotificationBell />
        <Button variant="destructive" onClick={handleLogout}>Logout</Button>
      </div>

      <div className="w-full max-w-6xl mt-12">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        {loading ? (
          <div className="h-6 w-1/4 bg-slate-800 animate-pulse rounded mb-8"></div>
        ) : (
          <div className="mb-8 flex items-center gap-3">
            <p className="text-slate-300 text-lg">Welcome back, {profile?.name || profile?.email}</p>
            <span className="font-mono bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded text-sm">{profile?.role}</span>
          </div>
        )}

        {loading && renderSkeleton()}

        {!loading && profile && (
          <div className="space-y-8">
            {/* ADMIN METRICS */}
            {profile.role === "ADMIN" && dashboardData.admin && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">Admin Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MetricCard title="Total Platform Revenue" value={`$${dashboardData.admin.totalPlatformRevenue || 0}`} />
                  <MetricCard title="Total Hotels" value={dashboardData.admin.totalHotels} />
                  <MetricCard title="Total Managers" value={dashboardData.admin.totalManagers} />
                </div>
              </div>
            )}

            {/* MANAGER METRICS */}
            {(profile.role === "MANAGER" || profile.role === "ADMIN") && dashboardData.manager && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">Management Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard title="Total Revenue" value={`$${dashboardData.manager.totalRevenue || 0}`} />
                  <MetricCard title="Occupancy Rate" value={`${dashboardData.manager.occupancyRate || 0}%`} />
                  <MetricCard title="Pending Refunds" value={dashboardData.manager.pendingRefunds} />
                  <MetricCard title="Active Staff" value={dashboardData.manager.activeStaff} />
                </div>
              </div>
            )}

            {/* RECEPTIONIST METRICS */}
            {(profile.role === "RECEPTIONIST" || profile.role === "MANAGER" || profile.role === "ADMIN") && dashboardData.receptionist && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">Front Desk Today</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard title="Arrivals" value={dashboardData.receptionist.arrivals} />
                  <MetricCard title="Departures" value={dashboardData.receptionist.departures} />
                  <MetricCard title="Available Rooms" value={dashboardData.receptionist.availableRooms} />
                  <MetricCard title="Occupied Rooms" value={dashboardData.receptionist.occupiedRooms} />
                </div>
              </div>
            )}

            {/* CUSTOMER METRICS & BOOKINGS */}
            {profile.role === "CUSTOMER" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetricCard title="Past Bookings" value={dashboardData.pastBookingsCount || 0} />
                  <Card className="bg-indigo-600/20 border-indigo-500 flex flex-col justify-center items-center p-6 cursor-pointer hover:bg-indigo-600/30 transition" onClick={() => router.push("/book")}>
                    <h3 className="text-xl font-bold text-indigo-300">Book a Room</h3>
                    <p className="text-indigo-200/70 text-sm mt-1">Start your next stay</p>
                  </Card>
                </div>

                <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2 mt-8">Upcoming Bookings</h2>
                {dashboardData.upcomingBookings?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboardData.upcomingBookings.map((booking: any) => (
                      <Card key={booking.id} className="bg-slate-800 border-slate-700">
                        <CardHeader>
                          <CardTitle className="text-lg text-slate-100">{booking.rooms?.room_types?.name || "Room"}</CardTitle>
                          <CardDescription className="text-slate-400">
                            Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-800/50 rounded-lg border border-slate-800">
                    <p className="text-slate-400">No upcoming bookings.</p>
                    <Button onClick={() => router.push("/book")} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                      Book Now
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* QUICK ACTIONS */}
            <div className="pt-8">
              <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4">Quick Actions</h2>
              <div className="flex gap-4 flex-wrap">
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
                    <Button onClick={() => router.push("/manager/reviews")} variant="outline" className="bg-purple-600 hover:bg-purple-700 text-white border-0">
                      Reviews Queue
                    </Button>
                    <Button onClick={() => router.push("/manager/audit")} variant="outline" className="bg-red-900 hover:bg-red-800 text-white border-0">
                      Audit Logs
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

                {(profile.role === "ADMIN" || profile.role === "MANAGER" || profile.role === "HOUSEKEEPER") && (
                  <Button onClick={() => router.push("/housekeeper")} variant="outline" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    Housekeeping Tasks
                  </Button>
                )}
                
                {profile.role === "CUSTOMER" && (
                  <Button onClick={() => router.push("/bookings")} variant="outline" className="bg-slate-800 text-white border-slate-700">
                    View All Bookings
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-100">{value ?? "-"}</div>
      </CardContent>
    </Card>
  );
}
