export const ROLE_ADMIN = "admin";
export const EMPLOYEE_SESSION_TOKEN_KEY = "accubooks-employee-session-token";

const ACCESS_RULES = {
  admin: [{ prefix: "/" }],
  supervisor: [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/masters" },
    { prefix: "/chart-of-accounts" },
    { prefix: "/transactions" },
    { prefix: "/reports" },
    { prefix: "/utilities" },
  ],
  accountant: [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/masters/create/group" },
    { prefix: "/masters/alter/group" },
    { prefix: "/masters/create/ledger" },
    { prefix: "/masters/alter/ledger" },
    { prefix: "/masters/create/price-list" },
    { prefix: "/masters/alter/price-list" },
    { prefix: "/transactions/accounting" },
    { prefix: "/reports" },
    { prefix: "/chart-of-accounts" },
    { prefix: "/utilities/audit-log" },
  ],
  cashier: [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/transactions/accounting/receipt" },
    { prefix: "/transactions/accounting/sales" },
    { prefix: "/transactions/accounting/pos-voucher" },
  ],
  "sales operator": [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/transactions/accounting/sales" },
    { prefix: "/transactions/accounting/credit-note" },
    { prefix: "/transactions/accounting/pos-voucher" },
    { prefix: "/reports/customer-behaviour" },
  ],
  "store operator": [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/masters/create/stock-group" },
    { prefix: "/masters/alter/stock-group" },
    { prefix: "/masters/create/stock-category" },
    { prefix: "/masters/alter/stock-category" },
    { prefix: "/masters/create/stock-item" },
    { prefix: "/masters/alter/stock-item" },
    { prefix: "/masters/create/unit" },
    { prefix: "/masters/alter/unit" },
    { prefix: "/masters/create/bom" },
    { prefix: "/masters/alter/bom" },
    { prefix: "/masters/create/price-list" },
    { prefix: "/masters/alter/price-list" },
    { prefix: "/transactions/inventory" },
    { prefix: "/transactions/accounting/purchase" },
    { prefix: "/transactions/accounting/debit-note" },
    { prefix: "/reports/inventory-books" },
  ],
  viewer: [
    { exact: "/" },
    { prefix: "/dashboard" },
    { prefix: "/shortcuts" },
    { prefix: "/reports" },
  ],
};

export function normalizeUserRole(role = "") {
  return String(role || "").trim().toLowerCase();
}

export function readStoredUser() {
  try {
    const raw = window.localStorage.getItem("pos-user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function readStoredSessionToken() {
  try {
    return window.localStorage.getItem(EMPLOYEE_SESSION_TOKEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

export function canAccessPath(role, path = "/") {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) {
    return true;
  }
  const rules = ACCESS_RULES[normalizedRole] || [];

  if (!path || path === "/") {
    return rules.some((rule) => rule.exact === "/" || rule.prefix === "/");
  }

  return rules.some((rule) => {
    if (rule.exact) return path === rule.exact;
    if (rule.prefix === "/") return true;
    return path === rule.prefix || path.startsWith(`${rule.prefix}/`);
  });
}

export function filterNavigationByRole(nodes = [], role = "") {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) {
    return nodes;
  }

  return nodes
    .map((node) => {
      if (node.children?.length) {
        const children = filterNavigationByRole(node.children, normalizedRole);
        return children.length > 0 ? { ...node, children } : null;
      }

      return node.to && canAccessPath(normalizedRole, node.to) ? node : null;
    })
    .filter(Boolean);
}
