import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  PageHeader, TableSkeleton, EmptyState, Modal, FormField, Input, Select,
} from "../../components/ui";
import { Plus, Trash2, Edit2, Workflow, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useForm, useFieldArray } from "react-hook-form";

interface ApprovalWorkflow {
  id: number;
  document_type: string;
  name: string;
  amount_threshold: number | null;
  is_active: boolean;
  steps: ApprovalStep[];
}

interface ApprovalStep {
  id?: number;
  step_number: number;
  required_role: string;
  description: string | null;
  is_optional: boolean;
}

const AVAILABLE_ROLES = [
  "STAFF",
  "MANAGER",
  "DIRECTOR",
  "FINANCE_DIRECTOR",
  "CFO",
  "ADMIN",
];

const DOCUMENT_TYPES = [
  { value: "PO", label: "Purchase Order" },
  { value: "GRN", label: "Goods Receipt" },
  { value: "SO", label: "Sales Order" },
  { value: "SHIPMENT", label: "Shipment" },
  { value: "SUPPLIER_INVOICE", label: "Supplier Invoice" },
  { value: "ADJ", label: "Inventory Adjustment" },
];

export function ApprovalsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApprovalWorkflow | null>(null);

  const { data: workflows, isLoading } = useQuery<ApprovalWorkflow[]>({
    queryKey: ["approval-workflows"],
    queryFn: () => api.get("/approvals/workflows").then((r) => r.data),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Approval Workflows"
        subtitle="Configure document approval requirements and roles"
        actions={
          <button
            className="btn-primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={14} /> New Workflow
          </button>
        }
      />

      <div className="page-shell space-y-6">

        {/* ── Active Workflows ───────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 text-sm font-semibold text-slate-700">
            Active Workflows ({workflows?.filter(w => w.is_active).length ?? 0})
          </div>
          {isLoading ? (
            <table className="data-table"><tbody><TableSkeleton cols={5} rows={3} /></tbody></table>
          ) : !workflows?.filter(w => w.is_active).length ? (
            <EmptyState message="No active approval workflows" icon={<Workflow size={28} />} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Workflow Name</th>
                  <th>Levels</th>
                  <th>Amount Threshold</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workflows?.filter(w => w.is_active).map((wf) => (
                  <tr key={wf.id}>
                    <td>
                      <span className="mono bg-violet-100 px-2.5 py-1 rounded-md text-violet-700 font-semibold text-xs">
                        {wf.document_type}
                      </span>
                    </td>
                    <td className="font-medium text-slate-800">{wf.name}</td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        {wf.steps.map((s) => (
                          <span key={s.step_number} className="text-xs text-slate-600">
                            {s.step_number}. {s.required_role}
                            {s.is_optional && <span className="text-slate-400"> (optional)</span>}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="mono text-slate-600">
                      {wf.amount_threshold ? `$${wf.amount_threshold.toLocaleString()}` : "—"}
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        className="btn-ghost py-1 text-xs"
                        onClick={() => { setEditing(wf); setShowForm(true); }}
                      >
                        <Edit2 size={12} className="inline mr-1" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Role Reference ────────────────────────────────────────────── */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Available Approval Roles</h3>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_ROLES.map((role) => (
              <div key={role} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <CheckCircle size={14} className="text-violet-600 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-700">{role}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Assign these roles to users in Settings → Users. Each approval step requires one role.
          </p>
        </div>

        {/* ── Approval Guidelines ────────────────────────────────────────── */}
        <div className="card p-5 bg-violet-50 border border-violet-200">
          <h3 className="text-sm font-semibold text-violet-900 mb-2">Approval Workflow Design</h3>
          <ul className="text-xs text-violet-800 space-y-1 list-disc list-inside">
            <li><strong>1-Level:</strong> Simple approval by a single role (e.g., MANAGER approves receipt)</li>
            <li><strong>2-Level:</strong> Sequential approval (e.g., MANAGER → DIRECTOR for large POs)</li>
            <li><strong>N-Level:</strong> Multiple sequential approvals (e.g., MANAGER → DIRECTOR → CFO)</li>
            <li><strong>Amount Thresholds:</strong> Different workflows based on document amount</li>
            <li><strong>Optional Steps:</strong> Steps that can be skipped if no user has that role</li>
            <li><strong>Rejection Reset:</strong> Rejecting a document resets ALL approvals to pending</li>
          </ul>
        </div>

      </div>

      {showForm && (
        <WorkflowForm
          workflow={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["approval-workflows"] });
          }}
        />
      )}
    </div>
  );
}

function WorkflowForm({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: ApprovalWorkflow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: workflow ?? {
      document_type: "",
      name: "",
      amount_threshold: null,
      is_active: true,
      steps: [
        { step_number: 1, required_role: "MANAGER", description: "", is_optional: false },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "steps" });

  // Reset form when workflow changes to ensure steps are properly loaded
  useEffect(() => {
    reset(workflow ?? {
      document_type: "",
      name: "",
      amount_threshold: null,
      is_active: true,
      steps: [
        { step_number: 1, required_role: "MANAGER", description: "", is_optional: false },
      ],
    });
  }, [workflow, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        document_type: data.document_type,
        name: data.name,
        amount_threshold: data.amount_threshold ? parseFloat(data.amount_threshold) : null,
        steps: data.steps.map((s: any) => ({
          step_number: parseInt(s.step_number),
          required_role: s.required_role,
          description: s.description || null,
          is_optional: s.is_optional === true || s.is_optional === "true",
        })),
      };
      return workflow
        ? api.put(`/approvals/workflows/${workflow.id}`, payload)
        : api.post("/approvals/workflows", payload);
    },
    onSuccess: () => {
      toast.success(workflow ? "Workflow updated" : "Workflow created");
      // Invalidate all approval-related queries to refresh with new data
      qc.invalidateQueries({ queryKey: ["approval-workflows"] });
      // Invalidate all approval status queries that might reference this workflow
      qc.invalidateQueries({ queryKey: ["approvals"] });
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  return (
    <Modal
      open
      size="lg"
      title={workflow ? `Edit — ${workflow.document_type}` : "New Approval Workflow"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit((d) => mutation.mutate(d))}
          >
            {mutation.isPending ? "Saving…" : "Save Workflow"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Document Type *"
            hint="The document this workflow applies to"
            error={errors.document_type?.message as string}
          >
            <Select {...register("document_type", { required: "Required" })} disabled={!!workflow}>
              <option value="">Select document type…</option>
              {DOCUMENT_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Workflow Name *" error={errors.name?.message as string}>
            <Input
              {...register("name", { required: "Required" })}
              placeholder="e.g. Purchase Order Approval"
            />
          </FormField>

          <FormField label="Amount Threshold (Optional)" hint="Amounts above this use this workflow">
            <Input
              type="number"
              step="0.01"
              {...register("amount_threshold")}
              placeholder="e.g. 5000"
            />
          </FormField>
        </div>

        {/* Approval steps */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">Approval Steps</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() =>
                append({
                  step_number: Math.max(...fields.map((_, i) => i + 1), 0) + 1,
                  required_role: "MANAGER",
                  description: "",
                  is_optional: false,
                })
              }
            >
              + Add Step
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((_, i) => (
              <div
                key={i}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2"
              >
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Step #">
                    <Input
                      type="number"
                      {...register(`steps.${i}.step_number`)}
                      disabled
                      className="bg-white"
                    />
                  </FormField>
                  <FormField label="Required Role *">
                    <Select {...register(`steps.${i}.required_role`, { required: true })}>
                      {AVAILABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Optional?">
                    <input
                      type="checkbox"
                      {...register(`steps.${i}.is_optional`)}
                      className="mt-7 w-4 h-4"
                    />
                  </FormField>
                </div>
                <FormField label="Description">
                  <Input
                    {...register(`steps.${i}.description`)}
                    placeholder="e.g. 'Manager approval'"
                  />
                </FormField>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="btn-danger py-1 text-xs w-full"
                    onClick={() => remove(i)}
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    Remove Step
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
          <strong>Example:</strong> A 2-level PO approval workflow: Step 1 requires MANAGER approval,
          Step 2 requires DIRECTOR approval. Documents will require both approvals in order.
        </p>
      </div>
    </Modal>
  );
}
