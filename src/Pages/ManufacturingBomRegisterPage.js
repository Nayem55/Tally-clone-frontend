import { useEffect, useRef, useState } from "react";
import { Boxes, Download } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { exportInventoryReportExcel, exportInventoryReportPdf } from "../utils/inventoryReportExport";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { navigateBackFromReport } from "../utils/reportNavigation";

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function ManufacturingBomRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const { companyId } = useActiveCompany();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function loadRows() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/manufacturing/boms`);
      setRows(response.data || []);
    }
    loadRows();
  }, [companyId, location.key]);

  useReportFocusRestore(containerRef, [rows, companyId]);
  useReportKeyboardNav(containerRef, [rows, companyId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function handleExportPdf() {
    exportInventoryReportPdf({
      title: "BoM Register",
      company: { name: companyId || "-" },
      columns: [
        { key: "name", label: "BoM", width: 30 },
        { key: "finishedItemName", label: "Finished Good", width: 28 },
        { key: "outputQty", label: "Output Qty", width: 14 },
        { key: "components", label: "Components", width: 12 },
        { key: "maxProducible", label: "Max Producible", width: 16 },
        { key: "effectiveRate", label: "Effective Rate", width: 16 },
      ],
      rows: rows.map((row) => ({
        name: row.name,
        finishedItemName: row.finishedItemName || "-",
        outputQty: formatQty(row.outputQty),
        components: row.components?.length || 0,
        maxProducible: formatQty(row.maxProducible),
        effectiveRate: Number(row.effectiveRate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      })),
    });
  }

  function handleExportExcel() {
    exportInventoryReportExcel({
      title: "BoM Register",
      company: { name: companyId || "-" },
      columns: [
        { key: "name", label: "BoM", width: 30 },
        { key: "finishedItemName", label: "Finished Good", width: 28 },
        { key: "outputQty", label: "Output Qty", width: 14 },
        { key: "components", label: "Components", width: 12 },
        { key: "maxProducible", label: "Max Producible", width: 16 },
        { key: "effectiveRate", label: "Effective Rate", width: 16 },
      ],
      rows: rows.map((row) => ({
        name: row.name,
        finishedItemName: row.finishedItemName || "-",
        outputQty: Number(row.outputQty || 0),
        components: row.components?.length || 0,
        maxProducible: Number(row.maxProducible || 0),
        effectiveRate: Number(row.effectiveRate || 0),
      })),
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Boxes className="h-3.5 w-3.5" />
            Manufacturing
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">BoM Register</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review every bill of material and see how many finished goods can be produced from current raw material stock.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm"
              onClick={handleExportPdf}
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
              onClick={handleExportExcel}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">BoM</th>
                  <th className="px-4 py-3 font-medium">Finished Good</th>
                  <th className="px-4 py-3 text-right font-medium">Output Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Components</th>
                  <th className="px-4 py-3 text-right font-medium">Max Producible</th>
                  <th className="px-4 py-3 text-right font-medium">Effective Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.finishedItemName || "-"}</td>
                    <td className="px-4 py-3 text-right">{formatQty(row.outputQty)}</td>
                    <td className="px-4 py-3 text-right">{row.components?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQty(row.maxProducible)}</td>
                    <td className="px-4 py-3 text-right">{Number(row.effectiveRate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
