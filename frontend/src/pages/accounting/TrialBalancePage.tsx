import { useQuery } from "@tanstack/react-query";
import { api, fmt } from "../../lib/api";
import { PageHeader, Spinner } from "../../components/ui";
import { clsx } from "clsx";
import type { TrialBalanceLine } from "../../lib/types";

export function TrialBalancePage() {
  const { data, isLoading } = useQuery<TrialBalanceLine[]>({
    queryKey: ["trial-balance"],
    queryFn: () => api.get("/accounting/trial-balance").then(r => r.data),
  });

  const totalDr = (data ?? []).reduce((s, r) => s + Number(r.debit_total), 0);
  const totalCr = (data ?? []).reduce((s, r) => s + Number(r.credit_total), 0);

  const byType: Record<string, TrialBalanceLine[]> = {};
  for (const row of data ?? []) {
    if (!byType[row.account_type]) byType[row.account_type] = [];
    byType[row.account_type].push(row);
  }
  const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

  return (
    <div>
      <PageHeader title="Trial Balance" />
      <div className="page-shell">
        <div className="card overflow-hidden">
          {isLoading ? <Spinner /> : (
            <table className="data-table">
              <thead><tr>
                <th>Code</th><th>Account Name</th><th>Type</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Balance</th>
              </tr></thead>
              <tbody>
                {typeOrder.map(type => {
                  const rows = byType[type];
                  if (!rows) return null;
                  return rows.map(r => (
                    <tr key={r.account_id}>
                      <td className="font-mono text-xs mono text-violet-700">{r.code}</td>
                      <td>{r.name}</td>
                      <td><span className="text-xs text-slate-500">{r.account_type}</span></td>
                      <td className="text-right font-mono">{Number(r.debit_total) > 0 ? fmt.currency(r.debit_total) : "—"}</td>
                      <td className="text-right font-mono">{Number(r.credit_total) > 0 ? fmt.currency(r.credit_total) : "—"}</td>
                      <td className={clsx("text-right font-mono font-semibold", Number(r.balance) < 0 ? "text-red-600" : "text-slate-900")}>
                        {fmt.currency(r.balance)}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 bg-slate-50">
                <tr className="font-semibold">
                  <td colSpan={3} className="px-4 py-2 text-right">Totals</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt.currency(totalDr)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmt.currency(totalCr)}</td>
                  <td className="px-4 py-2 text-right">
                    {Math.abs(totalDr - totalCr) < 0.01
                      ? <span className="text-green-600">Balanced ✓</span>
                      : <span className="text-red-600">Diff: {fmt.currency(Math.abs(totalDr - totalCr))}</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
