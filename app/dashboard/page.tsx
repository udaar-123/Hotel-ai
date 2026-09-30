"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { 
  Building2, 
  Users, 
  BedDouble, 
  CreditCard, 
  Star, 
  FileText, 
  CalendarCheck, 
  LayoutDashboard,
  LogOut,
  User,
  Sparkles,
  ClipboardList
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const fetchDashboardData = async () => {
    const userRes = await fetch("/api/v1/users/me");
    if (!userRes.ok) throw new Error("Not logged in");
    const userData = await userRes.json();
    const profile = userData.data;
    const role = profile.role;
    
    let fetchedData: any = {};
    if (role === "CUSTOMER") {
      const res = await fetch("/api/v1/dashboard/customer");
      fetchedData = (await res.json()).data;
    } else {
      if (role === "RECEPTIONIST" || role === "MANAGER" || role === "ADMIN") {
        const rRes = await fetch("/api/v1/dashboard/receptionist");
        fetchedData.receptionist = (await rRes.json()).data;
      }
      if (role === "MANAGER" || role === "ADMIN") {
        const mRes = await fetch("/api/v1/dashboard/manager");
        fetchedData.manager = (await mRes.json()).data;
      }
      if (role === "ADMIN") {
        const aRes = await fetch("/api/v1/dashboard/admin");
        fetchedData.admin = (await aRes.json()).data;
      }
    }
    return { profile, dashboardData: fetchedData };
  };

  const { data, error, isLoading } = useSWR('dashboardData', fetchDashboardData, {
    revalidateOnFocus: true,
  });

  if (error) {
    router.push("/auth/customer/login");
  }

  const profile = data?.profile;
  const dashboardData = data?.dashboardData;
  const loading = isLoading || !data;

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/auth/customer/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-serif italic">Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  const SidebarButton = ({ icon: Icon, label, onClick, active = false }: any) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        active 
        ? 'bg-gray-900 text-white shadow-md' 
        : 'text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900'
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 2} />
      <span className="font-medium text-[14px]">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F9F8F4] via-[#F4F1EA] to-[#EAE5D9] flex text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-[#FAF9F6]/80 backdrop-blur-xl border-r border-[#E5E0D8] shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col h-screen sticky top-0 shrink-0">
        <div className="p-8 border-b border-[#E5E0D8]/60">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-gray-900" />
            <h2 className="text-xl font-serif font-bold tracking-tight text-gray-900">Grand Elegance</h2>
          </div>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-semibold">Management System</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">Quick Actions</h3>
          <div className="flex flex-col gap-1.5">
            <SidebarButton icon={LayoutDashboard} label="Dashboard" active={true} onClick={() => {}} />
            <SidebarButton icon={User} label="My Profile" onClick={() => router.push("/profile")} />

            {profile.role === "ADMIN" && (
              <SidebarButton icon={Users} label="Manage Managers" onClick={() => router.push("/admin/managers")} />
            )}

            {(profile.role === "ADMIN" || profile.role === "MANAGER") && (
              <>
                <SidebarButton icon={Users} label="Manage Staff" onClick={() => router.push("/manager/staff")} />
                <SidebarButton icon={BedDouble} label="Room Types" onClick={() => router.push("/manager/room-types")} />
                <SidebarButton icon={Building2} label="Inventory" onClick={() => router.push("/manager/rooms")} />
                <SidebarButton icon={CreditCard} label="Refunds Queue" onClick={() => router.push("/manager/refunds")} />
                <SidebarButton icon={Star} label="Reviews Queue" onClick={() => router.push("/manager/reviews")} />
                <SidebarButton icon={FileText} label="Audit Logs" onClick={() => router.push("/manager/audit")} />
                <SidebarButton icon={ClipboardList} label="Reports" onClick={() => router.push("/manager/reports")} />
              </>
            )}

            {(profile.role === "ADMIN" || profile.role === "MANAGER" || profile.role === "RECEPTIONIST" || profile.role === "HOUSEKEEPER") && (
              <>
                <SidebarButton icon={CalendarCheck} label="Manage Bookings" onClick={() => router.push("/manager/bookings")} />
                <SidebarButton icon={LayoutDashboard} label="Status Board" onClick={() => router.push("/manager/board")} />
              </>
            )}

            {(profile.role === "ADMIN" || profile.role === "MANAGER" || profile.role === "HOUSEKEEPER") && (
              <SidebarButton icon={Sparkles} label="Housekeeping" onClick={() => router.push("/housekeeper")} />
            )}
            
            {profile.role === "CUSTOMER" && (
              <SidebarButton icon={CalendarCheck} label="View Bookings" onClick={() => router.push("/bookings")} />
            )}
          </div>
        </div>

        <div className="p-6 border-t border-[#E5E0D8]/60 bg-white/30">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-serif font-bold shadow-sm overflow-hidden border-2 border-white">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile.name?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile.role.toLowerCase()}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-full bg-white border-[#E5E0D8] text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-sm flex items-center justify-center gap-2">
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-8 lg:p-12 relative overflow-y-auto">
        <div className="absolute top-8 right-8 lg:top-12 lg:right-12 z-10">
          <NotificationBell />
        </div>

        <div className="max-w-5xl mx-auto space-y-10 pb-20">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-serif font-bold text-gray-900 tracking-tight">Overview</h1>
            <p className="text-gray-500 text-lg">Welcome back, {profile?.name}</p>
          </div>

          {/* ADMIN METRICS */}
          {profile.role === "ADMIN" && dashboardData.admin && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-semibold text-gray-900 flex items-center gap-2">
                <Building2 size={20} className="text-gray-400" /> System Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MetricCard title="Total Revenue" value={`$${dashboardData.admin.totalPlatformRevenue || 0}`} />
                <MetricCard title="Total Hotels" value={dashboardData.admin.totalHotels} />
                <MetricCard title="Total Managers" value={dashboardData.admin.totalManagers} />
              </div>
            </div>
          )}

          {/* MANAGER METRICS */}
          {(profile.role === "MANAGER" || profile.role === "ADMIN") && dashboardData.manager && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList size={20} className="text-gray-400" /> Management Pulse
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard title="Revenue" value={`$${dashboardData.manager.totalRevenue || 0}`} highlight />
                <MetricCard title="Occupancy Rate" value={`${dashboardData.manager.occupancyRate || 0}%`} />
                <MetricCard title="Pending Refunds" value={dashboardData.manager.pendingRefunds} />
                <MetricCard title="Active Staff" value={dashboardData.manager.activeStaff} />
              </div>
            </div>
          )}

          {/* RECEPTIONIST METRICS */}
          {(profile.role === "RECEPTIONIST" || profile.role === "MANAGER" || profile.role === "ADMIN") && dashboardData.receptionist && (
            <div className="space-y-4">
              <h2 className="text-lg font-serif font-semibold text-gray-900 flex items-center gap-2">
                <CalendarCheck size={20} className="text-gray-400" /> Front Desk Today
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard title="Arrivals" value={dashboardData.receptionist.arrivals} />
                <MetricCard title="Departures" value={dashboardData.receptionist.departures} />
                <MetricCard title="Available Rooms" value={dashboardData.receptionist.availableRooms} />
                <MetricCard title="Occupied Rooms" value={dashboardData.receptionist.occupiedRooms} />
              </div>
            </div>
          )}

          {/* CUSTOMER METRICS & BOOKINGS */}
          {profile.role === "CUSTOMER" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <MetricCard title="Past Bookings" value={dashboardData.pastBookingsCount || 0} />
                <Card 
                  className="bg-gray-900 text-white border-0 shadow-xl flex flex-col justify-center items-center p-8 cursor-pointer hover:bg-gray-800 transition-all hover:-translate-y-1 group" 
                  onClick={() => router.push("/book")}
                >
                  <h3 className="text-2xl font-serif font-bold mb-2 group-hover:scale-105 transition-transform">Book a Room</h3>
                  <p className="text-gray-400 text-sm">Experience true luxury</p>
                </Card>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-serif font-semibold text-gray-900">Upcoming Bookings</h2>
                {dashboardData.upcomingBookings?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {dashboardData.upcomingBookings.map((booking: any) => (
                      <Card key={booking.id} className="bg-white/80 backdrop-blur-md border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                        <CardHeader>
                          <CardTitle className="text-lg font-serif text-gray-900">{booking.rooms?.room_types?.name || "Room"}</CardTitle>
                          <CardDescription className="text-gray-500 font-medium mt-1">
                            Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-white/60 backdrop-blur-sm rounded-2xl border border-[#E5E0D8]/60 shadow-sm">
                    <p className="text-gray-500 font-serif italic mb-4">You have no upcoming reservations.</p>
                    <Button onClick={() => router.push("/book")} className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-8">
                      Book Your Stay
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, highlight = false }: { title: string; value: string | number, highlight?: boolean }) {
  return (
    <Card className={`border-white/60 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] ${highlight ? 'bg-white' : 'bg-white/70'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] uppercase tracking-wider font-bold text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-serif font-bold text-gray-900">{value ?? "-"}</div>
      </CardContent>
    </Card>
  );
}
