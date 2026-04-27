export function getCompanyCurrency(company) {
  return {
    code: company?.baseCurrencyCode || company?.baseCurrencySymbol || "BDT",
    symbol: company?.baseCurrencySymbol || company?.baseCurrencyCode || "BDT",
    name: company?.formalName || "Base Currency",
    decimalPlaces: Number(company?.decimalPlaces || 2),
  };
}

export function formatCurrencyAmount(value, company) {
  const currency = getCompanyCurrency(company);
  const amount = Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  });
  return `${currency.symbol} ${amount}`;
}
