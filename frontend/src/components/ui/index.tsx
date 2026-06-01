import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";
import { Loader2, X, AlertCircle, CheckCircle2 } from "lucide-react";

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ── Page Header ─────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80">
      <div>
        <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  draft:             "badge-draft",
  approved:          "badge-approved",
  matched:           "badge-approved",
  confirmed:         "badge-approved",
  fully_received:    "badge-approved",
  fully_shipped:     "badge-approved",
  active:            "badge-approved",
  posted:            "badge-posted",
  paid:              "badge-posted",
  cancelled:         "badge-cancelled",
  submitted:         "badge-pending",
  received:          "badge-pending",
  partially_received:"badge-pending",
  partially_shipped: "badge-pending",
  picking:           "badge-pending",
};

const STATUS_DOT: Record<string, string> = {
  "badge-approved": "bg-emerald-500",
  "badge-posted":   "bg-blue-500",
  "badge-cancelled":"bg-red-400",
  "badge-pending":  "bg-amber-400",
  "badge-draft":    "bg-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/ /g, "_");
  const cls = STATUS_MAP[key] ?? "badge-draft";
  const dot = STATUS_DOT[cls] ?? "bg-slate-400";
  return (
    <span className={cls}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <Loader2 size={22} className="animate-spin text-violet-500" />
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 rounded-md bg-slate-100 animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      {icon && <div className="opacity-40">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Error Banner ─────────────────────────────────────────────────────────────
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-6 mt-4 flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
      <AlertCircle size={15} className="flex-shrink-0" />
      {message}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-5xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={cn("relative bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh] animate-slide-up", widths[size])}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Form Field ───────────────────────────────────────────────────────────────
export function FormField({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Input / Select / Textarea ────────────────────────────────────────────────
export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input form-input", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input form-select pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input form-textarea resize-none", className)} rows={3} {...props} />;
}

// ── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="card p-5 hover:shadow-card-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          {icon}
        </div>
        {trend && (
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
            trend.value >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          )}>
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5 uppercase tracking-wide">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Header (inside a card) ───────────────────────────────────────────
export function SectionHeader({ title, icon, action }: { title: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon && <span className="text-slate-400">{icon}</span>}
        {title}
      </div>
      {action}
    </div>
  );
}

// Re-export ProcessBar for convenience
export { ProcessBar, type ProcessStep, type StepStatus } from "./ProcessBar";
