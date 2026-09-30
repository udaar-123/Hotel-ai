"use client";
import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CreateStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["RECEPTIONIST", "HOUSEKEEPER"]),
});

export default function ManagerStaffPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: resData, error, isLoading: loading, mutate } = useSWR("/api/v1/users/staff", fetcher);
  const staff = resData?.success ? resData.data : [];
  
  type FormValues = z.infer<typeof CreateStaffSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(CreateStaffSchema),
    defaultValues: { name: "", email: "", role: "RECEPTIONIST" },
  });

  const onSubmit = async (data: any) => {
    try {
      const res = await fetch("/api/v1/users/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message);
      }
      setIsDialogOpen(false);
      form.reset();
      mutate();
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
      if (res.ok) mutate();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Staff</h1>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-black hover:bg-gray-800">
          + Create Staff
        </Button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Create New Staff</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input {...form.register("name")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input {...form.register("email")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Role</label>
                <select {...form.register("role")} className="w-full px-4 py-2 rounded bg-gray-50 border border-gray-200 text-gray-900">
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="HOUSEKEEPER">Housekeeper</option>
                </select>
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
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">No staff found</td></tr>
            ) : (
              staff.map(s => (
                <tr key={s.id} className="border-t border-gray-200/50">
                  <td className="p-4">{s.name}</td>
                  <td className="p-4">{s.role}</td>
                  <td className="p-4">{s.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${s.deactivatedAt ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {s.deactivatedAt ? 'Deactivated' : 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleStatus(s.id, !!s.deactivatedAt)}
                      className={`border-0 ${s.deactivatedAt ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                    >
                      {s.deactivatedAt ? 'Activate' : 'Deactivate'}
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
