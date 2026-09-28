"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";

export default function RoomImagesPage() {
  const router = useRouter();
  const params = useParams();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchRoom = async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/rooms/${params.id}`);
    const data = await res.json();
    if (data.success) setRoom(data.data);
    setLoading(false);
  };

  useEffect(() => { fetchRoom(); }, [params.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Get signature
      const sigRes = await fetch(`/api/v1/rooms/${params.id}/images`);
      const sigData = await sigRes.json();
      if (!sigData.success) throw new Error("Failed to get signature");
      
      const { timestamp, signature, folder, apiKey, cloudName } = sigData.data;

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
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

      // 3. Save to DB
      await fetch(`/api/v1/rooms/${params.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploadData.secure_url,
          publicId: uploadData.public_id,
          isPrimary: room?.room_images?.length === 0 // First image is primary
        })
      });
      fetchRoom();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      await fetch(`/api/v1/rooms/${params.id}/images/${imageId}`, { method: "DELETE" });
      fetchRoom();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!room) return <div className="p-8 text-white">Room not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto text-white">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={() => router.push("/manager/rooms")} className="bg-slate-800 border-slate-700">
          &larr; Back
        </Button>
        <h1 className="text-2xl font-bold">Images for Room {room.roomNumber}</h1>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <label className="block text-sm font-medium mb-2">Upload New Image</label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {uploading && <p className="text-sm text-indigo-400 mt-2">Uploading...</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {room.room_images?.map((img: any) => (
          <div key={img.id} className="relative group bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
            <div className="aspect-video relative">
              {/* Using img tag to avoid domain configuration issues for Next Image */}
              <img src={img.url} alt="Room" className="object-cover w-full h-full" />
              {img.isPrimary && (
                <div className="absolute top-2 left-2 bg-indigo-600 text-xs px-2 py-1 rounded">Primary</div>
              )}
            </div>
            <div className="p-3 bg-slate-800 flex justify-end">
              <Button variant="destructive" size="sm" onClick={() => deleteImage(img.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
