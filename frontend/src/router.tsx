import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/auth/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { ProductsPage } from "./pages/products/ProductsPage";
import { UoMPage } from "./pages/products/UoMPage";
import { SuppliersPage } from "./pages/suppliers/SuppliersPage";
import { CustomersPage } from "./pages/customers/CustomersPage";
import { PurchaseRequisitionsPage } from "./pages/purchase/PurchaseRequisitionsPage";
import { PurchaseOrdersPage } from "./pages/purchase/PurchaseOrdersPage";
import { PODetailPage } from "./pages/purchase/PODetailPage";
import { GoodsReceiptsPage } from "./pages/purchase/GoodsReceiptsPage";
import { SupplierInvoicesPage } from "./pages/purchase/SupplierInvoicesPage";
import { PurchaseReturnsPage } from "./pages/purchase/PurchaseReturnsPage";
import { SalesOrdersPage } from "./pages/sales/SalesOrdersPage";
import { ShipmentsPage } from "./pages/sales/ShipmentsPage";
import { SalesReturnsPage } from "./pages/sales/SalesReturnsPage";
import { StockPage } from "./pages/inventory/StockPage";
import { TransactionsPage } from "./pages/inventory/TransactionsPage";
import { AdjustmentsPage } from "./pages/inventory/AdjustmentsPage";
import { TransfersPage } from "./pages/inventory/TransfersPage";
import { JournalPage } from "./pages/accounting/JournalPage";
import { COAPage } from "./pages/accounting/COAPage";
import { TrialBalancePage } from "./pages/accounting/TrialBalancePage";
import {
  InventoryValuationPage, StockAgingPage,
  PurchaseRegisterPage, SalesRegisterPage, MarginReportPage,
} from "./pages/reports/ReportsPages";
import { WarehousesPage } from "./pages/settings/WarehousesPage";
import { ApprovalsPage } from "./pages/settings/ApprovalsPage";
import { UsersPage } from "./pages/settings/UsersPage";
import { useAuthStore } from "./stores/authStore";
import type { ReactElement } from "react";

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/uom", element: <UoMPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "purchase/requisitions", element: <PurchaseRequisitionsPage /> },
      { path: "purchase/orders", element: <PurchaseOrdersPage /> },
      { path: "purchase/orders/:id", element: <PODetailPage /> },
      { path: "purchase/receipts", element: <GoodsReceiptsPage /> },
      { path: "purchase/invoices", element: <SupplierInvoicesPage /> },
      { path: "purchase/returns", element: <PurchaseReturnsPage /> },
      { path: "sales/orders", element: <SalesOrdersPage /> },
      { path: "sales/shipments", element: <ShipmentsPage /> },
      { path: "sales/returns", element: <SalesReturnsPage /> },
      { path: "inventory/stock", element: <StockPage /> },
      { path: "inventory/transactions", element: <TransactionsPage /> },
      { path: "inventory/adjustments", element: <AdjustmentsPage /> },
      { path: "inventory/transfers", element: <TransfersPage /> },
      { path: "accounting/journal", element: <JournalPage /> },
      { path: "accounting/coa", element: <COAPage /> },
      { path: "accounting/trial-balance", element: <TrialBalancePage /> },
      { path: "reports/inventory-valuation", element: <InventoryValuationPage /> },
      { path: "reports/stock-aging", element: <StockAgingPage /> },
      { path: "reports/purchase-register", element: <PurchaseRegisterPage /> },
      { path: "reports/sales-register", element: <SalesRegisterPage /> },
      { path: "reports/margin", element: <MarginReportPage /> },
      { path: "settings/warehouses", element: <WarehousesPage /> },
      { path: "settings/approvals", element: <ApprovalsPage /> },
      { path: "settings/users", element: <UsersPage /> },
    ],
  },
]);
