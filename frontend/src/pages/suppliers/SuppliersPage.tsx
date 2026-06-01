import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { PageHeader, Spinner, Modal, FormField, Input, Textarea, Select } from "../../components/ui";
import { Plus } from "lucide-react";
import type { Supplier, Account } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function SuppliersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers?active_only=false").then(r => r.data),
  });
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounting/accounts").then(r => r.data),
  });

  return (
    <div>
      <PageHeader title="Suppliers" actions={
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={14} /> New Supplier
        </button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Phone</th><th>Terms</th><th></th></tr></thead>
              <tbody>
                {(suppliers ?? []).map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs mono text-violet-700">{s.code}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-slate-500">{s.contact_email ?? "—"}</td>
                    <td className="text-slate-500">{s.phone ?? "—"}</td>
                    <td>Net {s.payment_terms}</td>
                    <td>
                      <button className="text-xs text-violet-600 hover:underline" onClick={() => { setEditing(s); setShowForm(true); }}>Edit</button>
                    </td>
                  </tr>
                ))}
                {!suppliers?.length && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No suppliers yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && (
        <SupplierForm supplier={editing} accounts={accounts ?? []} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); }} />
      )}
    </div>
  );
}

function SupplierForm({ supplier, accounts, onClose, onSaved }: {
  supplier: Supplier | null; accounts: Account[]; onClose: () => void; onSaved: () => void;
}) {
  const { register, handleSubmit } = useForm({ defaultValues: supplier ?? { code: "", name: "", contact_email: "", phone: "", address: "", payment_terms: 30, ap_account_id: "" } });
  const mutation = useMutation({
    mutationFn: (data: any) => supplier ? api.put(`/suppliers/${supplier.id}`, data) : api.post("/suppliers", data),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const liabilityAccounts = accounts.filter(a => a.account_type === "LIABILITY");
  return (
    <Modal open title={supplier ? "Edit Supplier" : "New Supplier"} onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Save"}</button></>
    }>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Code *"><Input {...register("code")} disabled={!!supplier} /></FormField>
        <FormField label="Name *"><Input {...register("name")} /></FormField>
        <FormField label="Email"><Input type="email" {...register("contact_email")} /></FormField>
        <FormField label="Phone"><Input {...register("phone")} /></FormField>
        <FormField label="Payment Terms (days)"><Input type="number" {...register("payment_terms", { valueAsNumber: true })} /></FormField>
        <FormField label="AP Account">
          <Select {...register("ap_account_id", { setValueAs: v => v ? parseInt(v) : null })}>
            <option value="">Select account</option>
            {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
          </Select>
        </FormField>
        <div className="col-span-2"><FormField label="Address"><Textarea {...register("address")} /></FormField></div>
      </div>
    </Modal>
  );
}
