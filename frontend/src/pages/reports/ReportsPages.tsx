import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner } from "../../components/ui";
import type { ValuationRow, StockAgingRow, MarginRow } from "../../lib/types";
import { clsx } from "clsx";

export function InventoryValuationPage() {
  const { data, isLoading } = useQuery<ValuationRow[]>({
    queryKey: ["report-valuation"],
    queryFn: () => api.get("/reports/inventory-valuation").then(r => r.data),
  });
  const totalValue = (data ?? []).reduce((s, r) => s + Number(r.inventory_value), 0);
  return (
    <div>
      <PageHeader title="Inventory Valuation" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>SKU</th><th>Name</th><th className="text-right">Qty on Hand</th><th className="text-right">Avg Cost</th><th className="text-right">Value</th></tr></thead>
              <tbody>
                {(data ?? []).map(r => (
                  <tr key={r.product_id}>
                    <td className="font-mono text-xs mono text-violet-700">{r.sku}</td>
                    <td>{r.name}</td>
                    <td className="text-right font-mono">{fmt.number(r.qty_on_hand, 2)}</td>
                    <td className="text-right font-mono">{fmt.currency(r.avg_cost)}</td>
                    <td className="text-right font-mono font-semibold text-green-700">{fmt.currency(r.inventory_value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr className="font-semibold bg-slate-50">
                  <td colSpan={4} className="px-4 py-2 text-right">Total</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700">{fmt.currency(totalValue)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function StockAgingPage() {
  const { data, isLoading } = useQuery<StockAgingRow[]>({
    queryKey: ["report-aging"],
    queryFn: () => api.get("/reports/stock-aging").then(r => r.data),
  });
  return (
    <div>
      <PageHeader title="Stock Aging" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>SKU</th><th>Name</th><th>Last Movement</th><th className="text-right">Days Idle</th><th className="text-right">Qty on Hand</th></tr></thead>
              <tbody>
                {(data ?? []).map(r => (
                  <tr key={r.product_id}>
                    <td className="font-mono text-xs mono text-violet-700">{r.sku}</td>
                    <td>{r.name}</td>
                    <td className="text-slate-500">{r.last_txn_date ? fmt.date(r.last_txn_date) : "Never"}</td>
                    <td className={clsx("text-right font-semibold", (r.days_since_last_movement ?? 0) > 90 ? "text-red-600" : (r.days_since_last_movement ?? 0) > 30 ? "text-amber-600" : "text-slate-700")}>
                      {r.days_since_last_movement ?? "—"}
                    </td>
                    <td className="text-right font-mono">{fmt.number(r.qty_on_hand, 2)}</td>
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

export function PurchaseRegisterPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["report-purchase-register"],
    queryFn: () => api.get("/reports/purchase-register").then(r => r.data),
  });
  return (
    <div>
      <PageHeader title="Purchase Register" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {(data ?? []).map(r => (
                  <tr key={r.po_id}>
                    <td className="font-mono text-xs mono text-violet-700">{r.po_number}</td>
                    <td>{fmt.date(r.order_date)}</td>
                    <td>{r.supplier_id}</td>
                    <td><span className="text-xs">{r.status}</span></td>
                    <td className="text-right font-mono">{fmt.currency(r.total_amount)}</td>
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

export function SalesRegisterPage() {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["report-sales-register"],
    queryFn: () => api.get("/reports/sales-register").then(r => r.data),
  });
  return (
    <div>
      <PageHeader title="Sales Register" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr><th>SO #</th><th>Date</th><th>Customer</th><th>Status</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {(data ?? []).map(r => (
                  <tr key={r.so_id}>
                    <td className="font-mono text-xs mono text-violet-700">{r.so_number}</td>
                    <td>{fmt.date(r.order_date)}</td>
                    <td>{r.customer_id}</td>
                    <td><span className="text-xs">{r.status}</span></td>
                    <td className="text-right font-mono">{fmt.currency(r.total_amount)}</td>
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

export function MarginReportPage() {
  const { data, isLoading } = useQuery<MarginRow[]>({
    queryKey: ["report-margin"],
    queryFn: () => api.get("/reports/margin").then(r => r.data),
  });
  const totalRevenue = (data ?? []).reduce((s, r) => s + Number(r.revenue), 0);
  const totalCOGS = (data ?? []).reduce((s, r) => s + Number(r.cogs), 0);
  const totalMargin = totalRevenue - totalCOGS;
  return (
    <div>
      <PageHeader title="Margin Report" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr>
                <th>SKU</th><th>Name</th>
                <th className="text-right">Qty Sold</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">COGS</th>
                <th className="text-right">Gross Margin</th>
                <th className="text-right">Margin %</th>
              </tr></thead>
              <tbody>
                {(data ?? []).map(r => (
                  <tr key={r.product_id}>
                    <td className="font-mono text-xs mono text-violet-700">{r.sku}</td>
                    <td>{r.name}</td>
                    <td className="text-right font-mono">{fmt.number(r.qty_sold, 2)}</td>
                    <td className="text-right font-mono">{fmt.currency(r.revenue)}</td>
                    <td className="text-right font-mono text-red-600">{fmt.currency(r.cogs)}</td>
                    <td className="text-right font-mono font-semibold text-green-700">{fmt.currency(r.gross_margin)}</td>
                    <td className={clsx("text-right font-semibold", Number(r.margin_pct) < 20 ? "text-amber-600" : "text-green-700")}>
                      {fmt.number(r.margin_pct, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              {data?.length ? (
                <tfoot className="border-t-2 bg-slate-50">
                  <tr className="font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt.currency(totalRevenue)}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-600">{fmt.currency(totalCOGS)}</td>
                    <td className="px-4 py-2 text-right font-mono text-green-700">{fmt.currency(totalMargin)}</td>
                    <td className="px-4 py-2 text-right">
                      {totalRevenue > 0 ? `${fmt.number(totalMargin / totalRevenue * 100, 1)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
