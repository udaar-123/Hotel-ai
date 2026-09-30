"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CreateRoomTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  basePrice: z.coerce.number().min(0, "Price must be positive"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
});
type FormValues = z.infer<typeof CreateRoomTypeSchema>;

export default function RoomTypesPage() {
  const { data: resData, error, isLoading: loading, mutate } = useSWR("/api/v1/rooms/types", fetcher);
  const types = resData?.data || [];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateRoomTypeSchema) as any,
    defaultValues: { name: "", description: "", basePrice: 100, capacity: 2 },
  });

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
      mutate();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Room Types</h1>
        <Button onClick={() => openDialog()} className="bg-black hover:bg-gray-800">
          + Create Room Type
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full border border-gray-200">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Room Type" : "Create Room Type"}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input {...form.register("name")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea {...form.register("description")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm mb-1">Base Price ($)</label>
                  <input type="number" {...form.register("basePrice")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm mb-1">Capacity</label>
                  <input type="number" {...form.register("capacity")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 border-0">Cancel</Button>
                <Button type="submit" className="bg-black hover:bg-gray-800">{editingId ? "Save" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
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
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No room types found</td></tr>
            ) : (
              types.map(t => (
                <tr key={t.id} className="border-t border-gray-200/50">
                  <td className="p-4 font-medium">{t.name}</td>
                  <td className="p-4">${t.basePrice}</td>
                  <td className="p-4">{t.capacity} Guests</td>
                  <td className="p-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openDialog(t)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 border-0">Edit</Button>
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
