"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const ProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof ProfileSchema>;

export default function ProfilePage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  const form = useForm<FormValues>({
    resolver: zodResolver(ProfileSchema),
  });

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          form.setValue("name", data.data.name || "");
          form.setValue("phone", data.data.phone || "");
        }
      })
      .finally(() => setLoading(false));
  }, [form]);

  async function onSubmit(data: FormValues) {
    setLoading(true);
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !form.getValues().name) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>
      
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-slate-800 p-6 rounded-xl border border-slate-700">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
          <input
            {...form.register("name")}
            type="text"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {form.formState.errors.name && (
            <p className="text-red-400 text-xs mt-1.5">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone (Optional)</label>
          <input
            {...form.register("phone")}
            type="text"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
          {loading ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </div>
  );
}
