"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const ChangePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof ChangePasswordSchema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Something went wrong.");
      
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
        <h2 className="text-2xl font-bold text-white mb-2">Change Password</h2>
        <p className="text-slate-400 mb-6">
          This is your first time logging in. Please change your password to continue.
        </p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input
              {...form.register("password")}
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {form.formState.errors.password && (
              <p className="text-red-400 text-xs mt-1.5">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
            <input
              {...form.register("confirmPassword")}
              type="password"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-red-400 text-xs mt-1.5">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 mt-4">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
