import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, CheckCircle } from "lucide-react";
import type { SalesOrder, Customer, Product } from "../../lib/types";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

export function SalesOrdersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: sos, isLoading } = useQuery<SalesOrder[]>({
    queryKey: ["sales-orders"],
    queryFn: () => api.get("/sales/orders").then(r => r.data),
  });
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data) });

  const confirm = useMutation({
    mutationFn: (id: number) => api.post(`/sales/orders/${id}/confirm`),
    onSuccess: () => { toast.success("SO confirmed"); qc.invalidateQueries({ queryKey: ["sales-orders"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div>
      <PageHeader title="Sales Orders" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New SO</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>SO #</th><th>Customer</th><th>Date</th><th>Required</th><th className="text-right">Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {(sos ?? []).map(so => (
                  <tr key={so.id}>
                    <td className="font-mono text-xs">
                      <Link to={`/sales/orders/${so.id}`} className="mono text-violet-700 hover:underline">{so.so_number}</Link>
                    </td>
                    <td>{customers?.find(c => c.id === so.customer_id)?.name ?? so.customer_id}</td>
                    <td>{fmt.date(so.order_date)}</td>
                    <td className="text-slate-500">{so.required_date ? fmt.date(so.required_date) : "—"}</td>
                    <td className="text-right font-mono">{fmt.currency(so.total_amount)}</td>
                    <td><StatusBadge status={so.status} /></td>
                    <td>
                      {so.status === "DRAFT" && (
                        <button className="btn-success py-0.5 text-xs" onClick={() => confirm.mutate(so.id)}>
                          <CheckCircle size={12} /> Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!sos?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No sales orders</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <SOForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sales-orders"] }); }} />}
    </div>
  );
}

function SOForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: () => api.get("/customers").then(r => r.data) });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { register, control, handleSubmit } = useForm({
    defaultValues: { customer_id: "", order_date: new Date().toISOString().split("T")[0], required_date: "", notes: "", lines: [{ product_id: "", qty_ordered: "1", unit_price: "", discount_pct: "0" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/sales/orders", {
      ...data,
      customer_id: parseInt(data.customer_id),
      lines: data.lines.map((l: any) => ({ product_id: parseInt(l.product_id), qty_ordered: parseFloat(l.qty_ordered), unit_price: parseFloat(l.unit_price), discount_pct: parseFloat(l.discount_pct || "0") })),
    }),
    onSuccess: () => { toast.success("SO created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open title="New Sales Order" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create SO"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Customer *">
            <Select {...register("customer_id", { required: true })}>
              <option value="">Select customer</option>
              {(customers ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Order Date *"><Input type="date" {...register("order_date", { required: true })} /></FormField>
          <FormField label="Required Date"><Input type="date" {...register("required_date")} /></FormField>
          <FormField label="Notes"><Input {...register("notes")} /></FormField>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Lines</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty_ordered: "1", unit_price: "", discount_pct: "0" })}>+ Add line</button>
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
