import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import {
  PageHeader, Spinner, StatusBadge, TableSkeleton, EmptyState,
  Modal, FormField, Input, Select,
} from "../../components/ui";
import { CheckCircle, Send, Plus, FileText } from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "../../lib/types";
import { useForm, useFieldArray } from "react-hook-form";

export function PurchaseRequisitionsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: prs, isLoading } = useQuery<any[]>({
    queryKey: ["purchase-requisitions"],
    queryFn: () => api.get("/purchase/requisitions").then((r) => r.data),
  });

  const submit = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/requisitions/${id}/submit`),
    onSuccess: () => { toast.success("PR submitted for approval"); qc.invalidateQueries({ queryKey: ["purchase-requisitions"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  const approve = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/requisitions/${id}/approve`),
    onSuccess: () => { toast.success("PR approved"); qc.invalidateQueries({ queryKey: ["purchase-requisitions"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Purchase Requisitions"
        subtitle={`${prs?.length ?? 0} requisition${(prs?.length ?? 0) !== 1 ? "s" : ""}`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New Requisition
          </button>
        }
      />

      <div className="page-shell">
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>PR Number</th>
                <th>Required Date</th>
                <th className="text-right">Lines</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={4} />
              ) : !prs?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="No requisitions yet" icon={<FileText size={28} />} />
                  </td>
                </tr>
              ) : (
                (prs ?? []).map((pr: any) => (
                  <tr key={pr.id}>
                    <td className="mono text-violet-700 font-medium">{pr.pr_number}</td>
                    <td className="text-slate-600">{pr.required_date ? fmt.date(pr.required_date) : "—"}</td>
                    <td className="text-right text-slate-600">{pr.lines?.length ?? 0}</td>
                    <td className="text-slate-500 max-w-xs truncate">{pr.notes ?? "—"}</td>
                    <td><StatusBadge status={pr.status} /></td>
                    <td className="space-x-2">
                      {pr.status === "DRAFT" && (
                        <button className="btn-secondary py-1 text-xs" onClick={() => submit.mutate(pr.id)}>
                          <Send size={12} /> Submit
                        </button>
                      )}
                      {pr.status === "SUBMITTED" && (
                        <button className="btn-success py-1 text-xs" onClick={() => approve.mutate(pr.id)}>
                          <CheckCircle size={12} /> Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PRForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["purchase-requisitions"] }); }}
        />
      )}
    </div>
  );
}

function PRForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((r) => r.data),
  });

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      required_date: "",
      notes: "",
      lines: [{ product_id: "", qty_requested: "1", notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post("/purchase/requisitions", {
        required_date: data.required_date || null,
        notes: data.notes || null,
        lines: data.lines.map((l: any) => ({
          product_id: parseInt(l.product_id),
          qty_requested: parseFloat(l.qty_requested),
          notes: l.notes || null,
        })),
      }),
    onSuccess: () => { toast.success("Requisition created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error creating PR"),
  });

  return (
    <Modal
      open
      title="New Purchase Requisition"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Create Requisition"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Required By">
            <Input type="date" {...register("required_date")} />
          </FormField>
          <FormField label="Notes">
            <Input placeholder="Optional note…" {...register("notes")} />
          </FormField>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="label mb-0">Requested Items</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() => append({ product_id: "", qty_requested: "1", notes: "" })}
            >
              + Add line
            </button>
          </div>

          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <Select
                    {...register(`lines.${i}.product_id`, { required: true })}
                    className={errors.lines?.[i]?.product_id ? "border-red-400" : ""}
                  >
                    <option value="">Select product…</option>
                    {(products ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Qty"
                    {...register(`lines.${i}.qty_requested`, { required: true, min: 0.01 })}
                    className={errors.lines?.[i]?.qty_requested ? "border-red-400" : ""}
                  />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Note (optional)" {...register(`lines.${i}.notes`)} />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    className="w-full btn-ghost py-2 text-slate-400 hover:text-red-500"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {fields.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">Add at least one product line.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
