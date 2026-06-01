import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, Link2 } from "lucide-react";
import type { SupplierInvoice, Supplier, GoodsReceipt } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function SupplierInvoicesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: invoices, isLoading } = useQuery<SupplierInvoice[]>({
    queryKey: ["supplier-invoices"],
    queryFn: () => api.get("/purchase/invoices").then(r => r.data),
  });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data) });

  const match = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/invoices/${id}/match`),
    onSuccess: () => { toast.success("Invoice matched — DR Inventory Received / CR Accounts Payable"); qc.invalidateQueries({ queryKey: ["supplier-invoices"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div>
      <PageHeader title="Supplier Invoices" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Invoice</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Invoice #</th><th>Supplier</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th>Status</th><th>JE</th><th></th></tr></thead>
              <tbody>
                {(invoices ?? []).map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs mono text-violet-700">{inv.inv_number}</td>
                    <td>{suppliers?.find(s => s.id === inv.supplier_id)?.name ?? inv.supplier_id}</td>
                    <td>{fmt.date(inv.invoice_date)}</td>
                    <td className="text-slate-500">{inv.due_date ? fmt.date(inv.due_date) : "—"}</td>
                    <td className="text-right font-mono">{fmt.currency(inv.total_amount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className="font-mono text-xs text-slate-500">{inv.je_id ?? "—"}</td>
                    <td>
                      {inv.status === "RECEIVED" && (
                        <button className="btn-success py-0.5 text-xs" onClick={() => match.mutate(inv.id)}>
                          <Link2 size={12} /> Match
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!invoices?.length && <tr><td colSpan={8} className="text-center text-slate-400 py-8">No invoices</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <InvoiceForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["supplier-invoices"] }); }} />}
    </div>
  );
}

function InvoiceForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data) });
  const { data: grns } = useQuery<GoodsReceipt[]>({ queryKey: ["grns"], queryFn: () => api.get("/purchase/receipts").then(r => r.data) });
  const { register, handleSubmit } = useForm({
    defaultValues: { inv_number: "", supplier_id: "", grn_id: "", invoice_date: new Date().toISOString().split("T")[0], due_date: "", subtotal: "", tax_amount: "0", total_amount: "" },
  });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/purchase/invoices", {
      ...data,
      supplier_id: parseInt(data.supplier_id),
      grn_id: data.grn_id ? parseInt(data.grn_id) : null,
      subtotal: parseFloat(data.subtotal),
      tax_amount: parseFloat(data.tax_amount || "0"),
      total_amount: parseFloat(data.total_amount),
    }),
    onSuccess: () => { toast.success("Invoice created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open title="New Supplier Invoice" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create"}</button></>
    }>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Invoice Number *"><Input {...register("inv_number", { required: true })} /></FormField>
        <FormField label="Supplier *">
          <Select {...register("supplier_id", { required: true })}>
            <option value="">Select</option>
            {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Linked GRN">
          <Select {...register("grn_id")}>
            <option value="">None</option>
            {(grns ?? []).filter(g => g.status === "POSTED").map(g => <option key={g.id} value={g.id}>{g.grn_number}</option>)}
          </Select>
        </FormField>
        <FormField label="Invoice Date *"><Input type="date" {...register("invoice_date", { required: true })} /></FormField>
        <FormField label="Due Date"><Input type="date" {...register("due_date")} /></FormField>
        <FormField label="Subtotal *"><Input type="number" step="0.01" {...register("subtotal", { required: true })} /></FormField>
        <FormField label="Tax Amount"><Input type="number" step="0.01" {...register("tax_amount")} /></FormField>
        <FormField label="Total Amount *"><Input type="number" step="0.01" {...register("total_amount", { required: true })} /></FormField>
      </div>
    </Modal>
  );
}
