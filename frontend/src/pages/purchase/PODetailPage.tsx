import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge } from "../../components/ui";
import { ProcessBar, poSteps } from "../../components/ui/ProcessBar";
import { ApprovalWidget, type ApprovalStatusData } from "../../components/ui/ApprovalWidget";
import { ArrowLeft, XCircle, Send, Plus } from "lucide-react";
import type { PurchaseOrder, GoodsReceipt, SupplierInvoice } from "../../lib/types";
import { useAuthStore } from "../../stores/authStore";
import toast from "react-hot-toast";

export function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data: po, isLoading } = useQuery<PurchaseOrder>({
    queryKey: ["purchase-orders", id],
    queryFn: () => api.get(`/purchase/orders/${id}`).then((r) => r.data),
  });
  const { data: grns } = useQuery<GoodsReceipt[]>({
    queryKey: ["grns-for-po", id],
    queryFn: () => api.get(`/purchase/receipts`).then((r) =>
      (r.data as GoodsReceipt[]).filter((g) => g.po_id === parseInt(id!))
    ),
    enabled: !!id,
  });
  const { data: invoices } = useQuery<SupplierInvoice[]>({
    queryKey: ["invoices-for-po", id],
    queryFn: () => api.get(`/purchase/invoices`).then((r) =>
      (r.data as SupplierInvoice[]).filter((i) => i.po_id === parseInt(id!))
    ),
    enabled: !!id,
  });
  const { data: approvalStatus, isLoading: appLoading } = useQuery<ApprovalStatusData>({
    queryKey: [`approvals-PO-${id}`],
    queryFn: () => api.get(`/approvals/PO/${id}/status`).then((r) => r.data),
    enabled: !!id,
  });

  const submit = useMutation({
    mutationFn: () => api.post(`/purchase/orders/${id}/submit`),
    onSuccess: () => {
      toast.success("PO submitted - awaiting approval");
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      qc.invalidateQueries({ queryKey: [`approvals-PO-${id}`] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/purchase/orders/${id}/cancel`),
    onSuccess: () => { toast.success("PO cancelled"); qc.invalidateQueries({ queryKey: ["purchase-orders", id] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const matchInvoice = useMutation({
    mutationFn: (invId: number) => api.post(`/purchase/invoices/${invId}/match`),
    onSuccess: () => { toast.success("Invoice matched"); qc.invalidateQueries({ queryKey: ["invoices-for-po", id] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });
  const postGrn = useMutation({
    mutationFn: (grnId: number) => api.post(`/purchase/receipts/${grnId}/post`),
    onSuccess: () => {
      toast.success("GRN posted");
      qc.invalidateQueries({ queryKey: ["purchase-orders", id] });
      qc.invalidateQueries({ queryKey: ["grns-for-po", id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error"),
  });

  if (isLoading || !po) return <Spinner />;

  const matchedInvoiceCount = (invoices ?? []).filter((i) => i.status !== "RECEIVED").length;

  const steps = poSteps({
    status: po.status,
    grn_count: grns?.length ?? 0,
    invoice_count: invoices?.length ?? 0,
    matched_invoice_count: matchedInvoiceCount,
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={po.po_number}
        subtitle={`Purchase Order · Created ${fmt.date(po.order_date)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/purchase/orders" className="btn-secondary">
              <ArrowLeft size={14} /> Back
            </Link>
            {po.status === "DRAFT" && (
              <button className="btn-secondary" onClick={() => submit.mutate()}>
                <Send size={14} /> Submit
              </button>
            )}
            {["DRAFT","SUBMITTED","APPROVED"].includes(po.status) && (
              <button className="btn-danger" onClick={() => cancel.mutate()}>
                <XCircle size={14} /> Cancel
              </button>
            )}
            {["APPROVED","PARTIALLY_RECEIVED"].includes(po.status) && (
              <Link to="/purchase/receipts" className="btn-primary">
                <Plus size={14} /> New GRN
              </Link>
            )}
          </div>
        }
      />

      <div className="page-shell space-y-5">

        {/* ── Process Bar ─────────────────────────────────────────────── */}
        <div className="card px-8 py-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-700">Procure-to-Pay Progress</h3>
            <StatusBadge status={po.status} />
          </div>
          <ProcessBar steps={steps} />
        </div>

        {/* ── Approval Status ──────────────────────────────────────────── */}
        {approvalStatus && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Approval Status</h3>
            <ApprovalWidget
              documentType="PO"
              documentId={po.id}
              status={approvalStatus}
              isLoading={appLoading}
              canApprove={po.status === "SUBMITTED"}
              currentUserRole={user?.role}
            />
          </div>
        )}

        {/* ── Header details ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Order Details</h3>
            <DetailRow label="Supplier ID"   value={String(po.supplier_id)} />
            <DetailRow label="Order Date"    value={fmt.date(po.order_date)} />
            <DetailRow label="Expected Date" value={po.expected_date ? fmt.date(po.expected_date) : "Not set"} />
            <DetailRow label="Currency"      value={po.currency} />
            {po.notes && <DetailRow label="Notes" value={po.notes} />}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Amounts</h3>
            <DetailRow label="Subtotal"   value={fmt.currency(po.subtotal)} mono />
            <DetailRow label="Tax"        value={fmt.currency(po.tax_amount)} mono />
            <DetailRow label="Total"      value={fmt.currency(po.total_amount)} mono bold />
            <DetailRow label="Lines"      value={String(po.lines?.length ?? 0)} />
          </div>
        </div>

        {/* ── PO Lines ─────────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 text-sm font-semibold text-slate-700">
            Order Lines
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="text-right">Ordered</th>
                <th className="text-right">Received</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => {
                const outstanding = Number(line.qty_ordered) - Number(line.qty_received);
                const complete = outstanding <= 0;
                return (
                  <tr key={line.id}>
                    <td className="mono text-violet-700">{line.product?.sku}</td>
                    <td className="font-medium text-slate-800">{line.product?.name}</td>
                    <td className="text-right mono">{fmt.number(line.qty_ordered, 2)}</td>
                    <td className="text-right mono text-emerald-700">{fmt.number(line.qty_received, 2)}</td>
                    <td className="text-right">
                      <span className={complete ? "mono text-emerald-600 font-medium" : "mono text-amber-600 font-medium"}>
                        {complete ? "Complete" : fmt.number(outstanding, 2)}
                      </span>
                    </td>
                    <td className="text-right mono">{fmt.currency(line.unit_price)}</td>
                    <td className="text-right mono font-medium">
                      {fmt.currency(Number(line.qty_ordered) * Number(line.unit_price))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── GRN History ──────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Goods Receipts</span>
            <span className="text-xs text-slate-400">{grns?.length ?? 0} receipt{(grns?.length ?? 0) !== 1 ? "s" : ""}</span>
          </div>
          {!grns?.length ? (
            <p className="text-sm text-slate-400 text-center py-6">No goods receipts yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>GRN #</th>
                  <th>Date</th>
                  <th>Supplier Ref</th>
                  <th>Status</th>
                  <th>JE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td className="mono text-violet-700">{g.grn_number}</td>
                    <td>{fmt.date(g.receipt_date)}</td>
                    <td className="text-slate-500">{g.supplier_ref ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ProcessBar size="sm" steps={[
                          { key: "created", label: "Created", status: "completed" },
                          { key: "posted",  label: "Posted",  status: g.status === "POSTED" ? "completed" : "active" },
                        ]} />
                        <StatusBadge status={g.status} />
                      </div>
                    </td>
                    <td className="mono text-slate-400">{g.je_id ?? "—"}</td>
                    <td>
                      {g.status === "DRAFT" && (
                        <button className="btn-success py-1 text-xs" onClick={() => postGrn.mutate(g.id)}>
                          Post
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Invoices ─────────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Supplier Invoices</span>
            <span className="text-xs text-slate-400">{invoices?.length ?? 0} invoice{(invoices?.length ?? 0) !== 1 ? "s" : ""}</span>
          </div>
          {!invoices?.length ? (
            <p className="text-sm text-slate-400 text-center py-6">No invoices received yet</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th>Progress</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono text-violet-700">{inv.inv_number}</td>
                    <td>{fmt.date(inv.invoice_date)}</td>
                    <td className="text-right mono font-medium">{fmt.currency(inv.total_amount)}</td>
                    <td>
                      <ProcessBar size="sm" steps={[
                        { key: "received", label: "Received", status: "completed" },
                        { key: "matched",  label: "Matched",  status: inv.status === "RECEIVED" ? "active" : "completed" },
                        { key: "paid",     label: "Paid",     status: inv.status === "PAID" ? "completed" : "pending" },
                      ]} />
                    </td>
                    <td>
                      {inv.status === "RECEIVED" && (
                        <button className="btn-success py-1 text-xs" onClick={() => matchInvoice.mutate(inv.id)}>
                          Match
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${bold ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}
