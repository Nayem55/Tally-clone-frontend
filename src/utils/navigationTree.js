import {
  BarChart3,
  Building2,
  FolderOpen,
  Home,
  Layers3,
  Receipt,
  ScrollText,
  Settings2,
} from "lucide-react";

export const menuTree = [
  {
    label: "Dashboard",
    icon: Home,
    children: [
      { label: "Dashboard", to: "/" },
      { label: "Manufacturing Dashboard", to: "/dashboard/manufacturing" },
    ],
  },
  { label: "All Short Keys", to: "/shortcuts", icon: ScrollText },
  {
    label: "Company",
    icon: Building2,
    children: [
      { label: "Create Company", to: "/company/create" },
      { label: "Alter Company", to: "/company/alter" },
      // { label: "Select Company", to: "/company/select" },
      // { label: "Shut Company", to: "/company/shut" },
      // { label: "Backup", to: "/company/backup" },
      // { label: "Restore", to: "/company/restore" },
    ],
  },
  {
    label: "Masters",
    icon: FolderOpen,
    children: [
      {
        label: "Create",
        children: [
          {
            label: "Accounting Masters",
            children: [
              { label: "Group", to: "/masters/create/group" },
              { label: "Ledger", to: "/masters/create/ledger" },
              // { label: "Cost Centre", to: "/masters/create/cost-centre" },
              // { label: "Currency", to: "/masters/create/currency" },
              // { label: "Voucher Type", to: "/masters/create/voucher-type" },
            ],
          },
          {
            label: "Inventory Masters",
            children: [
              { label: "Stock Group", to: "/masters/create/stock-group" },
              { label: "Stock Category", to: "/masters/create/stock-category" },
              { label: "Stock Item", to: "/masters/create/stock-item" },
              { label: "Unit", to: "/masters/create/unit" },
              // { label: "Location", to: "/masters/create/godown" },
              { label: "Price List", to: "/masters/create/price-list" },
              { label: "BoM", to: "/masters/create/bom" },
            ],
          },
          {
            label: "Payroll Masters",
            children: [{ label: "Employee", to: "/masters/create/employee" }],
          },
        ],
      },
      {
        label: "Alter",
        children: [
          {
            label: "Accounting Masters",
            children: [
              { label: "Group", to: "/masters/alter/group" },
              { label: "Ledger", to: "/masters/alter/ledger" },
              { label: "Cost Centre", to: "/masters/alter/cost-centre" },
              { label: "Currency", to: "/masters/alter/currency" },
              { label: "Voucher Type", to: "/masters/alter/voucher-type" },
            ],
          },
          {
            label: "Inventory Masters",
            children: [
              { label: "Stock Group", to: "/masters/alter/stock-group" },
              { label: "Stock Category", to: "/masters/alter/stock-category" },
              { label: "Stock Item", to: "/masters/alter/stock-item" },
              { label: "Unit", to: "/masters/alter/unit" },
              // { label: "Location", to: "/masters/alter/godown" },
              { label: "Price List", to: "/masters/alter/price-list" },
              { label: "BoM", to: "/masters/alter/bom" },
            ],
          },
          {
            label: "Payroll Masters",
            children: [{ label: "Employee", to: "/masters/alter/employee" }],
          },
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
        ],
      },
      {
        label: "Inventory Vouchers",
        children: [
          { label: "Purchase", to: "/transactions/accounting/purchase" },
          { label: "Debit Note", to: "/transactions/accounting/debit-note" },
          { label: "Sales", to: "/transactions/accounting/sales" },
          { label: "Credit Note", to: "/transactions/accounting/credit-note" },
          { label: "POS Voucher", to: "/transactions/accounting/pos-voucher" },
          // { label: "Receipt Note", to: "/transactions/inventory/receipt-note" },
          // {
          //   label: "Delivery Note",
          //   to: "/transactions/inventory/delivery-note",
          // },
          // {
          //   label: "Rejections In",
          //   to: "/transactions/inventory/rejections-in",
          // },
          // {
          //   label: "Rejections Out",
          //   to: "/transactions/inventory/rejections-out",
          // },
          {
            label: "Stock Journal",
            to: "/transactions/inventory/stock-journal",
          },
          {
            label: "Manufacturing",
            to: "/transactions/inventory/manufacturing",
          },
        ],
      },
      { label: "Alter Vouchers", to: "/transactions/alter-vouchers" },
    ],
  },
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
          // { label: "Fund Flow", to: "/reports/financial/fund-flow" },
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
            label: "BoM Register",
            to: "/reports/inventory-books/bom-register",
          },
          {
            label: "Production Register",
            to: "/reports/inventory-books/production-register",
          },
          {
            label: "Component Consumption",
            to: "/reports/inventory-books/component-consumption",
          },
          {
            label: "Movement Analysis",
            children: [
              {
                label: "Stock Group Analysis",
                to: "/reports/inventory-books/movement-analysis/stock-group",
              },
              {
                label: "Stock Category Analysis",
                to: "/reports/inventory-books/movement-analysis/stock-category",
              },
              {
                label: "Stock Item Analysis",
                to: "/reports/inventory-books/movement-analysis/stock-item",
              },
              {
                label: "Group Analysis",
                to: "/reports/inventory-books/movement-analysis/group",
              },
              {
                label: "Ledger Analysis",
                to: "/reports/inventory-books/movement-analysis/ledger",
              },
              {
                label: "Sales Person Analysis",
                to: "/reports/inventory-books/movement-analysis/sales-person",
              },
            ],
          },
          // {
          //   label: "Godown Summary",
          //   to: "/reports/inventory-books/godown-summary",
          // },
          // {
          //   label: "Batch Summary",
          //   to: "/reports/inventory-books/batch-summary",
          // },
        ],
      },
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
          {
            label: "Group",
            to: "/reports/account-books/group",
          },
          {
            label: "Ledger",
            to: "/reports/account-books/ledger",
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
      // {
      //   label: "Display More Reports",
      //   children: [
      //     {
      //       label: "Trial Balance (Detailed)",
      //       to: "/reports/more/trial-balance-detailed",
      //     },
      //     {
      //       label: "Day Book (Filtered)",
      //       to: "/reports/more/day-book-filtered",
      //     },
      //     {
      //       label: "Cash Flow (Detailed)",
      //       to: "/reports/more/cash-flow-detailed",
      //     },
      //     { label: "Fund Flow", to: "/reports/more/fund-flow" },
      //     {
      //       label: "Receivables & Payables",
      //       children: [
      //         {
      //           label: "Bills Receivable",
      //           to: "/reports/more/receivables/bills-receivable",
      //         },
      //         {
      //           label: "Bills Payable",
      //           to: "/reports/more/receivables/bills-payable",
      //         },
      //         {
      //           label: "Outstanding Receivables",
      //           to: "/reports/more/receivables/outstanding-receivables",
      //         },
      //         {
      //           label: "Outstanding Payables",
      //           to: "/reports/more/receivables/outstanding-payables",
      //         },
      //       ],
      //     },
      //     {
      //       label: "Exception Reports",
      //       children: [
      //         {
      //           label: "Negative Stock",
      //           to: "/reports/more/exceptions/negative-stock",
      //         },
      //         {
      //           label: "Overdue Receivables",
      //           to: "/reports/more/exceptions/overdue-receivables",
      //         },
      //         {
      //           label: "Overdue Payables",
      //           to: "/reports/more/exceptions/overdue-payables",
      //         },
      //         {
      //           label: "Memorandum Vouchers",
      //           to: "/reports/more/exceptions/memorandum-vouchers",
      //         },
      //       ],
      //     },
      //     {
      //       label: "Cost Centre Reports",
      //       children: [
      //         {
      //           label: "Cost Centre Summary",
      //           to: "/reports/more/cost-centres/cost-centre-summary",
      //         },
      //         {
      //           label: "Cost Category Summary",
      //           to: "/reports/more/cost-centres/cost-category-summary",
      //         },
      //       ],
      //     },
      //     {
      //       label: "Analysis Reports",
      //       children: [
      //         {
      //           label: "Ratio Analysis",
      //           to: "/reports/more/analysis/ratio-analysis",
      //         },
      //         {
      //           label: "Cash/Funds Flow",
      //           to: "/reports/more/analysis/cash-funds-flow",
      //         },
      //         {
      //           label: "Performance Analysis",
      //           to: "/reports/more/analysis/performance-analysis",
      //         },
      //       ],
      //     },
      //   ],
      // },
    ],
  },
  // {
  //   label: "Utilities",
  //   icon: Settings2,
  //   children: [
  //     { label: "Import Data", to: "/utilities/import-data" },
  //     { label: "Export Data", to: "/utilities/export-data" },
  //     { label: "Banking Utilities", to: "/utilities/banking-utilities" },
  //     { label: "Data Verification", to: "/utilities/data-verification" },
  //     { label: "Rewrite Data", to: "/utilities/rewrite-data" },
  //     { label: "Split Company Data", to: "/utilities/split-company-data" },
  //   ],
  // },
];

export function hasActiveNode(node, pathname) {
  if (node.to) {
    return pathname === node.to || pathname.startsWith(`${node.to}/`);
  }

  return (node.children || []).some((child) => hasActiveNode(child, pathname));
}

export function flattenNavigation(nodes = menuTree, ancestors = []) {
  return nodes.flatMap((node) => {
    const currentAncestors = [...ancestors, node.label];
    const children = node.children
      ? flattenNavigation(node.children, currentAncestors)
      : [];
    const parentLabel = ancestors[ancestors.length - 1] || "";
    const breadcrumbs = currentAncestors.join(" / ");
    const self = {
      label: node.label,
      to: node.to || "",
      parentLabel,
      breadcrumbs,
      ancestors,
      hasChildren: Boolean(node.children?.length),
      children,
    };
    return [self, ...children];
  });
}
