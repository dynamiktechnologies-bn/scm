import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  PageHeader, TableSkeleton, EmptyState, Modal, FormField, Input, Select,
} from "../../components/ui";
import { Plus, Trash2, Edit2, Users, Shield, CheckCircle2, Circle } from "lucide-react";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface UserFormData {
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  password?: string;
}

const AVAILABLE_ROLES = [
  "STAFF",
  "MANAGER",
  "DIRECTOR",
  "FINANCE_DIRECTOR",
  "CFO",
  "ADMIN",
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  STAFF: "Regular user with basic access",
  MANAGER: "Can approve documents up to step 1",
  DIRECTOR: "Can approve documents requiring director approval",
  FINANCE_DIRECTOR: "Can approve finance-related documents",
  CFO: "Chief Financial Officer with highest approval authority",
  ADMIN: "Full system access, can manage users and workflows",
};

export function UsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/auth/users").then((r) => r.data),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: number) => api.delete(`/auth/users/${userId}`),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and assign approval roles"
        actions={
          <button
            className="btn-primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={14} /> New User
          </button>
        }
      />

      <div className="page-shell space-y-6">

        {/* ── Users Table ───────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 text-sm font-semibold text-slate-700">
            User Accounts ({users?.length ?? 0})
          </div>
          {isLoading ? (
            <table className="data-table"><tbody><TableSkeleton cols={5} rows={4} /></tbody></table>
          ) : !users?.length ? (
            <EmptyState message="No users yet" icon={<Users size={28} />} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="mono text-violet-700 text-sm">{user.email}</td>
                    <td className="font-medium text-slate-800">{user.full_name || "—"}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                        user.role === "ADMIN" ? "bg-red-100 text-red-700" :
                        user.role === "CFO" ? "bg-purple-100 text-purple-700" :
                        user.role === "FINANCE_DIRECTOR" ? "bg-indigo-100 text-indigo-700" :
                        user.role === "DIRECTOR" ? "bg-blue-100 text-blue-700" :
                        user.role === "MANAGER" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        <Shield size={12} />
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {user.is_active ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span className="text-xs text-emerald-700">Active</span>
                          </>
                        ) : (
                          <>
                            <Circle size={14} className="text-slate-400" />
                            <span className="text-xs text-slate-500">Inactive</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        className="btn-ghost py-1 text-xs"
                        onClick={() => { setEditing(user); setShowForm(true); }}
                      >
                        <Edit2 size={12} className="inline mr-1" />
                        Edit
                      </button>
                      <button
                        className="btn-danger py-1 text-xs"
                        onClick={() => {
                          if (confirm(`Delete ${user.email}?`)) {
                            deleteUser.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 size={12} className="inline mr-1" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Role Reference ────────────────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Approval Roles Reference</h3>
          <div className="space-y-2.5">
            {AVAILABLE_ROLES.map((role) => (
              <div key={role} className="flex gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                  role === "ADMIN" ? "bg-red-600" :
                  role === "CFO" ? "bg-purple-600" :
                  role === "FINANCE_DIRECTOR" ? "bg-indigo-600" :
                  role === "DIRECTOR" ? "bg-blue-600" :
                  role === "MANAGER" ? "bg-amber-600" :
                  "bg-slate-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{role}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Access Control Guidelines ──────────────────────────────── */}
        <div className="card p-5 bg-amber-50 border border-amber-200">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">User Management Guidelines</h3>
          <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
            <li><strong>Roles:</strong> Assign based on job responsibility and approval requirements</li>
            <li><strong>ADMIN:</strong> Only for system administrators. Can create users and manage workflows</li>
            <li><strong>CFO/FINANCE_DIRECTOR:</strong> For users who need to approve high-value transactions</li>
            <li><strong>DIRECTOR/MANAGER:</strong> For department heads and team leaders requiring approval authority</li>
            <li><strong>Inactive:</strong> Users can be deactivated without deletion. They cannot log in but history is preserved</li>
          </ul>
        </div>

      </div>

      {showForm && (
        <UserForm
          user={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<UserFormData>({
    defaultValues: user ? {
      email: user.email,
      full_name: user.full_name || "",
      role: user.role,
      is_active: user.is_active,
    } : {
      email: "",
      full_name: "",
      role: "STAFF",
      is_active: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: UserFormData) => {
      if (user) {
        const { password, ...updateData } = data;
        return api.put(`/auth/users/${user.id}`, updateData);
      } else {
        return api.post("/auth/register", {
          ...data,
          password: data.password || "TempPassword123!",
        });
      }
    },
    onSuccess: () => {
      toast.success(user ? "User updated" : "User created");
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <Modal
      open
      size="sm"
      title={user ? `Edit User — ${user.email}` : "Create New User"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit((d) => mutation.mutate(d))}
          >
            {mutation.isPending ? "Saving…" : "Save User"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          label="Email *"
          error={errors.email?.message as string}
        >
          <Input
            type="email"
            {...register("email", { required: "Required" })}
            placeholder="user@example.com"
            disabled={!!user}
            className={user ? "bg-slate-50" : ""}
          />
        </FormField>

        {!user && (
          <FormField label="Password" hint="Leave blank for temporary password">
            <Input
              type="password"
              {...register("password")}
              placeholder="Auto-generated if blank"
            />
          </FormField>
        )}

        <FormField label="Full Name" error={errors.full_name?.message as string}>
          <Input
            {...register("full_name")}
            placeholder="e.g. John Doe"
          />
        </FormField>

        <FormField label="Role *" error={errors.role?.message as string}>
          <Select {...register("role", { required: "Required" })}>
            {AVAILABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Active?">
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              {...register("is_active")}
              className="w-4 h-4"
            />
            <span className="text-xs text-slate-600">
              Allow this user to log in
            </span>
          </div>
        </FormField>

        {!user && (
          <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
            <strong>Note:</strong> New users will receive a temporary password.
            They should change it on first login.
          </p>
        )}
      </div>
    </Modal>
  );
}
