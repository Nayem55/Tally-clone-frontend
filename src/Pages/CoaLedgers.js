import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaLedgers() {
  return (
    <ChartTreeReportPage
      title="Ledgers"
      subtitle="Review ledgers under their accounting groups in a tree-style chart view."
      endpoint="chart-of-accounts/ledgers"
      searchPlaceholder="Search group or ledger..."
      summaryLabel="Total Groups"
      rowTypeLabel="Visible Ledgers"
      summaryValueMode="groups"
      getRowNavigation={(row, companyId) => ({
        to: row.type === "group" ? "/masters/alter/group" : "/masters/alter/ledger",
        state: { companyId, editId: row.id || row._id },
      })}
    />
  );
}
