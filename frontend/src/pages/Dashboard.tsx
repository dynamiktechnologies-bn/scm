import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "../lib/api";
import { Spinner, StatCard, SectionHeader, StatusBadge } from "../components/ui";
import { Truck, ShoppingCart, Package, AlertTriangle, ArrowRight } from "lucide-react";
import type { PurchaseOrder, SalesOrder, StockBalance } from "../lib/types";
import { Link } from "react-router-dom";

export function Dashboard() {
  const { data: pos, isLoading: l1 } = useQuery<PurchaseOrder[]>({
    queryKey: ["po-open"],
    queryFn: () => api.get("/purchase/orders?po_status=APPROVED").then((r) => r.data),
  });
  const { data: sos, isLoading: l2 } = useQuery<SalesOrder[]>({
    queryKey: ["so-open"],
    queryFn: () => api.get("/sales/orders?so_status=CONFIRMED").then((r) => r.data),
  });
  const { data: stock, isLoading: l3 } = useQuery<StockBalance[]>({
    queryKey: ["stock-all"],
    queryFn: () => api.get("/inventory/stock").then((r) => r.data),
  });
  const { data: lowStock } = useQuery<any[]>({
    queryKey: ["low-stock"],
    queryFn: () => api.get("/products/below-reorder").then((r) => r.data),
  });

  if (l1 || l2 || l3) return <Spinner />;

  const totalInventoryValue = (stock ?? []).reduce((s, r) => s + Number(r.inventory_value), 0);
  const totalSOValue = (sos ?? []).reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200/80 bg-white">
        <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="page-shell">
        {/* KPI Row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Approved POs"
            value={String(pos?.length ?? 0)}
            sub="awaiting goods receipt"
            icon={<Truck size={18} className="text-blue-600" />}
            iconBg="bg-blue-50"
          />
          <StatCard
            label="Open Sales Orders"
            value={String(sos?.length ?? 0)}
            sub={fmt.currency(totalSOValue) + " total"}
            icon={<ShoppingCart size={18} className="text-violet-600" />}
            iconBg="bg-violet-50"
          />
          <StatCard
            label="Inventory Value"
            value={fmt.currency(totalInventoryValue)}
            sub={`${stock?.length ?? 0} active lines`}
            icon={<Package size={18} className="text-emerald-600" />}
            iconBg="bg-emerald-50"
          />
          <StatCard
            label="Low Stock Alerts"
            value={String(lowStock?.length ?? 0)}
            sub="at or below reorder point"
            icon={<AlertTriangle size={18} className="text-amber-600" />}
            iconBg="bg-amber-50"
          />
        </div>

        {/* Detail panels */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Open POs */}
          <div className="card overflow-hidden">
            <SectionHeader
              title="Approved Purchase Orders"
              icon={<Truck size={14} />}
              action={
                <Link to="/purchase/orders" className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                  View all <ArrowRight size={11} />
                </Link>
              }
            />
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Expected</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(pos ?? []).slice(0, 5).map((po) => (
                  <tr key={po.id}>
                    <td>
                      <Link to={`/purchase/orders`} className="mono text-violet-700 hover:underline">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="text-slate-600">{po.supplier_id}</td>
                    <td className="text-slate-500 text-xs">
                      {po.expected_date ? fmt.date(po.expected_date) : "—"}
                    </td>
                    <td className="text-right mono font-medium">{fmt.currency(po.total_amount)}</td>
                  </tr>
                ))}
                {!pos?.length && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-400 py-8 text-sm">
                      No open purchase orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Low Stock */}
          <div className="card overflow-hidden">
            <SectionHeader
              title="Low Stock Alerts"
              icon={<AlertTriangle size={14} />}
              action={
                <Link to="/inventory/stock" className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                  View stock <ArrowRight size={11} />
                </Link>
              }
            />
            {!lowStock?.length ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Package size={18} className="text-emerald-500" />
                </div>
                <p className="text-sm text-slate-500">All products above reorder point</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="text-right">On Hand</th>
                    <th className="text-right">Reorder At</th>
                  </tr>
                </thead>
                <tbody>
                  {(lowStock ?? []).slice(0, 8).map((p: any) => (
                    <tr key={p.id}>
                      <td className="mono text-violet-700">{p.sku}</td>
                      <td className="text-slate-700">{p.name}</td>
                      <td className="text-right mono text-slate-600">{fmt.number(p.current_avg_cost, 0)}</td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={9} />
                          {p.reorder_point}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Stock summary */}
          <div className="card overflow-hidden xl:col-span-2">
            <SectionHeader
              title="Inventory Snapshot"
              icon={<Package size={14} />}
              action={
                <Link to="/inventory/stock" className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                  Full stock <ArrowRight size={11} />
                </Link>
              }
            />
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Location</th>
                  <th className="text-right">On Hand</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {(stock ?? []).slice(0, 8).map((s, i) => (
                  <tr key={i}>
                    <td className="mono text-violet-700">{s.sku}</td>
                    <td className="font-medium text-slate-800">{s.name}</td>
                    <td className="text-slate-500 text-xs">{s.location_code} · {s.warehouse_name}</td>
                    <td className="text-right mono font-semibold">{fmt.number(s.qty_on_hand, 2)}</td>
                    <td className="text-right mono text-slate-500">{fmt.currency(s.avg_cost)}</td>
                    <td className="text-right mono font-semibold text-emerald-700">{fmt.currency(s.inventory_value)}</td>
                  </tr>
                ))}
                {!stock?.length && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">No inventory</td></tr>
                )}
              </tbody>
              {(stock?.length ?? 0) > 0 && (
                <tfoot>
                  <tr className="bg-slate-50/70 border-t border-slate-200">
                    <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Total Inventory Value
                    </td>
                    <td className="px-4 py-2.5 text-right mono font-bold text-emerald-700">
                      {fmt.currency(totalInventoryValue)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
