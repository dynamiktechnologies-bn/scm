import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, Modal, FormField, Input, Textarea, Select } from "../../components/ui";
import { Plus } from "lucide-react";
import type { Customer, Account } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function CustomersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers?active_only=false").then(r => r.data),
  });
  const { data: accounts } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => api.get("/accounting/accounts").then(r => r.data) });

  return (
    <div>
      <PageHeader title="Customers" actions={
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={14} /> New Customer
        </button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Phone</th><th className="text-right">Credit Limit</th><th></th></tr></thead>
              <tbody>
                {(customers ?? []).map(c => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs mono text-violet-700">{c.code}</td>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-slate-500">{c.contact_email ?? "—"}</td>
                    <td className="text-slate-500">{c.phone ?? "—"}</td>
                    <td className="text-right">{c.credit_limit ? fmt.currency(c.credit_limit) : "—"}</td>
                    <td><button className="text-xs text-violet-600 hover:underline" onClick={() => { setEditing(c); setShowForm(true); }}>Edit</button></td>
                  </tr>
                ))}
                {!customers?.length && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No customers yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && (
        <CustomerForm customer={editing} accounts={accounts ?? []} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["customers"] }); }} />
      )}
    </div>
  );
}

function CustomerForm({ customer, accounts, onClose, onSaved }: {
  customer: Customer | null; accounts: Account[]; onClose: () => void; onSaved: () => void;
}) {
  const { register, handleSubmit } = useForm({ defaultValues: customer ?? { code: "", name: "", contact_email: "", phone: "", address: "", credit_limit: "", ar_account_id: "" } });
  const mutation = useMutation({
    mutationFn: (data: any) => customer ? api.put(`/customers/${customer.id}`, data) : api.post("/customers", data),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const assetAccounts = accounts.filter(a => a.account_type === "ASSET");
  return (
    <Modal open title={customer ? "Edit Customer" : "New Customer"} onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Save"}</button></>
    }>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Code *"><Input {...register("code")} disabled={!!customer} /></FormField>
        <FormField label="Name *"><Input {...register("name")} /></FormField>
        <FormField label="Email"><Input type="email" {...register("contact_email")} /></FormField>
        <FormField label="Phone"><Input {...register("phone")} /></FormField>
        <FormField label="Credit Limit"><Input type="number" step="0.01" {...register("credit_limit")} /></FormField>
        <FormField label="AR Account">
          <Select {...register("ar_account_id", { setValueAs: v => v ? parseInt(v) : null })}>
            <option value="">Select account</option>
            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
          </Select>
        </FormField>
        <div className="col-span-2"><FormField label="Address"><Textarea {...register("address")} /></FormField></div>
      </div>
    </Modal>
  );
}
