import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { PageHeader, TableSkeleton, EmptyState, Modal, FormField, Input } from "../../components/ui";
import { Plus, Ruler } from "lucide-react";
import type { UoM } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function UoMPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UoM | null>(null);

  const { data: uoms, isLoading } = useQuery<UoM[]>({
    queryKey: ["uoms"],
    queryFn: () => api.get("/products/uom").then((r) => r.data),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Units of Measure"
        subtitle={`${uoms?.length ?? 0} units defined`}
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={14} /> New UoM
          </button>
        }
      />

      <div className="page-shell">
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={3} rows={4} />
              ) : !uoms?.length ? (
                <tr>
                  <td colSpan={3}>
                    <EmptyState message="No units of measure defined" icon={<Ruler size={28} />} />
                  </td>
                </tr>
              ) : (
                uoms.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="mono bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-semibold">
                        {u.code}
                      </span>
                    </td>
                    <td className="text-slate-700">{u.name}</td>
                    <td>
                      <button
                        className="btn-ghost py-1 text-xs"
                        onClick={() => { setEditing(u); setShowForm(true); }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <UoMForm
          uom={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["uoms"] }); }}
        />
      )}
    </div>
  );
}

function UoMForm({ uom, onClose, onSaved }: { uom: UoM | null; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: uom ?? { code: "", name: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      uom
        ? api.put(`/products/uom/${uom.id}`, data)
        : api.post("/products/uom", data),
    onSuccess: () => { toast.success(uom ? "UoM updated" : "UoM created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error saving UoM"),
  });

  return (
    <Modal
      open
      size="sm"
      title={uom ? `Edit — ${uom.code}` : "New Unit of Measure"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Code *" hint='Short identifier, e.g. "EA", "KG", "LTR"' error={errors.code?.message as string}>
          <Input
            {...register("code", { required: "Required", maxLength: { value: 10, message: "Max 10 characters" } })}
            disabled={!!uom}
            placeholder="EA"
            className="uppercase"
          />
        </FormField>
        <FormField label="Name *" error={errors.name?.message as string}>
          <Input
            {...register("name", { required: "Required" })}
            placeholder="Each"
          />
        </FormField>
      </div>
    </Modal>
  );
}
