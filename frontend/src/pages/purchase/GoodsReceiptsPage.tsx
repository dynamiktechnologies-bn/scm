import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, Send } from "lucide-react";
import type { GoodsReceipt, PurchaseOrder, Supplier, Product } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";

export function GoodsReceiptsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: grns, isLoading } = useQuery<GoodsReceipt[]>({
    queryKey: ["grns"],
    queryFn: () => api.get("/purchase/receipts").then(r => r.data),
  });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data) });

  const post = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/receipts/${id}/post`),
    onSuccess: () => { toast.success("GRN posted — inventory and journal entry updated"); qc.invalidateQueries({ queryKey: ["grns"] }); qc.invalidateQueries({ queryKey: ["stock-all"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  const supplierName = (id: number) => suppliers?.find(s => s.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader title="Goods Receipts (GRN)" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New GRN</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>GRN #</th><th>Supplier</th><th>Date</th><th>PO #</th><th>Status</th><th>JE</th><th></th></tr></thead>
              <tbody>
                {(grns ?? []).map(g => (
                  <tr key={g.id}>
                    <td className="font-mono text-xs mono text-violet-700">{g.grn_number}</td>
                    <td>{supplierName(g.supplier_id)}</td>
                    <td>{fmt.date(g.receipt_date)}</td>
                    <td className="font-mono text-xs text-slate-500">{g.po_id ?? "—"}</td>
                    <td><StatusBadge status={g.status} /></td>
                    <td className="font-mono text-xs text-slate-500">{g.je_id ?? "—"}</td>
                    <td>
                      {g.status === "DRAFT" && (
                        <button className="btn-success py-0.5 text-xs" onClick={() => post.mutate(g.id)}>
                          <Send size={12} /> Post
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!grns?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No goods receipts</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <GRNForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["grns"] }); }} />}
    </div>
  );
}

function GRNForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then(r => r.data) });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { data: pos } = useQuery<PurchaseOrder[]>({ queryKey: ["purchase-orders"], queryFn: () => api.get("/purchase/orders").then(r => r.data) });
  const { data: locations } = useLocations();

  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      supplier_id: "", po_id: "", location_id: "", receipt_date: new Date().toISOString().split("T")[0],
      supplier_ref: "",
      lines: [{ product_id: "", qty_received: "1", unit_cost: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/purchase/receipts", {
      ...data,
      supplier_id: parseInt(data.supplier_id),
      po_id: data.po_id ? parseInt(data.po_id) : null,
      location_id: parseInt(data.location_id),
      lines: data.lines.map((l: any) => ({ product_id: parseInt(l.product_id), qty_received: parseFloat(l.qty_received), unit_cost: parseFloat(l.unit_cost) })),
    }),
    onSuccess: () => { toast.success("GRN created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <Modal open title="New Goods Receipt (GRN)" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create GRN"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Supplier *">
            <Select {...register("supplier_id", { required: true })}>
              <option value="">Select supplier</option>
              {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Purchase Order">
            <Select {...register("po_id")}>
              <option value="">None (free receipt)</option>
              {(pos ?? []).filter(p => ["APPROVED","PARTIALLY_RECEIVED"].includes(p.status)).map(p => (
                <option key={p.id} value={p.id}>{p.po_number}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Receiving Location *">
            <Select {...register("location_id", { required: true })}>
              <option value="">Select location…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Receipt Date *"><Input type="date" {...register("receipt_date", { required: true })} /></FormField>
          <FormField label="Supplier Ref"><Input {...register("supplier_ref")} /></FormField>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Lines</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty_received: "1", unit_cost: "" })}>+ Add line</button>
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-4 gap-2 items-end">
                <div className="col-span-2">
                  <Select {...register(`lines.${i}.product_id`, { required: true })}>
                    <option value="">Product</option>
                    {(products ?? []).map(p => <option key={p.id} value={p.id}>{p.sku} – {p.name}</option>)}
                  </Select>
                </div>
                <Input type="number" step="0.01" placeholder="Qty" {...register(`lines.${i}.qty_received`, { required: true })} />
                <Input type="number" step="0.0001" placeholder="Unit cost" {...register(`lines.${i}.unit_cost`, { required: true })} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">After creating, click "Post" to update inventory and generate the journal entry.</p>
      </div>
    </Modal>
  );
}
