import { Check } from "lucide-react";
import { cn } from "./index";

export type StepStatus = "completed" | "active" | "pending" | "skipped" | "error";

export interface ProcessStep {
  key: string;
  label: string;
  sublabel?: string;
  status: StepStatus;
}

interface ProcessBarProps {
  steps: ProcessStep[];
  size?: "sm" | "md";
}

export function ProcessBar({ steps, size = "md" }: ProcessBarProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          {/* Step node */}
          <div className="flex flex-col items-center">
            <StepNode step={step} size={size} />
            {size === "md" && (
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-semibold leading-tight",
                  step.status === "completed" ? "text-emerald-700" :
                  step.status === "active"    ? "text-violet-700" :
                  step.status === "error"     ? "text-red-600" :
                  "text-slate-400"
                )}>
                  {step.label}
                </p>
                {step.sublabel && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{step.sublabel}</p>
                )}
              </div>
            )}
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div className={cn(
              "flex-1 h-0.5 mx-2 mt-0 rounded-full",
              size === "md" ? "-mt-5" : "mt-0",
              step.status === "completed" ? "bg-emerald-400" : "bg-slate-200"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepNode({ step, size }: { step: ProcessStep; size: "sm" | "md" }) {
  const dim = size === "md" ? "w-8 h-8" : "w-5 h-5";
  const icon = size === "md" ? 14 : 10;

  if (step.status === "completed") {
    return (
      <div className={cn(dim, "rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200")}>
        <Check size={icon} strokeWidth={3} className="text-white" />
      </div>
    );
  }
  if (step.status === "active") {
    return (
      <div className={cn(dim, "rounded-full bg-violet-600 flex items-center justify-center shadow-md shadow-violet-200 ring-4 ring-violet-100")}>
        <div className={cn("rounded-full bg-white", size === "md" ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} />
      </div>
    );
  }
  if (step.status === "error") {
    return (
      <div className={cn(dim, "rounded-full bg-red-500 flex items-center justify-center shadow-sm shadow-red-200")}>
        <span className="text-white font-bold" style={{ fontSize: icon - 2 }}>!</span>
      </div>
    );
  }
  if (step.status === "skipped") {
    return (
      <div className={cn(dim, "rounded-full bg-slate-200 flex items-center justify-center")}>
        <span className="text-slate-400" style={{ fontSize: icon - 2 }}>—</span>
      </div>
    );
  }
  // pending
  return (
    <div className={cn(dim, "rounded-full border-2 border-slate-200 bg-white flex items-center justify-center")}>
      <div className={cn("rounded-full bg-slate-300", size === "md" ? "w-2 h-2" : "w-1.5 h-1.5")} />
    </div>
  );
}

// ── Status → steps helpers ──────────────────────────────────────────────────

export function poSteps(po: {
  status: string;
  grn_count?: number;
  invoice_count?: number;
  matched_invoice_count?: number;
}): ProcessStep[] {
  const s = po.status;
  const hasGrn      = (po.grn_count ?? 0) > 0;
  const hasInvoice  = (po.invoice_count ?? 0) > 0;
  const hasMatched  = (po.matched_invoice_count ?? 0) > 0;

  const done  = (cond: boolean): StepStatus => cond ? "completed" : "pending";
  const after = (ref: boolean, curr: boolean): StepStatus =>
    ref ? (curr ? "completed" : "active") : "pending";

  const approved = ["APPROVED","PARTIALLY_RECEIVED","FULLY_RECEIVED"].includes(s);
  const received = ["PARTIALLY_RECEIVED","FULLY_RECEIVED"].includes(s);

  return [
    { key: "draft",    label: "Created",     status: "completed" },
    { key: "approved", label: "Approved",    status: s === "DRAFT" || s === "SUBMITTED" ? (s === "SUBMITTED" ? "active" : "pending") : s === "CANCELLED" ? "error" : "completed" },
    { key: "grn",      label: "Goods Received", sublabel: hasGrn ? `${po.grn_count} GRN` : undefined,
                       status: !approved ? "pending" : hasGrn ? (received ? "completed" : "active") : "active" },
    { key: "invoice",  label: "Invoiced",    sublabel: hasInvoice ? `${po.invoice_count} invoice` : undefined,
                       status: !received ? "pending" : hasInvoice ? (hasMatched ? "completed" : "active") : "active" },
    { key: "matched",  label: "Matched",     status: !hasInvoice ? "pending" : hasMatched ? "completed" : "active" },
  ];
}

export function soSteps(so: {
  status: string;
  shipment_count?: number;
}): ProcessStep[] {
  const s = so.status;
  const hasShipment = (so.shipment_count ?? 0) > 0;

  return [
    { key: "draft",     label: "Created",    status: "completed" },
    { key: "confirmed", label: "Confirmed",
      status: s === "DRAFT" ? "active" : s === "CANCELLED" ? "error" : "completed" },
    { key: "picking",   label: "Picking",
      status: !["CONFIRMED","PICKING","PARTIALLY_SHIPPED","FULLY_SHIPPED"].includes(s) ? "pending"
            : s === "CONFIRMED" ? "active"
            : "completed" },
    { key: "shipped",   label: "Shipped",    sublabel: hasShipment ? `${so.shipment_count} shipment` : undefined,
      status: !["PARTIALLY_SHIPPED","FULLY_SHIPPED"].includes(s) ? "pending"
            : s === "FULLY_SHIPPED" ? "completed" : "active" },
    { key: "fulfilled", label: "Fulfilled",
      status: s === "FULLY_SHIPPED" ? "completed" : "pending" },
  ];
}

export function grnSteps(grn: { status: string; je_id?: number }): ProcessStep[] {
  return [
    { key: "created", label: "Created",   status: "completed" },
    { key: "posted",  label: "Posted",    sublabel: grn.je_id ? `JE #${grn.je_id}` : undefined,
      status: grn.status === "POSTED" ? "completed" : "active" },
    { key: "je",      label: "GL Updated", status: grn.je_id ? "completed" : "pending" },
  ];
}

export function shipmentSteps(ship: { status: string; cogs_je_id?: number; sales_je_id?: number }): ProcessStep[] {
  return [
    { key: "created",  label: "Created",       status: "completed" },
    { key: "posted",   label: "Dispatched",    status: ship.status === "POSTED" ? "completed" : "active" },
    { key: "cogs",     label: "COGS Posted",   sublabel: ship.cogs_je_id ? `JE #${ship.cogs_je_id}` : undefined,
      status: ship.cogs_je_id ? "completed" : "pending" },
    { key: "revenue",  label: "Revenue Posted", sublabel: ship.sales_je_id ? `JE #${ship.sales_je_id}` : undefined,
      status: ship.sales_je_id ? "completed" : "pending" },
  ];
}

export function invoiceSteps(inv: { status: string }): ProcessStep[] {
  const s = inv.status;
  return [
    { key: "received", label: "Received",  status: "completed" },
    { key: "matched",  label: "Matched",   status: s === "RECEIVED" ? "active" : "completed" },
    { key: "approved", label: "Approved",  status: ["RECEIVED","MATCHED"].includes(s) ? "pending" : "completed" },
    { key: "paid",     label: "Paid",      status: s === "PAID" ? "completed" : "pending" },
  ];
}
