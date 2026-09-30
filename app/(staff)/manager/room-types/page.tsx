"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const CreateRoomTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, "Price must be positive"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
});
type FormValues = z.infer<typeof CreateRoomTypeSchema>;

export default function RoomTypesPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateRoomTypeSchema) as any,
    defaultValues: { name: "", description: "", basePrice: 100, capacity: 2 },
  });

  const fetchTypes = () => {
    setLoading(true);
    fetch("/api/v1/rooms/types")
      .then(res => res.json())
      .then(data => {
        if (data.success) setTypes(data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openDialog = (type?: any) => {
    if (type) {
      setEditingId(type.id);
      form.reset({ name: type.name, description: type.description || "", basePrice: type.basePrice, capacity: type.capacity });
    } else {
      setEditingId(null);
      form.reset({ name: "", description: "", basePrice: 100, capacity: 2 });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const url = editingId ? `/api/v1/rooms/types/${editingId}` : "/api/v1/rooms/types";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message);
      }
      setIsDialogOpen(false);
      fetchTypes();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Room Types</h1>
        <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700">
          + Create Room Type
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Room Type" : "Create Room Type"}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input {...form.register("name")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea {...form.register("description")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input type="number" {...form.register("basePrice")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">Capacity</label>
                  <input type="number" {...form.register("capacity")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
                </div>
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
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Base Price</th>
              <th className="p-4 font-medium">Capacity</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
            ) : types.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-slate-400">No room types found</td></tr>
            ) : (
              types.map(t => (
                <tr key={t.id} className="border-t border-slate-700/50">
                  <td className="p-4 font-medium">{t.name}</td>
                  <td className="p-4">${t.basePrice}</td>
                  <td className="p-4">{t.capacity} Guests</td>
                  <td className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openDialog(t)} className="bg-slate-700 hover:bg-slate-600 border-0">Edit</Button>
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
