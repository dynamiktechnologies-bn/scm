import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import {
  PageHeader, Spinner, StatusBadge, Modal, FormField, Input, Select,
  TableSkeleton, EmptyState,
} from "../../components/ui";
import { Plus, Search, Package } from "lucide-react";
import type { Product, UoM, Account, Supplier } from "../../lib/types";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

export function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => api.get("/products?active_only=false").then((r) => r.data),
  });
  const { data: uoms }     = useQuery<UoM[]>({ queryKey: ["uoms"], queryFn: () => api.get("/products/uom").then((r) => r.data) });
  const { data: accounts } = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: () => api.get("/accounting/accounts").then((r) => r.data) });
  const { data: suppliers} = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then((r) => r.data) });

  const filtered = (products ?? []).filter(
    (p) => p.sku.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Item Master"
        subtitle={`${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={14} /> New Product
          </button>
        }
      />

      <div className="page-shell">
        {/* Search */}
        <div className="flex gap-3">
          <div className="relative max-w-xs w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search SKU or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>UoM</th>
                <th>Method</th>
                <th className="text-right">Avg Cost</th>
                <th className="text-right">Reorder Pt.</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton cols={8} rows={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState message="No products found" icon={<Package size={32} />} />
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="mono text-violet-700 font-medium">{p.sku}</td>
                    <td className="font-medium text-slate-800">{p.name}</td>
                    <td className="text-slate-500">{p.uom?.code}</td>
                    <td>
                      <span className="mono bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">
                        {p.valuation_method}
                      </span>
                    </td>
                    <td className="text-right mono text-slate-700">{fmt.currency(p.current_avg_cost)}</td>
                    <td className="text-right mono text-slate-600">{fmt.number(p.reorder_point, 0)}</td>
                    <td>
                      <StatusBadge status={p.is_active ? "APPROVED" : "CANCELLED"} />
                    </td>
                    <td>
                      <button
                        className="btn-ghost py-1 text-xs"
                        onClick={() => { setEditing(p); setShowForm(true); }}
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
        <ProductForm
          product={editing}
          uoms={uoms ?? []}
          accounts={accounts ?? []}
          suppliers={suppliers ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["products"] }); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, uoms, accounts, suppliers, onClose, onSaved }: {
  product: Product | null; uoms: UoM[]; accounts: Account[]; suppliers: Supplier[];
  onClose: () => void; onSaved: () => void;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: product ?? {
      sku: "", name: "", description: "", uom_id: "",
      reorder_point: "0", reorder_qty: "0",
      valuation_method: "WAVG", current_avg_cost: "0",
      inventory_account_id: "", cogs_account_id: "", revenue_account_id: "",
      preferred_supplier_id: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (data: any) =>
      product ? api.put(`/products/${product.id}`, data) : api.post("/products", data),
    onSuccess: () => { toast.success(product ? "Product updated" : "Product created"); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? "Error saving product"),
  });

  const inv = accounts.filter((a) => a.account_type === "ASSET");
  const cogs = accounts.filter((a) => a.account_type === "EXPENSE");
  const rev = accounts.filter((a) => a.account_type === "REVENUE");

  return (
    <Modal
      open
      title={product ? `Edit — ${product.sku}` : "New Product"}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit((d) => mutation.mutate(d))}>
            {mutation.isPending ? "Saving…" : "Save Product"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField label="SKU *" error={errors.sku?.message as string}>
          <Input {...register("sku", { required: "Required" })} disabled={!!product} />
        </FormField>
        <FormField label="Name *" error={errors.name?.message as string}>
          <Input {...register("name", { required: "Required" })} />
        </FormField>
        <FormField label="Unit of Measure *">
          <Select {...register("uom_id", { required: true, valueAsNumber: true })}>
            <option value="">Select UoM</option>
            {uoms.map((u) => <option key={u.id} value={u.id}>{u.code} – {u.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Valuation Method">
          <Select {...register("valuation_method")}>
            <option value="WAVG">Weighted Average (WAVG)</option>
            <option value="FIFO">First In First Out (FIFO)</option>
          </Select>
        </FormField>
        <FormField label="Current Avg Cost">
          <Input type="number" step="0.0001" {...register("current_avg_cost")} />
        </FormField>
        <FormField label="Reorder Point">
          <Input type="number" step="1" {...register("reorder_point")} />
        </FormField>
        <FormField label="Reorder Quantity">
          <Input type="number" step="1" {...register("reorder_qty")} />
        </FormField>
        <FormField label="Preferred Supplier">
          <Select {...register("preferred_supplier_id", { setValueAs: (v) => v ? parseInt(v) : null })}>
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </FormField>

        <div className="col-span-2 grid grid-cols-3 gap-4">
          <FormField label="Inventory Account" hint="Asset account">
            <Select {...register("inventory_account_id", { setValueAs: (v) => v ? parseInt(v) : null })}>
              <option value="">Select</option>
              {inv.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </Select>
          </FormField>
          <FormField label="COGS Account" hint="Expense account">
            <Select {...register("cogs_account_id", { setValueAs: (v) => v ? parseInt(v) : null })}>
              <option value="">Select</option>
              {cogs.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Revenue Account" hint="Revenue account">
            <Select {...register("revenue_account_id", { setValueAs: (v) => v ? parseInt(v) : null })}>
              <option value="">Select</option>
              {rev.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
            </Select>
          </FormField>
        </div>

        <div className="col-span-2">
          <FormField label="Description">
            <Input {...register("description")} />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
