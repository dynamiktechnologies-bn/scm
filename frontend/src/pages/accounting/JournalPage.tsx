import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select, TableSkeleton, EmptyState } from "../../components/ui";
import { Search, Plus, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import type { JournalEntry, Account } from "../../lib/types";
import { clsx } from "clsx";
import { useForm, useFieldArray } from "react-hook-form";
import toast from "react-hot-toast";

export function JournalPage() {
  const qc = useQueryClient();
  const [reference, setReference] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  const params = new URLSearchParams();
  if (reference) params.append("reference", reference);
  if (from) params.append("from_date", from);
  if (to) params.append("to_date", to);

  const { data: entries, isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal-entries", reference, from, to],
    queryFn: () => api.get(`/accounting/journal-entries?${params}`).then((r) => r.data),
  });

  const totalDr = (selected?.lines ?? []).reduce((s, l) => s + Number(l.debit), 0);
  const totalCr = (selected?.lines ?? []).reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Journal Entries"
        subtitle={`${entries?.length ?? 0} entries`}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Manual Journal
          </button>
        }
      />

      <div className="page-shell">
        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="relative max-w-xs flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search reference…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <label className="label">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Source</th>
                <th>Memo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={6} rows={6} />
              ) : !entries?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="No journal entries yet" icon={<BookOpen size={28} />} />
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                    <td className="text-slate-600">{fmt.date(e.entry_date)}</td>
                    <td className="mono text-violet-700 font-medium">{e.reference ?? "—"}</td>
                    <td>
                      <span className={clsx(
                        "mono text-xs px-2 py-0.5 rounded-md",
                        e.source_type === "MANUAL"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {e.source_type ?? "—"}
                      </span>
                    </td>
                    <td className="text-slate-500 max-w-xs truncate">{e.memo ?? "—"}</td>
                    <td><StatusBadge status={e.is_posted ? "POSTED" : "DRAFT"} /></td>
                    <td className="text-xs text-violet-600 hover:underline">View</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal
          open
          size="lg"
          title={`Journal Entry — ${selected.reference ?? `#${selected.id}`}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4">
            <div className="flex gap-6 text-sm text-slate-600 flex-wrap">
              <span>Date: <strong className="text-slate-900">{fmt.date(selected.entry_date)}</strong></span>
              <span>Source: <strong className="text-slate-900">{selected.source_type}{selected.source_id ? ` #${selected.source_id}` : ""}</strong></span>
              {selected.memo && <span>Memo: <em className="text-slate-500">{selected.memo}</em></span>}
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Account Name</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(selected.lines ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="mono text-violet-700">{l.account_code}</td>
                    <td className="text-slate-700">{l.account_name}</td>
                    <td className="text-slate-500 text-xs">{l.description ?? "—"}</td>
                    <td className={clsx("text-right mono", Number(l.debit) > 0 ? "font-semibold text-slate-800" : "text-slate-300")}>
                      {Number(l.debit) > 0 ? fmt.currency(l.debit) : "—"}
                    </td>
                    <td className={clsx("text-right mono", Number(l.credit) > 0 ? "font-semibold text-slate-800" : "text-slate-300")}>
                      {Number(l.credit) > 0 ? fmt.currency(l.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200">
                <tr className="font-semibold bg-slate-50/70">
                  <td colSpan={3} className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-slate-500">
                    Totals
                  </td>
                  <td className="px-4 py-2.5 text-right mono">{fmt.currency(totalDr)}</td>
                  <td className="px-4 py-2.5 text-right mono">{fmt.currency(totalCr)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-center text-xs">
                    {isBalanced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 size={13} /> Balanced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                        <XCircle size={13} /> Not balanced — diff: {fmt.currency(Math.abs(totalDr - totalCr))}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Modal>
      )}

      {showForm && (
        <ManualJournalForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["journal-entries"] });
          }}
        />
      )}
    </div>
  );
}

// ── Manual Journal Form ───────────────────────────────────────────────────────

function ManualJournalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounting/accounts").then((r) => r.data),
  });

  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: {
      entry_date: new Date().toISOString().split("T")[0],
      reference: "",
      memo: "",
      lines: [
        { account_id: "", debit: "", credit: "", description: "" },
        { account_id: "", debit: "", credit: "", description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const watchLines = watch("lines");
  const totalDr = watchLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCr = watchLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const diff = totalDr - totalCr;
  const balanced = Math.abs(diff) < 0.01 && totalDr > 0;

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.post("/accounting/journal-entries", {
        entry_date: data.entry_date,
        reference: data.reference || null,
        memo: data.memo || null,
        lines: data.lines
          .filter((l: any) => l.account_id)
          .map((l: any) => ({
            account_id: parseInt(l.account_id),
            debit:  parseFloat(l.debit)  || 0,
            credit: parseFloat(l.credit) || 0,
            description: l.description || null,
          })),
      }),
    onSuccess: () => { toast.success("Manual journal posted"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error posting journal"),
  });

  return (
    <Modal
      open
      size="xl"
      title="New Manual Journal Entry"
      onClose={onClose}
      footer={
        <>
          <div className="flex-1 text-xs">
            {totalDr === 0 ? (
              <span className="text-slate-400">Enter amounts to check balance</span>
            ) : balanced ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> Balanced — {fmt.currency(totalDr)}
              </span>
            ) : (
              <span className="text-red-500 font-medium flex items-center gap-1">
                <XCircle size={13} />
                {diff > 0
                  ? `DR exceeds CR by ${fmt.currency(diff)}`
                  : `CR exceeds DR by ${fmt.currency(Math.abs(diff))}`}
              </span>
            )}
          </div>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!balanced || mutation.isPending}
            onClick={handleSubmit((d) => mutation.mutate(d))}
          >
            {mutation.isPending ? "Posting…" : "Post Journal"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Date *">
            <Input type="date" {...register("entry_date", { required: true })} />
          </FormField>
          <FormField label="Reference" hint='e.g. "ACCRUAL-JUN-26", "DEPR-2026-06"'>
            <Input placeholder="Optional…" {...register("reference")} />
          </FormField>
          <FormField label="Memo">
            <Input placeholder="What is this entry for?" {...register("memo")} />
          </FormField>
        </div>

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="label mb-0">Journal Lines</span>
            <button
              type="button"
              className="text-xs font-medium text-violet-600 hover:text-violet-700"
              onClick={() => append({ account_id: "", debit: "", credit: "", description: "" })}
            >
              + Add line
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 mb-1">
            <div className="col-span-4 label mb-0">Account</div>
            <div className="col-span-3 label mb-0">Line description</div>
            <div className="col-span-2 label mb-0 text-right">Debit</div>
            <div className="col-span-2 label mb-0 text-right">Credit</div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-1.5">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select {...register(`lines.${i}.account_id`)}>
                    <option value="">Select account…</option>
                    {(accounts ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input placeholder="Note…" {...register(`lines.${i}.description`)} />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="text-right mono"
                    {...register(`lines.${i}.debit`)}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="text-right mono"
                    {...register(`lines.${i}.credit`)}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    onClick={() => remove(i)}
                    disabled={fields.length <= 2}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Running totals */}
          <div className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t border-slate-200">
            <div className="col-span-7 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-end">
              Totals
            </div>
            <div className="col-span-2 text-right mono font-semibold text-slate-800">
              {totalDr > 0 ? fmt.currency(totalDr) : "—"}
            </div>
            <div className="col-span-2 text-right mono font-semibold text-slate-800">
              {totalCr > 0 ? fmt.currency(totalCr) : "—"}
            </div>
            <div className="col-span-1" />
          </div>
        </div>

        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
          <strong className="text-slate-600">Rule:</strong> Enter either Debit <strong>or</strong> Credit on each line — not both.
          The <strong>Post Journal</strong> button enables only when total debits = total credits.
        </p>
      </div>
    </Modal>
  );
}
