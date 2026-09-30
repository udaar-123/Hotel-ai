"use client";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import { Edit2, Camera, Loader2, Check, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof ProfileSchema>;

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: resData, isLoading: loading, mutate } = useSWR("/api/v1/users/me", fetcher);
  const user = resData?.data;

  const form = useForm<FormValues>({
    resolver: zodResolver(ProfileSchema),
  });

  useEffect(() => {
    if (user) {
      form.setValue("name", user.name || "");
      form.setValue("phone", user.phone || "");
    }
  }, [user, form, isEditing]);

  async function onSubmit(data: FormValues) {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Something went wrong.");
      setSuccess("Profile updated successfully!");
      mutate();
      setIsEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    try {
      // 1. Get signature
      const sigRes = await fetch(`/api/v1/users/me/avatar-signature`);
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

      // 3. Update User Profile with new avatarUrl
      const patchRes = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: uploadData.secure_url }),
      });
      
      if (!patchRes.ok) throw new Error("Failed to save avatar URL");
      
      setSuccess("Profile photo updated!");
      mutate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-3xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900 tracking-tight">My Profile</h1>
          <p className="text-gray-500 mt-1">Manage your personal information</p>
        </div>
        
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="bg-white border-gray-200 text-gray-900 hover:bg-gray-50 rounded-full px-6 shadow-sm flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Edit Profile
          </Button>
        ) : (
          <Button onClick={() => setIsEditing(false)} variant="outline" className="bg-white border-gray-200 text-gray-500 hover:bg-gray-50 rounded-full px-6 shadow-sm flex items-center gap-2">
            <X className="w-4 h-4" /> Cancel
          </Button>
        )}
      </div>
      
      {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm flex items-center gap-2"><Check className="w-4 h-4" /> {success}</div>}

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center gap-8 mb-10 pb-10 border-b border-gray-100">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg flex items-center justify-center text-4xl font-serif font-bold text-gray-400 uppercase">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0) || "U"
              )}
            </div>
            
            {/* Upload Button overlay */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 bg-gray-900 text-white p-2.5 rounded-full shadow-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarUpload} 
            />
          </div>
          
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-gray-500 capitalize mb-2">{user?.role?.toLowerCase()}</p>
            <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full tracking-wider uppercase">Active Account</span>
          </div>
        </div>

        {/* Profile Details */}
        {!isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
              <p className="text-lg font-medium text-gray-900">{user?.name || "Not specified"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
              <p className="text-lg font-medium text-gray-900">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
              <p className="text-lg font-medium text-gray-900">{user?.phone || "Not specified"}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
              <input
                {...form.register("name")}
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm mt-2">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
              <input
                type="text"
                disabled
                value={user?.email || ""}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-2">Email address cannot be changed.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phone Number</label>
              <input
                {...form.register("phone")}
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="submit" disabled={isSaving} className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-8">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
