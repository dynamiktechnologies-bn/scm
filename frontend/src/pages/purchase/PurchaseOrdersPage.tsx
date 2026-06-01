import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select, ErrorBanner } from "../../components/ui";
import { Plus, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import type { PurchaseOrder, Supplier, Product } from "../../lib/types";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

export function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: pos, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get("/purchase/orders").then(r => r.data),
  });

  const approve = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/orders/${id}/approve`),
    onSuccess: () => { toast.success("PO approved"); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/orders/${id}/cancel`),
    onSuccess: () => { toast.success("PO cancelled"); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div>
      <PageHeader title="Purchase Orders" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New PO</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>PO #</th><th>Supplier</th><th>Date</th><th>Expected</th><th className="text-right">Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {(pos ?? []).map(po => (
                  <tr key={po.id}>
                    <td className="font-mono text-xs">
                      <Link to={`/purchase/orders/${po.id}`} className="mono text-violet-700 hover:underline">{po.po_number}</Link>
                    </td>
                    <td>{po.supplier_id}</td>
                    <td>{fmt.date(po.order_date)}</td>
                    <td className="text-slate-500">{po.expected_date ? fmt.date(po.expected_date) : "—"}</td>
                    <td className="text-right font-mono">{fmt.currency(po.total_amount)}</td>
                    <td><StatusBadge status={po.status} /></td>
                    <td className="space-x-2">
                      {po.status === "SUBMITTED" && (
                        <button className="btn-success py-0.5 text-xs" onClick={() => approve.mutate(po.id)}>
                          <CheckCircle size={12} /> Approve
                        </button>
                      )}
                      {["DRAFT","SUBMITTED","APPROVED"].includes(po.status) && (
                        <button className="btn-danger py-0.5 text-xs" onClick={() => cancel.mutate(po.id)}>
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                      <Link to={`/purchase/orders/${po.id}`} className="text-xs text-slate-500 hover:text-slate-700">
                        <ChevronRight size={14} className="inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!pos?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No purchase orders</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <POForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["purchase-orders"] }); }} />}
    </div>
  );
}

function POForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data) });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { supplier_id: "", order_date: new Date().toISOString().split("T")[0], expected_date: "", notes: "", lines: [{ product_id: "", qty_ordered: "1", unit_price: "", tax_rate: "0" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/purchase/orders", { ...data, supplier_id: parseInt(data.supplier_id), lines: data.lines.map((l: any) => ({ ...l, product_id: parseInt(l.product_id), qty_ordered: parseFloat(l.qty_ordered), unit_price: parseFloat(l.unit_price), tax_rate: parseFloat(l.tax_rate || "0") })) }),
    onSuccess: () => { toast.success("PO created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <Modal open title="New Purchase Order" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create PO"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Supplier *">
            <Select {...register("supplier_id", { required: true })}>
              <option value="">Select supplier</option>
              {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Order Date *"><Input type="date" {...register("order_date", { required: true })} /></FormField>
          <FormField label="Expected Date"><Input type="date" {...register("expected_date")} /></FormField>
          <FormField label="Notes"><Input {...register("notes")} /></FormField>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Lines</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty_ordered: "1", unit_price: "", tax_rate: "0" })}>+ Add line</button>
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2">
                  <Select {...register(`lines.${i}.product_id`, { required: true })}>
                    <option value="">Product</option>
                    {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>)}
                  </Select>
                </div>
                <Input type="number" step="0.01" placeholder="Qty" {...register(`lines.${i}.qty_ordered`, { required: true })} />
                <Input type="number" step="0.0001" placeholder="Unit price" {...register(`lines.${i}.unit_price`, { required: true })} />
                <button type="button" className="btn-danger py-1 text-xs" onClick={() => remove(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
