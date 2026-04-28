import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaGroups() {
  return (
    <ChartTreeReportPage
      title="Groups"
      subtitle="Review accounting groups in a proper parent-child chart structure."
      endpoint="chart-of-accounts/groups"
      searchPlaceholder="Search group..."
      summaryLabel="Total Groups"
      rowTypeLabel="Leaf Groups"
    />
  );
}
