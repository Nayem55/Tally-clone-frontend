import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaLedgers() {
  return (
    <ChartTreeReportPage
      title="Ledgers"
      subtitle="Inspect ledger hierarchy only. Group rows are kept on the Groups chart page."
      endpoint="chart-of-accounts/ledgers"
      searchPlaceholder="Search ledger..."
      summaryLabel="Total Ledgers"
      rowTypeLabel="Visible Ledgers"
      summaryValueMode="ledgers"
    />
  );
}
