"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Loader2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  roomTypeId: z.string().uuid("Room type is required"),
  priceOverride: z.coerce.number().min(0).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});
type FormValues = z.infer<typeof CreateRoomSchema>;

export default function RoomsPage() {
  const router = useRouter();
  
  const { data: rData, isLoading: rLoading, mutate: mutateRooms } = useSWR("/api/v1/rooms", fetcher);
  const { data: tData, isLoading: tLoading } = useSWR("/api/v1/rooms/types", fetcher);

  const rooms = rData?.data || [];
  const types = tData?.data || [];
  const loading = rLoading || tLoading;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Image Upload States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(CreateRoomSchema) as any,
    defaultValues: { roomNumber: "", roomTypeId: "", priceOverride: "", isActive: true },
  });

  const openDialog = (room?: any) => {
    setImageFile(null);
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
      setIsUploading(true);
      const payload = { ...data, priceOverride: data.priceOverride === "" ? null : data.priceOverride };
      const url = editingId ? `/api/v1/rooms/${editingId}` : "/api/v1/rooms";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error?.message || "Failed to save room");
      }

      const roomId = editingId ? editingId : resJson.data.id;

      // Handle image upload if a room and image is provided
      if (imageFile && roomId) {
        try {
          const sigRes = await fetch(`/api/v1/rooms/${roomId}/images`);
          const sigData = await sigRes.json();
          if (!sigData.success) throw new Error("Failed to get signature");
          
          const { timestamp, signature, folder, apiKey, cloudName } = sigData.data;

          const formData = new FormData();
          formData.append("file", imageFile);
          formData.append("api_key", apiKey);
          formData.append("timestamp", timestamp.toString());
          formData.append("signature", signature);
          formData.append("folder", folder);

          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.error) throw new Error(uploadData.error.message);

          await fetch(`/api/v1/rooms/${roomId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: uploadData.secure_url,
              publicId: uploadData.public_id,
              isPrimary: true
            })
          });
        } catch (uploadErr: any) {
          alert("Room created successfully, but failed to upload image: " + uploadErr.message);
        }
      }

      setIsDialogOpen(false);
      setImageFile(null);
      mutateRooms();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Rooms Inventory</h1>
        <Button onClick={() => openDialog()} className="bg-black hover:bg-gray-800">
          + Create Room
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full border border-gray-200 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Room" : "Create Room"}</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Room Number</label>
                <input {...form.register("roomNumber")} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Room Type</label>
                <select {...form.register("roomTypeId")} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {types.map((t: any) => <option key={t.id} value={t.id}>{t.name} (${t.basePrice})</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Room Image (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)} 
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-900 hover:file:bg-gray-200 cursor-pointer" 
                />
                {imageFile && <p className="text-xs text-gray-500 mt-2 truncate">{imageFile.name}</p>}
                {editingId && <p className="text-[11px] text-gray-400 mt-1">Uploading an image here will add it to the room's gallery.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price Override ($) (Optional)</label>
                <input type="number" {...form.register("priceOverride")} className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...form.register("isActive")} id="isActive" className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Active</label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading} className="bg-gray-100 hover:bg-gray-200 text-gray-900 border-0 rounded-lg">Cancel</Button>
                <Button type="submit" disabled={isUploading} className="bg-black hover:bg-gray-800 rounded-lg min-w-[100px]">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-semibold text-gray-700">Room #</th>
              <th className="p-4 font-semibold text-gray-700">Type</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
              <th className="p-4 font-semibold text-gray-700">Price</th>
              <th className="p-4 font-semibold text-gray-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading inventory...</td></tr>
            ) : rooms.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No rooms found in inventory.</td></tr>
            ) : (
              rooms.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium flex items-center gap-3">
                    {(() => {
                      const imgUrl = r.room_images?.find((img: any) => img.isPrimary)?.url || r.room_images?.[0]?.url;
                      return imgUrl ? (
                        <img src={imgUrl} className="w-12 h-12 rounded-lg object-cover border border-gray-200" alt="Room" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-medium">No Img</div>
                      );
                    })()}
                    <div>
                      {r.roomNumber} 
                      {!r.isActive && <span className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wider bg-red-100 text-red-700 rounded-full">Inactive</span>}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{r.room_types?.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${r.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">${r.priceOverride ?? r.room_types?.basePrice}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/manager/rooms/${r.id}/images`)} className="bg-white hover:bg-gray-50 text-gray-900 border-gray-200">Images ({r.room_images?.length || 0})</Button>
                    <Button variant="outline" size="sm" onClick={() => openDialog(r)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 border-0">Edit</Button>
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
