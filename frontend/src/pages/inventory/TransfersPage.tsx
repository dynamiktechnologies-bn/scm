import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select } from "../../components/ui";
import { Plus, Send } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";
import type { Product } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";

export function TransfersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["transfers"],
    queryFn: () => api.get("/inventory/transfers").then(r => r.data),
  });
  const post = useMutation({
    mutationFn: (id: number) => api.post(`/inventory/transfers/${id}/post`),
    onSuccess: () => { toast.success("Transfer posted"); qc.invalidateQueries({ queryKey: ["transfers"] }); qc.invalidateQueries({ queryKey: ["stock-all"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <div>
      <PageHeader title="Stock Transfers" actions={
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> New Transfer</button>
      } />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Transfer #</th><th>Date</th><th>From</th><th>To</th><th>Lines</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(data ?? []).map((t: any) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs mono text-violet-700">{t.transfer_number}</td>
                    <td>{fmt.date(t.transfer_date)}</td>
                    <td className="text-slate-500">{t.from_location_id}</td>
                    <td className="text-slate-500">{t.to_location_id}</td>
                    <td>{t.lines?.length ?? 0}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{t.status === "DRAFT" && <button className="btn-success py-0.5 text-xs" onClick={() => post.mutate(t.id)}><Send size={12} /> Post</button>}</td>
                  </tr>
                ))}
                {!data?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No transfers</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showForm && <TransferForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["transfers"] }); }} />}
    </div>
  );
}

function TransferForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: products } = useQuery<Product[]>({ queryKey: ["products"], queryFn: () => api.get("/products").then(r => r.data) });
  const { data: locations } = useLocations();
  const { register, control, handleSubmit } = useForm({
    defaultValues: { from_location_id: "", to_location_id: "", transfer_date: new Date().toISOString().split("T")[0], notes: "", lines: [{ product_id: "", qty: "1", unit_cost: "" }] },
  });
  const { fields, append } = useFieldArray({ control, name: "lines" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/inventory/transfers", {
      ...data,
      from_location_id: parseInt(data.from_location_id),
      to_location_id: parseInt(data.to_location_id),
      lines: data.lines.map((l: any) => ({ product_id: parseInt(l.product_id), qty: parseFloat(l.qty), unit_cost: parseFloat(l.unit_cost) })),
    }),
    onSuccess: () => { toast.success("Transfer created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  return (
    <Modal open title="New Stock Transfer" onClose={onClose} footer={
      <><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSubmit(d => mutation.mutate(d))}>{mutation.isPending ? "Saving…" : "Create"}</button></>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="From Location *">
            <Select {...register("from_location_id", { required: true })}>
              <option value="">Select source…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="To Location *">
            <Select {...register("to_location_id", { required: true })}>
              <option value="">Select destination…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Transfer Date *">
            <Input type="date" {...register("transfer_date", { required: true })} />
          </FormField>
          <FormField label="Notes">
            <Input placeholder="Optional…" {...register("notes")} />
          </FormField>
        </div>
        <div>
          <div className="flex justify-between mb-2"><label className="label mb-0">Products</label>
            <button type="button" className="text-xs text-violet-600 hover:underline" onClick={() => append({ product_id: "", qty: "1", unit_cost: "" })}>+ Add</button></div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-3 gap-2 items-end">
                <Select {...register(`lines.${i}.product_id`)}><option value="">Product</option>{(products ?? []).map(p => <option key={p.id} value={p.id}>{p.sku}</option>)}</Select>
                <Input type="number" step="0.01" placeholder="Qty" {...register(`lines.${i}.qty`)} />
                <Input type="number" step="0.0001" placeholder="Unit cost" {...register(`lines.${i}.unit_cost`)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
