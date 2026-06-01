import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner } from "../../components/ui";
import { Search } from "lucide-react";
import type { StockBalance } from "../../lib/types";

export function StockPage() {
  const [search, setSearch] = useState("");

  const { data: stock, isLoading } = useQuery<StockBalance[]>({
    queryKey: ["stock-all"],
    queryFn: () => api.get("/inventory/stock").then(r => r.data),
    refetchInterval: 30000,
  });

  const filtered = (stock ?? []).filter(s =>
    s.sku.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce((s, r) => s + Number(r.inventory_value), 0);

  return (
    <div>
      <PageHeader title="Stock on Hand" />
      <div className="page-shell">
        <div className="flex items-center justify-between mb-4">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-8" placeholder="Search SKU or name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="text-sm text-slate-600">
            Total value: <span className="font-semibold text-slate-900">{fmt.currency(totalValue)}</span>
          </div>
        </div>
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr>
                <th>SKU</th><th>Product</th><th>Location</th><th>Warehouse</th>
                <th className="text-right">Qty on Hand</th>
                <th className="text-right">Avg Cost</th>
                <th className="text-right">Value</th>
              </tr></thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs mono text-violet-700">{s.sku}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="font-mono text-xs text-slate-500">{s.location_code}</td>
                    <td className="text-slate-500">{s.warehouse_name}</td>
                    <td className="text-right font-mono font-semibold">{fmt.number(s.qty_on_hand, 2)}</td>
                    <td className="text-right font-mono">{fmt.currency(s.avg_cost)}</td>
                    <td className="text-right font-mono font-semibold text-green-700">{fmt.currency(s.inventory_value)}</td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No stock</td></tr>}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={6} className="px-4 py-2 text-right text-sm">Total Inventory Value</td>
                    <td className="px-4 py-2 text-right font-mono text-green-700">{fmt.currency(totalValue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
