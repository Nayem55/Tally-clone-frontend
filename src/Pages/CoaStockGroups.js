import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaStockGroups() {
  return (
    <ChartTreeReportPage
      title="Stock Groups"
      subtitle="View stock group hierarchy the same way you review accounting groups and ledgers."
      endpoint="chart-of-accounts/stock-groups"
      searchPlaceholder="Search stock group..."
      summaryLabel="Total Stock Groups"
      rowTypeLabel="Leaf Groups"
      getRowNavigation={(row, companyId) => ({
        to: "/masters/alter/stock-group",
        state: { companyId, editId: row.id || row._id },
      })}
    />
  );
}
