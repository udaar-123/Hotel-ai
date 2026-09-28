"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  roomTypeId: z.string().uuid("Room type is required"),
  priceOverride: z.coerce.number().min(0).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof CreateRoomSchema>;

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateRoomSchema),
    defaultValues: { roomNumber: "", roomTypeId: "", priceOverride: "", isActive: true },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/v1/rooms"),
        fetch("/api/v1/rooms/types")
      ]);
      const rData = await rRes.json();
      const tData = await tRes.json();
      if (rData.success) setRooms(rData.data);
      if (tData.success) setTypes(tData.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openDialog = (room?: any) => {
    if (room) {
      setEditingId(room.id);
      form.reset({ roomNumber: room.roomNumber, roomTypeId: room.roomTypeId, priceOverride: room.priceOverride ?? "", isActive: room.isActive });
    } else {
      setEditingId(null);
      form.reset({ roomNumber: "", roomTypeId: types[0]?.id || "", priceOverride: "", isActive: true });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = { ...data, priceOverride: data.priceOverride === "" ? null : data.priceOverride };
      const url = editingId ? `/api/v1/rooms/${editingId}` : "/api/v1/rooms";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message);
      }
      setIsDialogOpen(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rooms Inventory</h1>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700">
          + Create Room
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Room" : "Create Room"}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Room Number</label>
                <input {...form.register("roomNumber")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div>
                <label className="block text-sm mb-1">Room Type</label>
                <select {...form.register("roomTypeId")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white">
                  {types.map(t => <option key={t.id} value={t.id}>{t.name} (${t.basePrice})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Price Override ($) (Optional)</label>
                <input type="number" {...form.register("priceOverride")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...form.register("isActive")} id="isActive" />
                <label htmlFor="isActive" className="text-sm">Active</label>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-slate-700 hover:bg-slate-600 border-0">Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">{editingId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="p-4 font-medium">Room #</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Price</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>
            ) : rooms.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-400">No rooms found</td></tr>
            ) : (
              rooms.map(r => (
                <tr key={r.id} className="border-t border-slate-700/50">
                  <td className="p-4 font-medium">{r.roomNumber} {!r.isActive && <span className="text-xs text-red-400">(Inactive)</span>}</td>
                  <td className="p-4">{r.room_types?.name}</td>
                  <td className="p-4">{r.status}</td>
                  <td className="p-4">${r.priceOverride ?? r.room_types?.basePrice}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/manager/rooms/${r.id}/images`)} className="bg-slate-700 hover:bg-slate-600 border-0">Images ({r.room_images?.length || 0})</Button>
                    <Button variant="outline" size="sm" onClick={() => openDialog(r)} className="bg-slate-700 hover:bg-slate-600 border-0">Edit</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
