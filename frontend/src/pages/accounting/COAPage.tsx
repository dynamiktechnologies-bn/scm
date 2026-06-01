import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import {
  PageHeader, TableSkeleton, EmptyState, Modal, FormField, Input, Select,
} from "../../components/ui";
import { Plus, BookOpen } from "lucide-react";
import type { Account } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { cn } from "../../components/ui";

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

const TYPE_STYLE: Record<string, string> = {
  ASSET:     "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
  LIABILITY: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
  EQUITY:    "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60",
  REVENUE:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  EXPENSE:   "bg-red-50 text-red-700 ring-1 ring-red-200/60",
};

const ACCOUNT_TYPES = [
  { value: "ASSET",     label: "Asset",     normal: "D" },
  { value: "LIABILITY", label: "Liability", normal: "C" },
  { value: "EQUITY",    label: "Equity",    normal: "C" },
  { value: "REVENUE",   label: "Revenue",   normal: "C" },
  { value: "EXPENSE",   label: "Expense",   normal: "D" },
];

export function COAPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data, isLoading } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounting/accounts?active_only=false").then((r) => r.data),
  });

  const byType: Record<string, Account[]> = {};
  for (const a of data ?? []) {
    if (!byType[a.account_type]) byType[a.account_type] = [];
    byType[a.account_type].push(a);
  }

  const totalActive = (data ?? []).filter((a) => a.is_active).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Chart of Accounts"
        subtitle={`${totalActive} active account${totalActive !== 1 ? "s" : ""}`}
        actions={
          <button
            className="btn-primary"
            onClick={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={14} /> New Account
          </button>
        }
      />

      <div className="page-shell space-y-5">
        {isLoading ? (
          <div className="card overflow-hidden">
            <table className="data-table"><tbody><TableSkeleton cols={5} rows={8} /></tbody></table>
          </div>
        ) : !data?.length ? (
          <div className="card">
            <EmptyState message="No accounts defined" icon={<BookOpen size={28} />} />
          </div>
        ) : (
          TYPE_ORDER.map((type) => {
            const accounts = byType[type];
            if (!accounts?.length) return null;
            return (
              <div key={type} className="card overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={cn("badge text-xs font-semibold", TYPE_STYLE[type])}>
                      {type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {accounts.length} account{accounts.length !== 1 ? "s" : ""}
                      {" · "}
                      Normal side: <strong>{ACCOUNT_TYPES.find((t) => t.value === type)?.normal}</strong>
                    </span>
                  </div>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th>Normal Side</th>
                      <th>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className={!a.is_active ? "opacity-50" : ""}>
                        <td>
                          <span className="mono bg-slate-100 px-2.5 py-1 rounded-md text-slate-800 font-semibold">
                            {a.code}
                          </span>
                        </td>
                        <td className="font-medium text-slate-800">{a.name}</td>
                        <td>
                          <span className={cn(
                            "mono text-xs px-2 py-0.5 rounded font-bold",
                            a.normal_side === "D"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}>
                            {a.normal_side === "D" ? "DR" : "CR"}
                          </span>
                        </td>
                        <td>
                          {a.is_active
                            ? <span className="text-emerald-600 text-sm">✓ Active</span>
                            : <span className="text-slate-400 text-sm">Inactive</span>}
                        </td>
                        <td>
                          <button
                            className="btn-ghost py-1 text-xs"
                            onClick={() => { setEditing(a); setShowForm(true); }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <AccountForm
          account={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["accounts"] }); }}
        />
      )}
    </div>
  );
}

function AccountForm({ account, onClose, onSaved }: {
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: account
      ? {
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          normal_side: account.normal_side,
          is_active: account.is_active,
        }
      : {
          code: "",
          name: "",
          account_type: "ASSET",
          normal_side: "D",
          is_active: true,
        },
  });

  // Auto-set normal_side when type changes
  const watchType = watch("account_type");
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = ACCOUNT_TYPES.find((x) => x.value === e.target.value);
    if (t) setValue("normal_side", t.normal);
  };

  const mutation = useMutation({
    mutationFn: (data: any) =>
      account
        ? api.put(`/accounting/accounts/${account.id}`, data)
        : api.post("/accounting/accounts", data),
    onSuccess: () => {
      toast.success(account ? "Account updated" : "Account created");
      onSaved();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error saving account"),
  });

  return (
    <Modal
      open
      size="sm"
      title={account ? `Edit — ${account.code}` : "New Account"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Save Account"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Account Code *"
            hint='e.g. "1200", "5000"'
            error={errors.code?.message as string}
          >
            <Input
              {...register("code", { required: "Required" })}
              disabled={!!account}
              placeholder="1200"
              className="mono"
            />
          </FormField>

          <FormField label="Account Type *">
            <Select
              {...register("account_type", { required: true })}
              onChange={(e) => {
                register("account_type").onChange(e);
                handleTypeChange(e);
              }}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Account Name *" error={errors.name?.message as string}>
          <Input
            {...register("name", { required: "Required" })}
            placeholder="e.g. Inventory Asset"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Normal Side" hint="Debit increases asset/expense; Credit increases liability/equity/revenue">
            <Select {...register("normal_side")}>
              <option value="D">Debit (D)</option>
              <option value="C">Credit (C)</option>
            </Select>
          </FormField>

          {account && (
            <FormField label="Status">
              <Select {...register("is_active", { setValueAs: (v) => v === "true" || v === true })}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </FormField>
          )}
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-600">Accounting reference</p>
          <p><strong>Asset / Expense</strong> → normal side Debit (balance increases with DR)</p>
          <p><strong>Liability / Equity / Revenue</strong> → normal side Credit (balance increases with CR)</p>
        </div>
      </div>
    </Modal>
  );
}
