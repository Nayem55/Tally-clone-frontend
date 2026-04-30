export function normalizeVoucherName(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function buildAlterVoucherPath(companyId, voucherId) {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  return `/transactions/alter-vouchers/${voucherId}${params.toString() ? `?${params.toString()}` : ""}`;
}
