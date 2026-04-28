import ChartTreeReportPage from "../Component/ChartTreeReportPage";

export default function CoaStockItems() {
  return (
    <ChartTreeReportPage
      title="Stock Items"
      subtitle="Review stock items under their stock groups in a tree-style chart view."
      endpoint="chart-of-accounts/stock-items"
      searchPlaceholder="Search stock group, item, or barcode..."
      summaryLabel="Total Stock Groups"
      rowTypeLabel="Total Stock Items"
      renderMeta={(row) =>
        row.type === "item" && row.barcode ? (
          <p className="text-xs text-slate-400">{row.barcode}</p>
        ) : null
      }
    />
  );
}
