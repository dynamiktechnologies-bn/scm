import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import {
  PageHeader, Spinner, StatusBadge, TableSkeleton, EmptyState,
  Modal, FormField, Input, Select,
} from "../../components/ui";
import { Send, Plus, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import type { GoodsReceipt, Supplier } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";
import { useForm, useFieldArray } from "react-hook-form";

export function PurchaseReturnsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["purchase-returns"],
    queryFn: () => api.get("/purchase/returns").then((r) => r.data),
  });
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data),
  });

  const post = useMutation({
    mutationFn: (id: number) => api.post(`/purchase/returns/${id}/post`),
    onSuccess: () => {
      toast.success("Purchase return posted — inventory and journal updated");
      qc.invalidateQueries({ queryKey: ["purchase-returns"] });
      qc.invalidateQueries({ queryKey: ["stock-all"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Purchase Returns"
        subtitle={`${data?.length ?? 0} return${(data?.length ?? 0) !== 1 ? "s" : ""}`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New Return
          </button>
        }
      />

      <div className="page-shell">
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>GRN</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>JE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={4} />
              ) : !data?.length ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState message="No purchase returns" icon={<RotateCcw size={28} />} />
                  </td>
                </tr>
              ) : (
                (data ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="mono text-violet-700 font-medium">{r.return_number}</td>
                    <td className="mono text-slate-500">GRN #{r.grn_id}</td>
                    <td className="text-slate-600">
                      {suppliers?.find((s) => s.id === r.supplier_id)?.name ?? `Supplier ${r.supplier_id}`}
                    </td>
                    <td className="text-slate-600">{fmt.date(r.return_date)}</td>
                    <td className="text-slate-500 max-w-xs truncate">{r.reason ?? "—"}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="mono text-slate-400">{r.je_id ?? "—"}</td>
                    <td>
                      {r.status === "DRAFT" && (
                        <button className="btn-success py-1 text-xs" onClick={() => post.mutate(r.id)}>
                          <Send size={12} /> Post
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
        <PurchaseReturnForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["purchase-returns"] }); }}
        />
      )}
    </div>
  );
}

function PurchaseReturnForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: grns } = useQuery<GoodsReceipt[]>({
    queryKey: ["grns"],
    queryFn: () => api.get("/purchase/receipts").then((r) => r.data),
  });
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data),
  });
  const { data: locations } = useLocations();

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      grn_id: "",
      supplier_id: "",
      location_id: "",
      return_date: new Date().toISOString().split("T")[0],
      reason: "",
      lines: [{ product_id: "", qty_returned: "1", unit_cost: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  // Auto-populate supplier when GRN is selected
  const selectedGrnId = watch("grn_id");
  const selectedGrn = grns?.find((g) => g.id === parseInt(selectedGrnId));

  // Get products from the selected GRN's lines for quick selection
  const grnProducts = selectedGrn?.lines ?? [];

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post("/purchase/returns", {
        grn_id: parseInt(data.grn_id),
        supplier_id: parseInt(data.supplier_id),
        location_id: parseInt(data.location_id),
        return_date: data.return_date,
        reason: data.reason || null,
        lines: data.lines.map((l: any) => ({
          product_id: parseInt(l.product_id),
          qty_returned: parseFloat(l.qty_returned),
          unit_cost: parseFloat(l.unit_cost),
        })),
      }),
    onSuccess: () => { toast.success("Purchase return created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error creating return"),
  });

  return (
    <Modal
      open
      title="New Purchase Return"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Create Return"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Goods Receipt (GRN) *">
            <Select {...register("grn_id", { required: true })}>
              <option value="">Select GRN…</option>
              {(grns ?? [])
                .filter((g) => g.status === "POSTED")
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grn_number} — {fmt.date(g.receipt_date)}
                  </option>
                ))}
            </Select>
          </FormField>

          <FormField label="Supplier *">
            <Select {...register("supplier_id", { required: true })}>
              <option value="">Select supplier…</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Return To Location *">
            <Select {...register("location_id", { required: true })}>
              <option value="">Select location…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Return Date *">
            <Input type="date" {...register("return_date", { required: true })} />
          </FormField>

          <FormField label="Reason">
            <Input placeholder="e.g. Damaged goods, Wrong item…" {...register("reason")} />
          </FormField>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="label mb-0">Return Lines</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() => append({ product_id: "", qty_returned: "1", unit_cost: "" })}
            >
              + Add line
            </button>
          </div>

          {grnProducts.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">
              GRN contains: {grnProducts.map((l) => `${l.product?.name ?? l.product_id}`).join(", ")}
            </p>
          )}

          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Select
                    {...register(`lines.${i}.product_id`, { required: true })}
                    className={errors.lines?.[i]?.product_id ? "border-red-400" : ""}
                  >
                    <option value="">Select product…</option>
                    {grnProducts.length > 0
                      ? grnProducts.map((l) => (
                          <option key={l.product_id} value={l.product_id}>
                            {l.product?.sku ?? l.product_id} — {l.product?.name}
                          </option>
                        ))
                      : null}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Qty returned"
                    {...register(`lines.${i}.qty_returned`, { required: true })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Unit cost"
                    {...register(`lines.${i}.unit_cost`, { required: true })}
                  />
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
          <p className="text-xs text-slate-400 mt-2">
            After creating, click <strong>Post</strong> to reverse inventory and generate the journal entry.
          </p>
        </div>
      </div>
    </Modal>
  );
}
