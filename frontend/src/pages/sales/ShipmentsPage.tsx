import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, Send } from "lucide-react";
import type { Shipment, SalesOrder, Product } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";

export function ShipmentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: shipments, isLoading } = useQuery<Shipment[]>({
    queryKey: ["shipments"],
    queryFn: () => api.get("/sales/shipments").then(r => r.data),
  });

  const post = useMutation({
    mutationFn: (id: number) => api.post(`/sales/shipments/${id}/post`),
    onSuccess: () => {
      toast.success("Shipment posted — COGS and revenue journal entries created");
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["stock-all"] });
      qc.invalidateQueries({ queryKey: ["sales-orders"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div>
      <PageHeader title="Shipments" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Shipment</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Ship #</th><th>SO #</th><th>Date</th><th>Carrier</th><th>Status</th><th>COGS JE</th><th>Rev JE</th><th></th></tr></thead>
              <tbody>
                {(shipments ?? []).map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs mono text-violet-700">{s.shipment_number}</td>
                    <td className="font-mono text-xs">{s.so_id}</td>
                    <td>{fmt.date(s.ship_date)}</td>
                    <td className="text-slate-500">{s.carrier ?? "—"}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="font-mono text-xs text-slate-500">{s.cogs_je_id ?? "—"}</td>
                    <td className="font-mono text-xs text-slate-500">{s.sales_je_id ?? "—"}</td>
                    <td>
                      {s.status === "DRAFT" && (
                        <button className="btn-success py-0.5 text-xs" onClick={() => post.mutate(s.id)}>
                          <Send size={12} /> Post
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!shipments?.length && <tr><td colSpan={8} className="text-center text-slate-400 py-8">No shipments</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <ShipmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["shipments"] }); }} />}
    </div>
  );
}

function ShipmentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: sos } = useQuery<SalesOrder[]>({ queryKey: ["sales-orders"], queryFn: () => api.get("/sales/orders").then(r => r.data) });
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { data: locations } = useLocations();
  const { register, control, handleSubmit } = useForm({
    defaultValues: { so_id: "", location_id: "", ship_date: new Date().toISOString().split("T")[0], carrier: "", tracking_ref: "", lines: [{ product_id: "", qty_shipped: "1", unit_price: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/sales/shipments", {
      ...data,
      so_id: parseInt(data.so_id),
      location_id: parseInt(data.location_id),
      lines: data.lines.map((l: any) => ({ product_id: parseInt(l.product_id), qty_shipped: parseFloat(l.qty_shipped), unit_price: parseFloat(l.unit_price) })),
    }),
    onSuccess: () => { toast.success("Shipment created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open title="New Shipment" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Sales Order *">
            <Select {...register("so_id", { required: true })}>
              <option value="">Select SO</option>
              {(sos ?? []).filter(s => ["CONFIRMED","PARTIALLY_SHIPPED"].includes(s.status)).map(s => (
                <option key={s.id} value={s.id}>{s.so_number}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Ship Date *"><Input type="date" {...register("ship_date", { required: true })} /></FormField>
          <FormField label="Dispatch Location *">
            <Select {...register("location_id", { required: true })}>
              <option value="">Select location…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Carrier"><Input {...register("carrier")} /></FormField>
          <FormField label="Tracking Ref"><Input {...register("tracking_ref")} /></FormField>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Lines</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty_shipped: "1", unit_price: "" })}>+ Add line</button>
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
                <Input type="number" step="0.01" placeholder="Qty" {...register(`lines.${i}.qty_shipped`, { required: true })} />
                <Input type="number" step="0.0001" placeholder="Unit price" {...register(`lines.${i}.unit_price`, { required: true })} />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">After creating, click "Post" to deduct inventory and generate COGS + revenue journal entries.</p>
      </div>
    </Modal>
  );
}
