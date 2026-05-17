import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Download,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { formatCurrencyAmount } from "../utils/currency";
import {
  exportBalanceSheetExcel,
  exportBalanceSheetPdf,
} from "../utils/financialStatementExport";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import {
  buildReportReturnState,
  navigateBackFromReport,
} from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function findBalanceGroupById(rows = [], targetId) {
  for (const row of rows) {
    if (String(row.id) === String(targetId)) return row;
    const nested = findBalanceGroupById(row.children || [], targetId);
    if (nested) return nested;
  }
  return null;
}

function GroupListColumn({ title, rows, company, onOpenGroup }) {
  return (
    <div className="border-r border-slate-200 last:border-r-0">
      <div className="px-6 py-5">
        <h2 className="text-[14px] font-semibold uppercase tracking-wide text-[#1d62d6]">
          {title}
        </h2>
      </div>
      <div className="border-t border-slate-100">
        {(rows || []).map((row) => (
          <div key={`${title}-${row.id || row.groupName}`} className="border-b border-slate-100 px-6 py-4">
            <button
              type="button"
              data-report-nav="true"
              data-focus-key={`bs-group-${title}-${row.id || row.groupName}`}
              className="flex w-full items-center justify-between gap-4 rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              onClick={() => onOpenGroup(row)}
            >
              <span>
                <span className="font-semibold text-slate-900">{row.groupName}</span>
                {String(row.groupName || "").trim().toLowerCase() === "profit & loss" ? (
                  <span
                    className={`mt-1 block text-[12px] font-medium ${
                      row.pnlType === "profit" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {row.pnlType === "profit" ? "Current Profit" : "Current Loss"}
                  </span>
                ) : null}
              </span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(row.amount, company)}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerListPanel({ title, groupName, rows, company, onBack, onOpenLedger }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-[14px] font-semibold uppercase tracking-wide text-[#1d62d6]">
            {title}
          </h2>
          <p className="mt-2 text-[18px] font-semibold text-slate-900">{groupName}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Ledger</th>
              <th className="px-4 py-3 text-right font-medium">Opening</th>
              <th className="px-4 py-3 text-right font-medium">Closing</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((ledger) => (
              <tr key={ledger.ledgerId} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    data-report-nav="true"
                    data-focus-key={`bs-ledger-${ledger.ledgerId}`}
                    className="rounded px-1 text-left font-medium text-slate-800 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                    onClick={() => onOpenLedger(ledger)}
                  >
                    {ledger.ledgerName}
                  </button>
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                  {formatCurrencyAmount(ledger.openingAmount, company)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatCurrencyAmount(ledger.amount, company)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChildGroupPanel({ title, group, company, onBack, onOpenGroup }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="text-[14px] font-semibold uppercase tracking-wide text-[#1d62d6]">
            {title}
          </h2>
          <p className="mt-2 text-[18px] font-semibold text-slate-900">{group.groupName}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
      <div className="border-t border-slate-100">
        {(group.children || []).map((row) => (
          <div key={`detail-${row.id || row.groupName}`} className="border-b border-slate-100 px-6 py-4">
            <button
              type="button"
              data-report-nav="true"
              data-focus-key={`bs-group-detail-${row.id || row.groupName}`}
              className="flex w-full items-center justify-between gap-4 rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              onClick={() => onOpenGroup(row)}
            >
              <span>
                <span className="font-semibold text-slate-900">{row.groupName}</span>
                {String(row.groupName || "").trim().toLowerCase() === "profit & loss" ? (
                  <span
                    className={`mt-1 block text-[12px] font-medium ${
                      row.pnlType === "profit" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {row.pnlType === "profit" ? "Current Profit" : "Current Loss"}
                  </span>
                ) : null}
              </span>
              <span className="font-semibold text-slate-900">
                {formatCurrencyAmount(row.amount, company)}
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const now = new Date();
  const monthStart = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const { companies, companyId, selectedCompany } = useActiveCompany();
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || monthEnd);
  const [showFilters, setShowFilters] = useState(false);
  const [report, setReport] = useState({ assets: [], liabilities: [], totals: {} });

  const detailSide = searchParams.get("side") || "";
  const detailGroupId = searchParams.get("groupId") || "";

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      const response = await api.get(`/companies/${companyId}/reports/balance-sheet`, {
        params: { from: fromDate, to: toDate },
      });
      setReport(response.data);
    }
    loadReport();
  }, [companyId, fromDate, toDate]);

  const netTotal = useMemo(
    () => Math.max(Number(report.totals?.assets || 0), Number(report.totals?.liabilities || 0)),
    [report.totals],
  );
  const detailRows = useMemo(() => {
    if (!detailSide || !detailGroupId) return [];
    const source = detailSide === "assets" ? report.assets || [] : report.liabilities || [];
    const group = findBalanceGroupById(source, detailGroupId);
    if (group?.children?.length) return [];
    return group?.ledgers || [];
  }, [detailGroupId, detailSide, report.assets, report.liabilities]);
  const detailGroup = useMemo(() => {
    if (!detailSide || !detailGroupId) return null;
    const source = detailSide === "assets" ? report.assets || [] : report.liabilities || [];
    return findBalanceGroupById(source, detailGroupId);
  }, [detailGroupId, detailSide, report.assets, report.liabilities]);
  const pageTotal = useMemo(() => {
    if (detailGroup) {
      return Number(detailGroup.amount || 0);
    }
    return netTotal;
  }, [detailGroup, netTotal]);

  useReportFocusRestore(containerRef, [companyId, fromDate, toDate, detailSide, detailGroupId, report]);
  useReportKeyboardNav(containerRef, [report, detailRows, detailSide, detailGroupId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function openGroup(side, row) {
    if (String(row.groupName || "").trim().toLowerCase() === "closing stock") {
      navigate(
        `/reports/inventory-books/stock-group-summary?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
        {
          state: buildReportReturnState(location, `bs-group-${side === "assets" ? "Assets" : "Liabilities"}-${row.id || row.groupName}`),
        },
      );
      return;
    }
    if (String(row.groupName || "").trim().toLowerCase() === "profit & loss") {
      navigate(
        `/reports/financial/profit-loss?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
        {
          state: buildReportReturnState(location, `bs-group-${side === "assets" ? "Assets" : "Liabilities"}-${row.groupName}`),
        },
      );
      return;
    }
    navigate(
      `/reports/financial/balance-sheet?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&side=${encodeURIComponent(side)}&groupId=${encodeURIComponent(row.id)}`,
      {
        state: buildReportReturnState(location, `bs-group-${side === "assets" ? "Assets" : "Liabilities"}-${row.id || row.groupName}`),
      },
    );
  }

  function openLedger(ledger) {
    const targetMode = ledger.virtualMode || "inventory";
    const targetLedgerId =
      ledger.virtualMode === "profit-loss" ? "__profit_loss__" : ledger.ledgerId;
    navigate(
      `/reports/account-books/ledger-detail?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&ledgerId=${encodeURIComponent(targetLedgerId)}&ledgerName=${encodeURIComponent(ledger.ledgerName)}&mode=${encodeURIComponent(targetMode)}`,
      {
        state: buildReportReturnState(location, `bs-ledger-${ledger.ledgerId}`),
      },
    );
  }

  function handleExportPdf() {
    exportBalanceSheetPdf({
      report,
      company: selectedCompany,
      fromDate,
      toDate,
      detailGroup: detailGroup?.groupName || "",
      detailSide,
      detailRows,
    });
  }

  function handleExportExcel() {
    exportBalanceSheetExcel({
      report,
      company: selectedCompany,
      fromDate,
      toDate,
      detailGroup: detailGroup?.groupName || "",
      detailSide,
      detailRows,
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f7f9fc] px-6 py-6 text-slate-900">
      <div className="mx-auto max-w-[1380px]">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            {detailGroup ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
            <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
              {detailGroup ? `${detailGroup.groupName} Details` : "Balance Sheet"}
            </h1>
            <div className="mt-2 text-[14px] text-slate-500">
              {detailGroup
                ? `${detailSide === "assets" ? "Assets" : "Liabilities"} / ${detailGroup.groupName}`
                : `As at ${formatDisplayDate(toDate)}`}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 min-w-[180px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <div className="flex h-11 min-w-[180px] items-center rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-700 shadow-sm">
              {selectedCompany?.name || "No company selected"}
            </div>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
              onClick={() => setShowFilters((current) => !current)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              More Filters
            </button>
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
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </section>

        {showFilters ? (
          <section className="mt-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">From</label>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-[14px] outline-none"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">To</label>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-[14px] outline-none"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Company</label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[14px] font-medium text-slate-700">
                    {selectedCompany?.name || "No company selected"}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {detailGroup ? (
          <section className="mt-6">
            {detailGroup.children?.length ? (
              <ChildGroupPanel
                title={detailSide === "assets" ? "Assets" : "Liabilities"}
                group={detailGroup}
                company={selectedCompany}
                onBack={() => navigateBackFromReport(navigate, location)}
                onOpenGroup={(row) => openGroup(detailSide, row)}
              />
            ) : (
              <LedgerListPanel
                title={detailSide === "assets" ? "Assets" : "Liabilities"}
                groupName={detailGroup.groupName}
                rows={detailRows}
                company={selectedCompany}
                onBack={() => navigateBackFromReport(navigate, location)}
                onOpenLedger={openLedger}
              />
            )}
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="grid xl:grid-cols-2">
              <GroupListColumn
                title="Liabilities"
                rows={report.liabilities || []}
                company={selectedCompany}
                onOpenGroup={(row) => openGroup("liabilities", row)}
              />
              <GroupListColumn
                title="Assets"
                rows={report.assets || []}
                company={selectedCompany}
                onOpenGroup={(row) => openGroup("assets", row)}
              />
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[18px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="grid gap-4 text-[14px] md:grid-cols-3">
            <div>
              Company : <span className="font-medium text-slate-700">{selectedCompany?.name || "-"}</span>
            </div>
            <div>
              Financial Year :{" "}
              <span className="font-medium text-slate-700">
                {selectedCompany?.financialYearFrom || "-"} to {selectedCompany?.financialYearTo || "-"}
              </span>
            </div>
            <div className="text-left md:text-right">
              Base Currency :{" "}
              <span className="font-medium text-slate-700">
                {selectedCompany?.baseCurrencyCode || selectedCompany?.baseCurrencySymbol || "BDT"}
                {selectedCompany?.formalName ? ` - ${selectedCompany.formalName}` : ""}
              </span>
            </div>
          </div>
          <div className="mt-3 text-[14px] font-semibold text-slate-900">
            Total : {formatCurrencyAmount(pageTotal, selectedCompany)}
          </div>
        </section>
      </div>
    </div>
  );
}
