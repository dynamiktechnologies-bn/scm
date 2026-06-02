import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// TODO: Update these import paths based on your project structure
import { api } from "../../lib/api";  // Point to your API client
import { cn } from "../../ui";  // Point to your UI utilities folder (should export cn function)
import { CheckCircle2, XCircle, Loader2, User, Clock, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";

export interface ApprovalRecord {
  id: number;
  step_number: number | null;
  required_role: string | null;
  status: string;
  approved_by: number | null;
  approved_at: string | null;
  notes: string | null;
}

export interface ApprovalStatusData {
  document_type: string;
  document_id: number;
  current_step: number;
  total_steps: number;
  steps_completed: number;
  is_approved: boolean;
  records: ApprovalRecord[];
}

interface ApprovalWidgetProps {
  documentType: string;
  documentId: number;
  status: ApprovalStatusData | null;
  isLoading?: boolean;
  canApprove?: boolean;
  currentUserRole?: string;
}

export function ApprovalWidget({
  documentType,
  documentId,
  status,
  isLoading,
  canApprove = false,
  currentUserRole,
}: ApprovalWidgetProps) {
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: (notes?: string) =>
      api.post(`/approvals/${documentType}/${documentId}/approve`, { notes }),
    onSuccess: () => {
      toast.success("Document approved");
      qc.invalidateQueries({ queryKey: [`approvals-${documentType}-${documentId}`] });
      setShowApprovalForm(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error approving"),
  });

  const reject = useMutation({
    mutationFn: (notes: string) =>
      api.post(`/approvals/${documentType}/${documentId}/reject`, { notes }),
    onSuccess: () => {
      toast.success("Document rejected. Approvals reset.");
      qc.invalidateQueries({ queryKey: [`approvals-${documentType}-${documentId}`] });
      setShowApprovalForm(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error rejecting"),
  });

  if (isLoading) return <div className="text-xs text-slate-400">Loading approval status...</div>;
  if (!status) return null;

  const { records, is_approved, total_steps, steps_completed } = status;

  if (total_steps === 0) {
    return (
      <div className="text-xs text-slate-400">
        No approvals required for {documentType}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${(steps_completed / total_steps) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-500">
          {steps_completed}/{total_steps}
        </span>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {records.map((record) => {
          const isActive = record.status === "PENDING";
          const isCompleted = record.status === "APPROVED";
          const isRejected = record.status === "REJECTED";

          return (
            <div
              key={record.id}
              className={cn(
                "flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors",
                isCompleted ? "bg-emerald-50 border-emerald-200" :
                isRejected ? "bg-red-50 border-red-200" :
                isActive ? "bg-amber-50 border-amber-200" :
                "bg-slate-50 border-slate-200"
              )}
            >
              <div className="flex-shrink-0 pt-0.5">
                {isCompleted && <CheckCircle2 size={14} className="text-emerald-600" />}
                {isRejected && <XCircle size={14} className="text-red-600" />}
                {isActive && <Clock size={14} className="text-amber-600 animate-pulse" />}
                {!isCompleted && !isRejected && !isActive && <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-medium leading-tight",
                  isCompleted ? "text-emerald-700" :
                  isRejected ? "text-red-700" :
                  isActive ? "text-amber-700" :
                  "text-slate-600"
                )}>
                  Step {record.step_number}: {record.required_role || "Unknown Role"}
                  {isActive && currentUserRole === record.required_role && (
                    <span className="ml-2 text-amber-600 font-semibold">(You can approve)</span>
                  )}
                </p>
                {record.notes && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                    <MessageCircle size={10} className="flex-shrink-0 mt-0.5" />
                    {record.notes}
                  </p>
                )}
                {record.approved_by && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <User size={10} />
                    Approved on {new Date(record.approved_at!).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Approval action for current step */}
      {canApprove && !is_approved && (
        <ApprovalActionForm
          loading={approve.isPending || reject.isPending}
          onApprove={(notes) => approve.mutate(notes)}
          onReject={(notes) => reject.mutate(notes)}
          open={showApprovalForm}
          onOpenChange={setShowApprovalForm}
        />
      )}

      {/* Status badge */}
      {is_approved && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 size={13} />
          All approvals complete
        </div>
      )}
    </div>
  );
}

function ApprovalActionForm({
  loading,
  onApprove,
  onReject,
  open,
  onOpenChange,
}: {
  loading: boolean;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          className="btn-success py-1 text-xs flex-1"
          onClick={() => { setMode("approve"); onOpenChange(true); }}
        >
          ✓ Approve
        </button>
        <button
          className="btn-danger py-1 text-xs flex-1"
          onClick={() => { setMode("reject"); onOpenChange(true); }}
        >
          ✕ Reject
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <textarea
        className="input form-textarea resize-none text-xs"
        rows={2}
        placeholder={mode === "approve" ? "Optional approval notes..." : "Reason for rejection (required)..."}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={loading}
      />
      <div className="flex gap-2">
        <button
          className="btn-secondary py-1 text-xs flex-1"
          onClick={() => { setMode("idle"); setNotes(""); onOpenChange(false); }}
          disabled={loading}
        >
          Cancel
        </button>
        {mode === "approve" ? (
          <button
            className="btn-success py-1 text-xs flex-1 flex items-center justify-center gap-1"
            onClick={() => onApprove(notes || undefined)}
            disabled={loading}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Confirm Approve
          </button>
        ) : (
          <button
            className="btn-danger py-1 text-xs flex-1 flex items-center justify-center gap-1"
            onClick={() => onReject(notes || "No reason provided")}
            disabled={loading || !notes}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Confirm Reject
          </button>
        )}
      </div>
    </div>
  );
}
