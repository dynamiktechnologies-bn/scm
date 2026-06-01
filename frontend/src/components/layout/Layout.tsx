import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  LayoutDashboard, Package, Truck, Users, ShoppingCart,
  BarChart2, BookOpen, Warehouse, ChevronDown, LogOut,
  Box, Settings,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../ui";

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  children: { label: string; to: string }[];
}

const NAV: NavGroup[] = [
  {
    label: "Products", icon: <Box size={15} />,
    children: [
      { label: "Item Master", to: "/products" },
      { label: "Units of Measure", to: "/products/uom" },
    ],
  },
  {
    label: "Parties", icon: <Users size={15} />,
    children: [
      { label: "Suppliers", to: "/suppliers" },
      { label: "Customers", to: "/customers" },
    ],
  },
  {
    label: "Purchasing", icon: <Truck size={15} />,
    children: [
      { label: "Requisitions", to: "/purchase/requisitions" },
      { label: "Purchase Orders", to: "/purchase/orders" },
      { label: "Goods Receipts", to: "/purchase/receipts" },
      { label: "Supplier Invoices", to: "/purchase/invoices" },
      { label: "Purchase Returns", to: "/purchase/returns" },
    ],
  },
  {
    label: "Sales", icon: <ShoppingCart size={15} />,
    children: [
      { label: "Sales Orders", to: "/sales/orders" },
      { label: "Shipments", to: "/sales/shipments" },
      { label: "Sales Returns", to: "/sales/returns" },
    ],
  },
  {
    label: "Inventory", icon: <Warehouse size={15} />,
    children: [
      { label: "Stock on Hand", to: "/inventory/stock" },
      { label: "Transactions", to: "/inventory/transactions" },
      { label: "Adjustments", to: "/inventory/adjustments" },
      { label: "Transfers", to: "/inventory/transfers" },
    ],
  },
  {
    label: "Accounting", icon: <BookOpen size={15} />,
    children: [
      { label: "Journal Entries", to: "/accounting/journal" },
      { label: "Chart of Accounts", to: "/accounting/coa" },
      { label: "Trial Balance", to: "/accounting/trial-balance" },
    ],
  },
  {
    label: "Reports", icon: <BarChart2 size={15} />,
    children: [
      { label: "Inventory Valuation", to: "/reports/inventory-valuation" },
      { label: "Stock Aging", to: "/reports/stock-aging" },
      { label: "Purchase Register", to: "/reports/purchase-register" },
      { label: "Sales Register", to: "/reports/sales-register" },
      { label: "Margin Report", to: "/reports/margin" },
    ],
  },
  {
    label: "Settings", icon: <Settings size={15} />,
    children: [
      { label: "Warehouses & Locations", to: "/settings/warehouses" },
    ],
  },
];

function NavSection({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors duration-150"
      >
        <span className="flex items-center gap-2.5">
          <span className="text-slate-500">{group.icon}</span>
          {group.label}
        </span>
        <ChevronDown
          size={11}
          className={cn("transition-transform duration-200 text-slate-600", !open && "-rotate-90")}
        />
      </button>

      {open && (
        <div className="ml-2 mt-0.5 mb-1 space-y-0.5">
          {group.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 pl-5 pr-3 py-1.5 rounded-lg text-[13px] transition-all duration-150",
                  isActive
                    ? "bg-violet-600 text-white font-medium shadow-sm shadow-violet-900/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn("w-1 h-1 rounded-full flex-shrink-0", isActive ? "bg-violet-200" : "bg-slate-600")} />
                  {child.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const initials = (user?.full_name ?? user?.email ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" style={{ textAlign: "initial" }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800">

        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-800/80">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/40">
            <Package size={14} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">SCM</span>
            <span className="ml-1 text-slate-500 text-xs font-medium">ERP</span>
          </div>
        </div>

        {/* Dashboard link */}
        <div className="px-3 pt-3 pb-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-900/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )
            }
          >
            <LayoutDashboard size={15} />
            Dashboard
          </NavLink>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV.map((g) => (
            <NavSection key={g.label} group={g} />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-300 truncate">
                {user?.full_name ?? user?.email}
              </p>
              <p className="text-[11px] text-slate-600 capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors duration-150"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
