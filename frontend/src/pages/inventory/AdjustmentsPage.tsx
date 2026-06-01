import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, Send } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import type { Product } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";

export function AdjustmentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["adjustments"],
    queryFn: () => api.get("/inventory/adjustments").then(r => r.data),
  });
  const post = useMutation({
    mutationFn: (id: number) => api.post(`/inventory/adjustments/${id}/post`),
    onSuccess: () => { toast.success("Adjustment posted"); qc.invalidateQueries({ queryKey: ["adjustments"] }); qc.invalidateQueries({ queryKey: ["stock-all"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <div>
      <PageHeader title="Inventory Adjustments" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Adjustment</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Adj #</th><th>Date</th><th>Reason</th><th>Lines</th><th>Status</th><th>JE</th><th></th></tr></thead>
              <tbody>
                {(data ?? []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs mono text-violet-700">{a.adj_number}</td>
                    <td>{fmt.date(a.adj_date)}</td>
                    <td className="text-slate-500">{a.reason_code ?? "—"}</td>
                    <td>{a.lines?.length ?? 0}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="font-mono text-xs text-slate-500">{a.je_id ?? "—"}</td>
                    <td>{a.status === "DRAFT" && <button className="btn-success py-0.5 text-xs" onClick={() => post.mutate(a.id)}><Send size={12} /> Post</button>}</td>
                  </tr>
                ))}
                {!data?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No adjustments</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <AdjustmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["adjustments"] }); }} />}
    </div>
  );
}

function AdjustmentForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { data: locations } = useLocations();
  const { register, control, handleSubmit } = useForm({
    defaultValues: { location_id: "", adj_date: new Date().toISOString().split("T")[0], reason_code: "COUNT_CORRECTION", notes: "", lines: [{ product_id: "", qty_system: "0", qty_actual: "", unit_cost: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/inventory/adjustments", {
      ...data,
      location_id: parseInt(data.location_id),
      lines: data.lines.map((l: any) => ({ product_id: parseInt(l.product_id), qty_system: parseFloat(l.qty_system), qty_actual: parseFloat(l.qty_actual), unit_cost: parseFloat(l.unit_cost) })),
    }),
    onSuccess: () => { toast.success("Adjustment created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open title="New Inventory Adjustment" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Location *">
            <Select {...register("location_id", { required: true })}>
              <option value="">Select location…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date"><Input type="date" {...register("adj_date")} /></FormField>
          <FormField label="Reason Code">
            <Select {...register("reason_code")}>
              <option value="COUNT_CORRECTION">Count Correction</option>
              <option value="DAMAGE">Damage</option>
              <option value="THEFT">Theft</option>
              <option value="WRITE_OFF">Write Off</option>
            </Select>
          </FormField>
        </div>
        <div>
          <div className="flex justify-between mb-2"><label className="label mb-0">Lines (System Qty → Actual Qty)</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty_system: "0", qty_actual: "", unit_cost: "" })}>+ Add</button></div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-5 gap-2 items-end">
                <div className="col-span-2"><Select {...register(`lines.${i}.product_id`)}><option value="">Product</option>{(products ?? []).map(p => <option key={p.id} value={p.id}>{p.sku}</option>)}</Select></div>
                <Input type="number" step="0.01" placeholder="System qty" {...register(`lines.${i}.qty_system`)} />
                <Input type="number" step="0.01" placeholder="Actual qty" {...register(`lines.${i}.qty_actual`)} />
                <Input type="number" step="0.0001" placeholder="Unit cost" {...register(`lines.${i}.unit_cost`)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
