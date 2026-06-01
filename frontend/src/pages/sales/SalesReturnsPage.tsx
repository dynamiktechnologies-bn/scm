import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import {
  PageHeader, Spinner, StatusBadge, TableSkeleton, EmptyState,
  Modal, FormField, Input, Select,
} from "../../components/ui";
import { Send, Plus, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import type { Shipment, Customer } from "../../lib/types";
import { useLocations, locationLabel } from "../../hooks/useLocations";
import { useForm, useFieldArray } from "react-hook-form";

export function SalesReturnsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["sales-returns"],
    queryFn: () => api.get("/sales/returns").then((r) => r.data),
  });
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers").then((r) => r.data),
  });

  const post = useMutation({
    mutationFn: (id: number) => api.post(`/sales/returns/${id}/post`),
    onSuccess: () => {
      toast.success("Sales return posted — inventory and journal reversed");
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
      qc.invalidateQueries({ queryKey: ["stock-all"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sales Returns"
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
                <th>Shipment</th>
                <th>Customer</th>
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
                    <EmptyState message="No sales returns" icon={<RotateCcw size={28} />} />
                  </td>
                </tr>
              ) : (
                (data ?? []).map((r: any) => (
                  <tr key={r.id}>
                    <td className="mono text-violet-700 font-medium">{r.return_number}</td>
                    <td className="mono text-slate-500">SHIP #{r.shipment_id}</td>
                    <td className="text-slate-600">
                      {customers?.find((c) => c.id === r.customer_id)?.name ?? `Customer ${r.customer_id}`}
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
        <SalesReturnForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["sales-returns"] }); }}
        />
      )}
    </div>
  );
}

function SalesReturnForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: shipments } = useQuery<Shipment[]>({
    queryKey: ["shipments"],
    queryFn: () => api.get("/sales/shipments").then((r) => r.data),
  });

  const { data: locations } = useLocations();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      shipment_id: "",
      location_id: "",
      return_date: new Date().toISOString().split("T")[0],
      reason: "",
      lines: [{ product_id: "", qty_returned: "1", unit_price: "", unit_cost: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const selectedShipmentId = watch("shipment_id");
  const selectedShipment = shipments?.find((s) => s.id === parseInt(selectedShipmentId));
  const shipmentLines = selectedShipment?.lines ?? [];

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post("/sales/returns", {
        shipment_id: parseInt(data.shipment_id),
        location_id: parseInt(data.location_id),
        return_date: data.return_date,
        reason: data.reason || null,
        lines: data.lines.map((l: any) => ({
          product_id: parseInt(l.product_id),
          qty_returned: parseFloat(l.qty_returned),
          unit_price: parseFloat(l.unit_price),
          unit_cost: parseFloat(l.unit_cost),
        })),
      }),
    onSuccess: () => { toast.success("Sales return created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error creating return"),
  });

  return (
    <Modal
      open
      title="New Sales Return"
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
          <FormField label="Shipment *">
            <Select {...register("shipment_id", { required: true })}>
              <option value="">Select shipment…</option>
              {(shipments ?? [])
                .filter((s) => s.status === "POSTED")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shipment_number} — {fmt.date(s.ship_date)}
                  </option>
                ))}
            </Select>
          </FormField>

          <FormField label="Return Date *">
            <Input type="date" {...register("return_date", { required: true })} />
          </FormField>

          <FormField label="Return To Location *">
            <Select {...register("location_id", { required: true })}>
              <option value="">Select location…</option>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l)}</option>
              ))}
            </Select>
          </FormField>

          <div className="col-span-2">
            <FormField label="Reason">
              <Input placeholder="e.g. Defective product, Wrong item shipped…" {...register("reason")} />
            </FormField>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="label mb-0">Return Lines</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() => append({ product_id: "", qty_returned: "1", unit_price: "", unit_cost: "" })}
            >
              + Add line
            </button>
          </div>

          {shipmentLines.length > 0 && (
            <p className="text-xs text-slate-500 mb-2">
              Shipment contains:{" "}
              {shipmentLines.map((l) => `${l.product?.name ?? l.product_id}`).join(", ")}
            </p>
          )}

          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Select
                    {...register(`lines.${i}.product_id`, { required: true })}
                    className={errors.lines?.[i]?.product_id ? "border-red-400" : ""}
                  >
                    <option value="">Product…</option>
                    {shipmentLines.length > 0
                      ? shipmentLines.map((l) => (
                          <option key={l.product_id} value={l.product_id}>
                            {l.product?.sku ?? l.product_id} — {l.product?.name}
                          </option>
                        ))
                      : null}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Qty"
                    {...register(`lines.${i}.qty_returned`, { required: true })}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Unit price"
                    {...register(`lines.${i}.unit_price`, { required: true })}
                  />
                </div>
                <div className="col-span-2">
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
            After creating, click <strong>Post</strong> to restore inventory and reverse COGS + revenue.
          </p>
        </div>
      </div>
    </Modal>
  );
}
