import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaLedgers() {
  return (
    <ChartTreeReportPage
      title="Ledgers"
      subtitle="Inspect ledgers under their groups in the same chart-style structure as Tally."
      endpoint="chart-of-accounts/ledgers"
      searchPlaceholder="Search group or ledger..."
      summaryLabel="Total Groups"
      rowTypeLabel="Total Ledgers"
    />
  );
}
