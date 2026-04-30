import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import LedgerDrilldownRow from "../Component/LedgerDrilldownRow";
import { formatCurrencyAmount } from "../utils/currency";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";

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

function exportBalanceCsv(report, company) {
  const rows = [["Side", "Particulars", "Opening", "Closing"]];
  ["liabilities", "assets"].forEach((side) => {
    (report[side] || []).forEach((row) => {
      rows.push([side, row.groupName, row.openingAmount || 0, row.amount || 0]);
      (row.ledgers || []).forEach((ledger) => {
        rows.push([side, `  ${ledger.ledgerName}`, ledger.openingAmount || 0, ledger.amount || 0]);
      });
    });
  });

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `balance-sheet-${company?.name || "company"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function BalanceColumn({
  title,
  rows,
  openingTotal,
  total,
  company,
  companyId,
  fromDate,
  toDate,
  expandedGroups,
  onToggleGroup,
  expandedLedgers,
  onToggleLedger,
}) {
  return (
    <div className="border-r border-slate-200 last:border-r-0">
      <div className="px-6 py-5">
        <h2 className="text-[14px] font-semibold uppercase tracking-wide text-[#1d62d6]">
          {title}
        </h2>
      </div>

      <div className="border-t border-slate-100">
        {(rows || []).map((row) => {
          const groupKey = `${title}-${row.groupName}`;
          const groupOpen = expandedGroups[groupKey];
          const hasLedgers = (row.ledgers || []).length > 0;

          return (
            <Fragment key={groupKey}>
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    {hasLedgers ? (
                      <button
                        type="button"
                        data-report-nav="true"
                        data-report-back={groupOpen ? "true" : "false"}
                        className="flex items-center gap-2 rounded px-1 text-left focus:bg-blue-50 focus:outline-none"
                        onClick={() => onToggleGroup(groupKey)}
                      >
                        {groupOpen ? (
                          <ChevronDown className="h-4 w-4 text-slate-700" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="font-semibold text-slate-900">{row.groupName}</span>
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-900">{row.groupName}</span>
                    )}
                  </div>
                  <div className="text-right font-semibold text-slate-900">
                    {formatCurrencyAmount(row.amount, company)}
                  </div>
                </div>

                {groupOpen && hasLedgers ? (
                  <div className="mt-4 space-y-4">
                    {(row.ledgers || []).map((ledger) => {
                      const ledgerKey = `${groupKey}-${ledger.ledgerId}`;
                      const ledgerOpen = expandedLedgers[ledgerKey];
                      return (
                        <Fragment key={ledgerKey}>
                          <div className="flex items-center justify-between gap-4 pl-6">
                            <button
                              type="button"
                              data-report-nav="true"
                              data-report-back={ledgerOpen ? "true" : "false"}
                              className="flex min-w-0 items-center gap-2 rounded px-1 text-left text-slate-700 focus:bg-blue-50 focus:outline-none"
                              onClick={() => onToggleLedger(ledgerKey)}
                            >
                              {ledgerOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-700" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                              <span className="truncate">{ledger.ledgerName}</span>
                            </button>
                            <div className="text-right text-slate-800">
                              {formatCurrencyAmount(ledger.amount, company)}
                            </div>
                          </div>
                          {ledgerOpen ? (
                            <div className="mt-3 pl-4">
                              <table className="w-full">
                                <tbody>
                                  <LedgerDrilldownRow
                                    companyId={companyId}
                                    ledgerId={ledger.ledgerId}
                                    fromDate={fromDate}
                                    toDate={toDate}
                                    company={company}
                                    colSpan={1}
                                    mode="inventory"
                                  />
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="px-6 py-5">
        <div className="rounded-lg bg-[#eef5ff] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold uppercase tracking-wide text-[#1d62d6]">
              Total
            </span>
            <span className="text-[15px] font-semibold text-slate-900">
              {formatCurrencyAmount(total, company)}
            </span>
          </div>
          <div className="mt-2 text-[13px] text-slate-500">
            Opening: {formatCurrencyAmount(openingTotal, company)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BalanceSheetPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const now = new Date();
  const monthStart = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [showFilters, setShowFilters] = useState(false);
  const [report, setReport] = useState({ assets: [], liabilities: [], totals: {} });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedLedgers, setExpandedLedgers] = useState({});

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || response.data[0]._id);
      }
    }
    loadCompanies();
  }, []);

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

  const selectedCompany = companies.find((company) => company._id === companyId);
  const netTotal = useMemo(
    () => Math.max(Number(report.totals?.assets || 0), Number(report.totals?.liabilities || 0)),
    [report.totals]
  );
  useReportKeyboardNav(containerRef, [report, expandedGroups, expandedLedgers], {
    onExit: () => navigate(-1),
  });

  function toggleGroup(key) {
    setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleLedger(key) {
    setExpandedLedgers((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f7f9fc] px-6 py-6 text-slate-900">
      <div className="mx-auto max-w-[1380px]">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
              Balance Sheet
            </h1>
            <div className="mt-2 text-[14px] text-slate-500">
              As at {formatDisplayDate(toDate)}
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
            <select
              className="h-11 min-w-[120px] rounded-xl border border-slate-200 bg-white px-4 text-[14px] shadow-sm outline-none"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {companies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
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
              onClick={() => exportBalanceCsv(report, selectedCompany)}
            >
              <Download className="h-4 w-4" />
              Export
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
                  <select
                    className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-[14px] outline-none"
                    value={companyId}
                    onChange={(event) => setCompanyId(event.target.value)}
                  >
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <div className="grid xl:grid-cols-2">
            <BalanceColumn
              title="Liabilities"
              rows={report.liabilities || []}
              openingTotal={report.totals?.openingLiabilities}
              total={report.totals?.liabilities}
              company={selectedCompany}
              companyId={companyId}
              fromDate={fromDate}
              toDate={toDate}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              expandedLedgers={expandedLedgers}
              onToggleLedger={toggleLedger}
            />
            <BalanceColumn
              title="Assets"
              rows={report.assets || []}
              openingTotal={report.totals?.openingAssets}
              total={report.totals?.assets}
              company={selectedCompany}
              companyId={companyId}
              fromDate={fromDate}
              toDate={toDate}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              expandedLedgers={expandedLedgers}
              onToggleLedger={toggleLedger}
            />
          </div>
        </section>

        <section className="mt-6 rounded-[18px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3 text-[14px]">
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
            Total : {formatCurrencyAmount(netTotal, selectedCompany)}
          </div>
        </section>
      </div>
    </div>
  );
}
