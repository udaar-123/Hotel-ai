"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const CreateManagerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

export default function AdminManagersPage() {
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  type FormValues = z.infer<typeof CreateManagerSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(CreateManagerSchema),
    defaultValues: { name: "", email: "" },
  });

  const fetchManagers = () => {
    setLoading(true);
    fetch("/api/v1/users/staff?role=MANAGER")
      .then(res => res.json())
      .then(data => {
        if (data.success) setManagers(data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const onSubmit = async (data: any) => {
    try {
      const res = await fetch("/api/v1/users/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "MANAGER" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message);
      }
      setIsDialogOpen(false);
      form.reset();
      fetchManagers();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleStatus = async (id: string, currentlyDeactivated: boolean) => {
    try {
      const res = await fetch(`/api/v1/users/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deactivated: !currentlyDeactivated }),
      });
      if (res.ok) fetchManagers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Managers</h1>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
          + Create Manager
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-xl max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold mb-4">Create New Manager</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input {...form.register("name")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input {...form.register("email")} className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-slate-700 hover:bg-slate-600 border-0">Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Create</Button>
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
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
            ) : managers.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-slate-400">No managers found</td></tr>
            ) : (
              managers.map(m => (
                <tr key={m.id} className="border-t border-slate-700/50">
                  <td className="p-4">{m.name}</td>
                  <td className="p-4">{m.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${m.deactivatedAt ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {m.deactivatedAt ? 'Deactivated' : 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleStatus(m.id, !!m.deactivatedAt)}
                      className={`border-0 ${m.deactivatedAt ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                    >
                      {m.deactivatedAt ? 'Activate' : 'Deactivate'}
                    </Button>
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
