import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Home,
  Layers3,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";

const menuTree = [
  { label: "Dashboard", to: "/", icon: Home },
  {
    label: "Company",
    icon: Building2,
    children: [
      { label: "Create Company", to: "/company/create" },
      { label: "Alter Company", to: "/company/alter" },
      { label: "Select Company", to: "/company/select" },
      { label: "Shut Company", to: "/company/shut" },
      { label: "Backup", to: "/company/backup" },
      { label: "Restore", to: "/company/restore" },
    ],
  },
  {
    label: "Masters",
    icon: FolderOpen,
    children: [
      {
        label: "Create",
        children: [
          { label: "Group", to: "/masters/create/group" },
          { label: "Ledger", to: "/masters/create/ledger" },
          { label: "Voucher Type", to: "/masters/create/voucher-type" },
          { label: "Currency", to: "/masters/create/currency" },
          { label: "Cost Category", to: "/masters/create/cost-category" },
          { label: "Cost Centre", to: "/masters/create/cost-centre" },
          { label: "Stock Group", to: "/masters/create/stock-group" },
          { label: "Stock Category", to: "/masters/create/stock-category" },
          { label: "Stock Item", to: "/masters/create/stock-item" },
          { label: "Unit of Measure", to: "/masters/create/unit" },
          { label: "Godown / Location", to: "/masters/create/godown" },
          { label: "Price List", to: "/masters/create/price-list" },
        ],
      },
      {
        label: "Alter",
        children: [
          { label: "Group", to: "/masters/alter/group" },
          { label: "Ledger", to: "/masters/alter/ledger" },
          { label: "Voucher Type", to: "/masters/alter/voucher-type" },
          { label: "Currency", to: "/masters/alter/currency" },
          { label: "Cost Category", to: "/masters/alter/cost-category" },
          { label: "Cost Centre", to: "/masters/alter/cost-centre" },
          { label: "Stock Group", to: "/masters/alter/stock-group" },
          { label: "Stock Category", to: "/masters/alter/stock-category" },
          { label: "Stock Item", to: "/masters/alter/stock-item" },
          { label: "Submitted Vouchers", to: "/masters/alter/voucher" },
          { label: "Unit of Measure", to: "/masters/alter/unit" },
          { label: "Godown", to: "/masters/alter/godown" },
          { label: "Price List", to: "/masters/alter/price-list" },
        ],
      },
    ],
  },
  {
    label: "Chart of Accounts",
    icon: Layers3,
    children: [
      { label: "Groups", to: "/chart-of-accounts/groups" },
      { label: "Ledgers", to: "/chart-of-accounts/ledgers" },
      { label: "Stock Groups", to: "/chart-of-accounts/stock-groups" },
      { label: "Stock Items", to: "/chart-of-accounts/stock-items" },
    ],
  },
  {
    label: "Transactions (Vouchers)",
    icon: Receipt,
    children: [
      {
        label: "Accounting Vouchers",
        children: [
          { label: "Contra", to: "/transactions/accounting/contra" },
          { label: "Payment", to: "/transactions/accounting/payment" },
          { label: "Receipt", to: "/transactions/accounting/receipt" },
          { label: "Journal", to: "/transactions/accounting/journal" },
          { label: "Sales", to: "/transactions/accounting/sales" },
          { label: "POS Voucher", to: "/transactions/accounting/pos-voucher" },
          { label: "Purchase", to: "/transactions/accounting/purchase" },
          { label: "Credit Note", to: "/transactions/accounting/credit-note" },
          { label: "Debit Note", to: "/transactions/accounting/debit-note" },
        ],
      },
      {
        label: "Inventory Vouchers",
        children: [
          { label: "Receipt Note", to: "/transactions/inventory/receipt-note" },
          {
            label: "Delivery Note",
            to: "/transactions/inventory/delivery-note",
          },
          {
            label: "Rejections In",
            to: "/transactions/inventory/rejections-in",
          },
          {
            label: "Rejections Out",
            to: "/transactions/inventory/rejections-out",
          },
          {
            label: "Stock Journal",
            to: "/transactions/inventory/stock-journal",
          },
          {
            label: "Physical Stock",
            to: "/transactions/inventory/physical-stock",
          },
        ],
      },
      { label: "Alter Vouchers", to: "/transactions/alter-vouchers" },
    ],
  },
  // {
  //   label: "Banking",
  //   icon: Landmark,
  //   children: [
  //     {
  //       label: "Banking Activities",
  //       children: [
  //         { label: "Cheque Printing", to: "/banking/activities/cheque-printing" },
  //         { label: "Deposit Slip", to: "/banking/activities/deposit-slip" },
  //         { label: "Payment Advice", to: "/banking/activities/payment-advice" },
  //         { label: "Bank Reconciliation", to: "/banking/activities/bank-reconciliation" },
  //       ],
  //     },
  //     {
  //       label: "Import Bank Data",
  //       children: [
  //         { label: "Bank Statement", to: "/banking/import/bank-statement" },
  //         { label: "Auto Reconciliation", to: "/banking/import/auto-reconciliation" },
  //       ],
  //     },
  //   ],
  // },
  {
    label: "Reports",
    icon: BarChart3,
    children: [
      {
        label: "Financial Statements",
        children: [
          { label: "Balance Sheet", to: "/reports/financial/balance-sheet" },
          { label: "Profit & Loss", to: "/reports/financial/profit-loss" },
          { label: "Trial Balance", to: "/reports/financial/trial-balance" },
          { label: "Cash Flow", to: "/reports/financial/cash-flow" },
          { label: "Fund Flow", to: "/reports/financial/fund-flow" },
        ],
      },
      {
        label: "Inventory Books",
        children: [
          { label: "Stock Item", to: "/reports/inventory-books/stock-item" },
          {
            label: "Stock Group Summary",
            to: "/reports/inventory-books/stock-group-summary",
          },
          {
            label: "Movement Analysis",
            to: "/reports/inventory-books/movement-analysis",
          },
          {
            label: "Godown Summary",
            to: "/reports/inventory-books/godown-summary",
          },
          {
            label: "Batch Summary",
            to: "/reports/inventory-books/batch-summary",
          },
        ],
      },
      // {
      //   label: "Inventory Reports",
      //   children: [
      //     { label: "Stock Summary", to: "/reports/inventory/stock-summary" },
      //     { label: "Stock Ageing", to: "/reports/inventory/stock-ageing" },
      //     { label: "Movement Analysis", to: "/reports/inventory/movement-analysis" },
      //     { label: "Reorder Status", to: "/reports/inventory/reorder-status" },
      //     { label: "Batch Summary", to: "/reports/inventory/batch-summary" },
      //   ],
      // },
      {
        label: "Account Books",
        children: [
          {
            label: "Sales Register",
            to: "/reports/account-books/sales-register",
          },
          {
            label: "Purchase Register",
            to: "/reports/account-books/purchase-register",
          },
          {
            label: "Journal Register",
            to: "/reports/account-books/journal-register",
          },
          {
            label: "Debit Note Register",
            to: "/reports/account-books/debit-note-register",
          },
          {
            label: "Credit Note Register",
            to: "/reports/account-books/credit-note-register",
          },
        ],
      },
      { label: "Day Book", to: "/reports/day-book" },

      {
        label: "Customer Behaviour",
        children: [
          { label: "Overview", to: "/reports/customer-behaviour/overview" },
          {
            label: "Product-wise",
            to: "/reports/customer-behaviour/product-wise",
          },
          {
            label: "Stock Group-wise",
            to: "/reports/customer-behaviour/stock-group-wise",
          },
          {
            label: "Category-wise",
            to: "/reports/customer-behaviour/category-wise",
          },
        ],
      },
      {
        label: "Display More Reports",
        children: [
          {
            label: "Trial Balance (Detailed)",
            to: "/reports/more/trial-balance-detailed",
          },
          {
            label: "Day Book (Filtered)",
            to: "/reports/more/day-book-filtered",
          },
          {
            label: "Cash Flow (Detailed)",
            to: "/reports/more/cash-flow-detailed",
          },
          { label: "Fund Flow", to: "/reports/more/fund-flow" },
          {
            label: "Receivables & Payables",
            children: [
              {
                label: "Bills Receivable",
                to: "/reports/more/receivables/bills-receivable",
              },
              {
                label: "Bills Payable",
                to: "/reports/more/receivables/bills-payable",
              },
              {
                label: "Outstanding Receivables",
                to: "/reports/more/receivables/outstanding-receivables",
              },
              {
                label: "Outstanding Payables",
                to: "/reports/more/receivables/outstanding-payables",
              },
            ],
          },
          {
            label: "Exception Reports",
            children: [
              {
                label: "Negative Stock",
                to: "/reports/more/exceptions/negative-stock",
              },
              {
                label: "Overdue Receivables",
                to: "/reports/more/exceptions/overdue-receivables",
              },
              {
                label: "Overdue Payables",
                to: "/reports/more/exceptions/overdue-payables",
              },
              {
                label: "Memorandum Vouchers",
                to: "/reports/more/exceptions/memorandum-vouchers",
              },
            ],
          },
          {
            label: "Cost Centre Reports",
            children: [
              {
                label: "Cost Centre Summary",
                to: "/reports/more/cost-centres/cost-centre-summary",
              },
              {
                label: "Cost Category Summary",
                to: "/reports/more/cost-centres/cost-category-summary",
              },
            ],
          },
          {
            label: "Analysis Reports",
            children: [
              {
                label: "Ratio Analysis",
                to: "/reports/more/analysis/ratio-analysis",
              },
              {
                label: "Cash/Funds Flow",
                to: "/reports/more/analysis/cash-funds-flow",
              },
              {
                label: "Performance Analysis",
                to: "/reports/more/analysis/performance-analysis",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "Utilities",
    icon: Settings2,
    children: [
      { label: "Import Data", to: "/utilities/import-data" },
      { label: "Export Data", to: "/utilities/export-data" },
      { label: "Banking Utilities", to: "/utilities/banking-utilities" },
      { label: "Data Verification", to: "/utilities/data-verification" },
      { label: "Rewrite Data", to: "/utilities/rewrite-data" },
      { label: "Split Company Data", to: "/utilities/split-company-data" },
    ],
  },
];

function hasActiveNode(node, pathname) {
  if (node.to) {
    return pathname === node.to || pathname.startsWith(`${node.to}/`);
  }

  return (node.children || []).some((child) => hasActiveNode(child, pathname));
}

function TreeNode({
  node,
  depth = 0,
  pathname,
  openKeys,
  setOpenKeys,
  nodeKey,
}) {
  const active = hasActiveNode(node, pathname);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isOpen = hasChildren && (openKeys[nodeKey] ?? active);

  if (!hasChildren) {
    return (
      <Link
        to={node.to}
        className={`block rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
        style={{ marginLeft: depth === 0 ? 0 : depth * 10 }}
      >
        {node.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setOpenKeys((current) => ({
            ...current,
            [nodeKey]: !(current[nodeKey] ?? active),
          }))
        }
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
          active
            ? "bg-blue-50 text-blue-700"
            : "text-slate-700 hover:bg-slate-100"
        }`}
        style={{ marginLeft: depth === 0 ? 0 : depth * 10 }}
      >
        <span>{node.label}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {isOpen ? (
        <div className="mt-1 space-y-1 border-l border-slate-200 pl-2">
          {node.children.map((child) => (
            <TreeNode
              key={`${nodeKey}-${child.label}`}
              node={child}
              depth={depth + 1}
              pathname={pathname}
              openKeys={openKeys}
              setOpenKeys={setOpenKeys}
              nodeKey={`${nodeKey}/${child.label}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState({});
  const { companies, companyId, setCompanyId, loading } = useActiveCompany();

  const treeWithIcons = useMemo(
    () =>
      menuTree.map((section) => ({
        ...section,
        icon: section.icon || ScrollText,
      })),
    [],
  );

  return (
    <aside className="sticky top-0 flex h-screen w-[23rem] flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AccuBooks</h1>
            <p className="text-xs text-slate-500">
              Tally-style Accounting System
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Active Company
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
            disabled={loading}
          >
            {companies.map((company) => (
              <option key={company._id} value={company._id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <nav className="space-y-3">
          {treeWithIcons.map((section) => {
            const Icon = section.icon;
            const active = hasActiveNode(section, location.pathname);

            if (!section.children && section.to) {
              return (
                <Link
                  key={section.label}
                  to={section.to}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{section.label}</span>
                </Link>
              );
            }

            return (
              <section
                key={section.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3"
              >
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Icon className="h-4.5 w-4.5 text-slate-500" />
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {section.label}
                  </h2>
                </div>

                <div className="space-y-1">
                  {section.children.map((child) => (
                    <TreeNode
                      key={`${section.label}-${child.label}`}
                      node={child}
                      pathname={location.pathname}
                      openKeys={openKeys}
                      setOpenKeys={setOpenKeys}
                      nodeKey={`${section.label}/${child.label}`}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-500">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Accounting workspace
        </div>
        <p className="mt-1">
          Tally-style sidebar with working masters, vouchers, and reports.
        </p>
      </div>
    </aside>
  );
}
