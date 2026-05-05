import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  CalendarDays,
  Download,
  Filter,
  MoreVertical,
  Printer,
  Scale,
  Wallet,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { formatCurrencyAmount } from "../utils/currency";
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

function netBalanceLabel(debit = 0, credit = 0, company) {
  const net = Number(debit || 0) - Number(credit || 0);
  const side = net >= 0 ? "Dr" : "Cr";
  return `${formatCurrencyAmount(Math.abs(net), company)} ${side}`;
}

function collectLedgerOptions(nodes, trail = []) {
  return (nodes || []).flatMap((node) => [
    ...(node.ledgers || []).map((ledger) => ({
      value: String(ledger.id),
      label: ledger.name,
      groupTrail: [...trail, node.name].join(" / "),
    })),
    ...collectLedgerOptions(node.children || [], [...trail, node.name]),
  ]);
}

function exportTrialCsv(tree, company) {
  const rows = [
    ["Particulars", "Group", "Opening Dr", "Opening Cr", "Debit", "Credit", "Closing Dr", "Closing Cr"],
  ];

  function walk(nodes, depth = 0) {
    (nodes || []).forEach((node) => {
      rows.push([
        `${" ".repeat(depth * 2)}${node.name}`,
        node.nature || "",
        node.totals?.openingDebit || 0,
        node.totals?.openingCredit || 0,
        node.totals?.debit || 0,
        node.totals?.credit || 0,
        node.totals?.closingDebit || 0,
        node.totals?.closingCredit || 0,
      ]);
      (node.ledgers || []).forEach((ledger) => {
        rows.push([
          `${" ".repeat((depth + 1) * 2)}${ledger.name}`,
          ledger.groupName || "",
          ledger.totals?.openingDebit || 0,
          ledger.totals?.openingCredit || 0,
          ledger.totals?.debit || 0,
          ledger.totals?.credit || 0,
          ledger.totals?.closingDebit || 0,
          ledger.totals?.closingCredit || 0,
        ]);
      });
      walk(node.children || [], depth + 1);
    });
  }

  walk(tree);
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trial-balance-${company?.name || "company"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ icon: Icon, title, value, subtitle, iconClass = "" }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ${iconClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-[16px] font-semibold text-emerald-600">{value}</p>
          {subtitle ? <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
    </article>
  );
}

function findGroupPath(nodes, targetId, trail = []) {
  for (const node of nodes || []) {
    if (String(node.id) === String(targetId)) return [...trail, node];
    const childPath = findGroupPath(node.children || [], targetId, [...trail, node]);
    if (childPath.length) return childPath;
  }
  return [];
}

function findGroupById(nodes, targetId) {
  return findGroupPath(nodes, targetId).slice(-1)[0] || null;
}

export default function TrialBalance() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = new Date();
  const monthStart = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const { companies, companyId, selectedCompany } = useActiveCompany();
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || monthEnd);
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get("groupFilter") || "");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [reportView, setReportView] = useState("Detailed");
  const [report, setReport] = useState({ rows: [], totals: null, tree: [] });
  const [loading, setLoading] = useState(false);
  const detailGroupId = searchParams.get("groupId") || "";

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(`/companies/${companyId}/reports/trial-balance`, {
          params: { from: fromDate, to: toDate },
        });
        setReport(response.data);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, fromDate, toDate]);

  const summary = useMemo(() => report.totals || {}, [report.totals]);
  const ledgerOptions = useMemo(() => collectLedgerOptions(report.tree || []), [report.tree]);
  const activeGroup = useMemo(
    () => (detailGroupId ? findGroupById(report.tree || [], detailGroupId) : null),
    [detailGroupId, report.tree],
  );
  const detailGroupPath = useMemo(
    () => (detailGroupId ? findGroupPath(report.tree || [], detailGroupId) : []),
    [detailGroupId, report.tree],
  );

  const topRows = useMemo(() => {
    const baseGroups = detailGroupId ? activeGroup?.children || [] : report.tree || [];
    let rows = [
      ...baseGroups.map((group) => ({ type: "group", ...group })),
      ...((detailGroupId ? activeGroup?.ledgers : []) || []).map((ledger) => ({ type: "ledger", ...ledger })),
    ];

    if (selectedGroup) {
      rows = rows.filter((row) =>
        row.type === "group" ? String(row.id) === selectedGroup : String(row.groupId || row.id) === selectedGroup,
      );
    }
    if (selectedLedger) {
      rows = rows.filter((row) => row.type === "ledger" && String(row.id) === selectedLedger);
    }
    return rows;
  }, [activeGroup, detailGroupId, report.tree, selectedGroup, selectedLedger]);

  useReportFocusRestore(containerRef, [topRows, companyId, fromDate, toDate, detailGroupId]);
  useReportKeyboardNav(containerRef, [topRows, detailGroupId, companyId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function openGroup(group) {
    navigate(
      `/reports/financial/trial-balance?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&groupId=${encodeURIComponent(group.id)}`,
      {
        state: buildReportReturnState(location, `tb-group-${group.id}`),
      },
    );
  }

  function openLedger(ledger) {
    navigate(
      `/reports/account-books/ledger-detail?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&ledgerId=${encodeURIComponent(ledger.id)}&ledgerName=${encodeURIComponent(ledger.name)}&mode=inventory`,
      {
        state: buildReportReturnState(location, `tb-ledger-${ledger.id}`),
      },
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f7f9fc] px-6 py-6 text-slate-900">
      <div className="mx-auto max-w-[1380px]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-5">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                {detailGroupId ? (
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
                  Trial Balance
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-slate-500">
                  <span>Company : <span className="font-medium text-slate-700">{selectedCompany?.name || "-"}</span></span>
                  <span>Period : {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</span>
                  {detailGroupPath.length ? (
                    <span>
                      Group :{" "}
                      <span className="font-medium text-slate-700">
                        {detailGroupPath.map((group) => group.name).join(" / ")}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 min-w-[268px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 shadow-sm">
                  <CalendarDays className="h-4 w-4 text-slate-500" />
                  <input
                    type="date"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] outline-none"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                  <span className="text-slate-400">to</span>
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
                  onClick={() => exportTrialCsv(report.tree || [], selectedCompany)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1463ff] px-5 text-[14px] font-medium text-white shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[14px] font-medium text-slate-700 shadow-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={Wallet}
                title="Opening Balance"
                value={netBalanceLabel(summary.openingDebit, summary.openingCredit, selectedCompany)}
                iconClass="text-emerald-600"
              />
              <SummaryCard
                icon={ArrowLeftRight}
                title="Total Transactions"
                value=""
                subtitle={
                  <span className="inline-flex gap-5">
                    <span className="text-blue-600">Debit {formatCurrencyAmount(summary.debit, selectedCompany)}</span>
                    <span className="text-rose-600">Credit {formatCurrencyAmount(summary.credit, selectedCompany)}</span>
                  </span>
                }
                iconClass="text-blue-600"
              />
              <SummaryCard
                icon={Wallet}
                title="Closing Balance"
                value={netBalanceLabel(summary.closingDebit, summary.closingCredit, selectedCompany)}
                iconClass="text-amber-500"
              />
              <SummaryCard
                icon={Scale}
                title="Balance Check"
                value={Math.abs(Number(summary.debit || 0) - Number(summary.credit || 0)) < 0.01 ? "Balanced" : "Out of Balance"}
                subtitle={`Difference: ${formatCurrencyAmount(Math.abs(Number(summary.debit || 0) - Number(summary.credit || 0)), selectedCompany)}`}
                iconClass="text-violet-600"
              />
            </section>

            <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              {loading ? (
                <div className="p-10 text-center text-sm text-slate-500">Loading trial balance...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[14px]">
                    <thead className="bg-[#f8fafc] text-slate-700">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold">Particulars</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Opening Balance</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold" colSpan={2}>Transactions</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold">Closing Balance</th>
                      </tr>
                      <tr className="text-[13px]">
                        <th className="px-4 py-2 text-left font-medium text-slate-400" />
                        <th className="px-4 py-2 text-right font-medium text-slate-400" />
                        <th className="px-4 py-2 text-right font-medium text-blue-600">Debit</th>
                        <th className="px-4 py-2 text-right font-medium text-rose-600">Credit</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-400" />
                      </tr>
                    </thead>
                    <tbody>
                      {topRows.map((row) => (
                        <tr key={`${row.type}-${row.id}`} className="border-t border-slate-100 bg-white">
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {row.type === "group" ? (
                              <button
                                type="button"
                                data-report-nav="true"
                                data-focus-key={`tb-group-${row.id}`}
                                className="rounded px-1 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                                onClick={() => openGroup(row)}
                              >
                                {row.name}
                              </button>
                            ) : (
                              <button
                                type="button"
                                data-report-nav="true"
                                data-focus-key={`tb-ledger-${row.id}`}
                                className="rounded px-1 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                                onClick={() => openLedger(row)}
                              >
                                {row.name}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {netBalanceLabel(row.totals?.openingDebit, row.totals?.openingCredit, selectedCompany)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-blue-600">
                            {formatCurrencyAmount(row.totals?.debit, selectedCompany)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-rose-600">
                            {formatCurrencyAmount(row.totals?.credit, selectedCompany)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                            {netBalanceLabel(row.totals?.closingDebit, row.totals?.closingCredit, selectedCompany)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {topRows.length > 0 ? (
                      <tfoot>
                        <tr className="border-t border-amber-200 bg-[#fff8e7] font-semibold text-slate-900">
                          <td className="px-4 py-3">Grand Total</td>
                          <td className="px-4 py-3 text-right">
                            {netBalanceLabel(summary.openingDebit, summary.openingCredit, selectedCompany)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            {formatCurrencyAmount(summary.debit, selectedCompany)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            {formatCurrencyAmount(summary.credit, selectedCompany)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {netBalanceLabel(summary.closingDebit, summary.closingCredit, selectedCompany)}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                  {topRows.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      No trial balance rows found for the selected period.
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <aside className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-slate-700" />
              <h2 className="text-[15px] font-semibold uppercase tracking-wide text-slate-700">
                Filters
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Date Range</label>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-700">
                  {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}
                </div>
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

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Group</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={selectedGroup}
                  onChange={(event) => {
                    setSelectedGroup(event.target.value);
                    setSelectedLedger("");
                  }}
                >
                  <option value="">All Groups</option>
                  {(report.tree || []).map((group) => (
                    <option key={group.id} value={String(group.id)}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Ledger-wise</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={selectedLedger}
                  onChange={(event) => setSelectedLedger(event.target.value)}
                >
                  <option value="">All Ledgers</option>
                  {ledgerOptions.map((ledger) => (
                    <option key={ledger.value} value={ledger.value}>
                      {ledger.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-medium text-slate-600">Report View</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-[14px] outline-none"
                  value={reportView}
                  onChange={(event) => setReportView(event.target.value)}
                >
                  <option>Detailed</option>
                  <option>Summary</option>
                </select>
              </div>

              <button type="button" className="w-full rounded-xl bg-[#1463ff] px-4 py-3 text-[14px] font-medium text-white shadow-sm">
                Apply Filter
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] font-medium text-slate-700"
                onClick={() => {
                  setSelectedGroup("");
                  setSelectedLedger("");
                  setReportView("Detailed");
                  setFromDate(monthStart);
                  setToDate(monthEnd);
                }}
              >
                Clear Filter
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
