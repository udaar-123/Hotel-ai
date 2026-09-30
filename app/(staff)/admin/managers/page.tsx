"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CreateManagerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

export default function AdminManagersPage() {
  const { data: resData, error, isLoading: loading, mutate: fetchManagers } = useSWR("/api/v1/users/staff?role=MANAGER", fetcher);
  const managers = resData?.success ? resData.data : [];
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  type FormValues = z.infer<typeof CreateManagerSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(CreateManagerSchema),
    defaultValues: { name: "", email: "" },
  });

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
    <div className="p-8 max-w-6xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Managers</h1>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-black hover:bg-gray-800">
          + Create Manager
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Create New Manager</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input {...form.register("name")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input {...form.register("email")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-900 border-0">Cancel</Button>
                <Button type="submit" className="bg-black hover:bg-gray-800">Create</Button>
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
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
            ) : managers.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">No managers found</td></tr>
            ) : (
              managers.map(m => (
                <tr key={m.id} className="border-t border-gray-200/50">
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
