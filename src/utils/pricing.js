export function normalizeDateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function resolvePriceEntryByDate(item, priceLevelId, voucherDate) {
  if (!item) return null;
  const selectedDateKey = normalizeDateKey(voucherDate);
  const prices = Array.isArray(item.prices) ? item.prices : [];
  const normalizedPriceLevelId = priceLevelId ? String(priceLevelId) : "";

  const matchingByLevel = priceLevelId
    ? prices.filter((entry) => String(entry.priceLevelId || "") === normalizedPriceLevelId)
    : prices;

  const datedEntries = matchingByLevel
    .map((entry) => ({
      ...entry,
      effectiveKey: normalizeDateKey(entry.effectiveFrom),
    }))
    .filter(
      (entry) => entry.effectiveKey && (!selectedDateKey || entry.effectiveKey <= selectedDateKey)
    )
    .sort((left, right) => right.effectiveKey.localeCompare(left.effectiveKey));

  if (datedEntries.length > 0) {
    return datedEntries[0];
  }

  const undatedEntry = matchingByLevel.find((entry) => !entry.effectiveFrom);
  return undatedEntry || null;
}

export function resolveItemRateByDate(item, priceLevelId, voucherDate) {
  const entry = resolvePriceEntryByDate(item, priceLevelId, voucherDate);
  if (entry && entry.rate !== undefined) {
    return Number(entry.rate) || 0;
  }
  if (item?.openingRate) return Number(item.openingRate) || 0;
  const fallback = Array.isArray(item?.prices) ? item.prices[0] : null;
  return Number(fallback?.rate || 0);
}
