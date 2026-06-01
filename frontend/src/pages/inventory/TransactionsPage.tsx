import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner } from "../../components/ui";
import { clsx } from "clsx";
import type { InventoryTransaction } from "../../lib/types";

export function TransactionsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.append("from_date", from);
  if (to) params.append("to_date", to);

  const { data: txns, isLoading } = useQuery<InventoryTransaction[]>({
    queryKey: ["inv-txns", from, to],
    queryFn: () => api.get(`/inventory/transactions?${params}`).then(r => r.data),
  });

  return (
    <div>
      <PageHeader title="Inventory Transactions" />
      <div className="page-shell">
        <div className="flex gap-3 mb-4">
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>SKU</th><th>Product</th><th>Type</th><th>Ref</th><th className="text-right">Qty</th><th className="text-right">Unit Cost</th></tr></thead>
              <tbody>
                {(txns ?? []).map(t => (
                  <tr key={t.id}>
                    <td>{fmt.date(t.txn_date)}</td>
                    <td className="font-mono text-xs mono text-violet-700">{t.product_sku}</td>
                    <td>{t.product_name}</td>
                    <td><span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{t.txn_type}</span></td>
                    <td className="font-mono text-xs text-slate-500">{t.reference_type}-{t.reference_id}</td>
                    <td className={clsx("text-right font-mono font-semibold", t.direction === 1 ? "text-green-700" : "text-red-600")}>
                      {t.direction === 1 ? "+" : "−"}{fmt.number(t.qty, 2)}
                    </td>
                    <td className="text-right font-mono">{fmt.currency(t.unit_cost)}</td>
                  </tr>
                ))}
                {!txns?.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No transactions</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
