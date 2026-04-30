import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  MoreVertical,
  Printer,
  Scale,
  Wallet,
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

function filterTree(nodes, selectedGroup, selectedLedger) {
  return (nodes || [])
    .map((node) => {
      const childMatches = filterTree(node.children || [], selectedGroup, selectedLedger);
      const ledgerMatches = (node.ledgers || []).filter((ledger) =>
        selectedLedger ? String(ledger.id) === selectedLedger : true
      );
      const groupAllowed = selectedGroup ? String(node.id) === selectedGroup : true;
      const keepNode =
        groupAllowed ||
        childMatches.length > 0 ||
        ledgerMatches.length > 0 ||
        (selectedGroup &&
          childMatches.some((child) => child.parentTrail?.includes(String(node.id))));

      if (!keepNode) return null;

      return {
        ...node,
        parentTrail: [String(node.id), ...(node.parentTrail || [])],
        ledgers: groupAllowed || !selectedGroup ? ledgerMatches : ledgerMatches,
        children: childMatches,
      };
    })
    .filter(Boolean);
}

function exportTrialCsv(tree, company) {
  const rows = [
    [
      "Particulars",
      "Group",
      "Opening Dr",
      "Opening Cr",
      "Debit",
      "Credit",
      "Closing Dr",
      "Closing Cr",
    ],
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
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 ${iconClass}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-600">{title}</p>
          <p className="mt-1 text-[16px] font-semibold text-emerald-600">{value}</p>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function TrialBalance() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const today = new Date();
  const monthStart = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = formatLocalDateInput(
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  );

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedLedger, setSelectedLedger] = useState("");
  const [reportView, setReportView] = useState("Detailed");
  const [report, setReport] = useState({ rows: [], totals: null, tree: [] });
  const [loading, setLoading] = useState(false);
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

  const selectedCompany = companies.find((company) => company._id === companyId);
  const summary = useMemo(() => report.totals || {}, [report.totals]);
  const ledgerOptions = useMemo(() => collectLedgerOptions(report.tree || []), [report.tree]);
  const visibleTree = useMemo(
    () => filterTree(report.tree || [], selectedGroup, selectedLedger),
    [report.tree, selectedGroup, selectedLedger]
  );
  useReportKeyboardNav(containerRef, [visibleTree, expandedGroups, expandedLedgers], {
    onExit: () => navigate(-1),
  });

  function toggleGroup(groupId) {
    setExpandedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  function toggleLedger(ledgerId) {
    setExpandedLedgers((current) => ({ ...current, [ledgerId]: !current[ledgerId] }));
  }

  function renderLedgerRow(ledger, level) {
    const ledgerOpen = expandedLedgers[String(ledger.id)];

    return (
      <Fragment key={`ledger-${ledger.id}`}>
        <tr className="border-t border-slate-100 bg-white">
          <td className="px-4 py-2.5 font-medium text-slate-800">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
              <button
                type="button"
                data-report-nav="true"
                data-report-back={ledgerOpen ? "true" : "false"}
                className="flex items-center gap-2 rounded px-1 focus:bg-blue-50 focus:outline-none"
                onClick={() => toggleLedger(String(ledger.id))}
              >
                {ledgerOpen ? (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <span>{ledger.name}</span>
              </button>
            </div>
          </td>
          <td className="px-4 py-2.5 text-right text-slate-700">
            {netBalanceLabel(ledger.totals?.openingDebit, ledger.totals?.openingCredit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right text-blue-600">
            {formatCurrencyAmount(ledger.totals?.debit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right text-rose-600">
            {formatCurrencyAmount(ledger.totals?.credit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right font-medium text-slate-800">
            {netBalanceLabel(
              ledger.totals?.closingDebit,
              ledger.totals?.closingCredit,
              selectedCompany
            )}
          </td>
        </tr>
        {ledgerOpen ? (
          <LedgerDrilldownRow
            companyId={companyId}
            ledgerId={ledger.id}
            fromDate={fromDate}
            toDate={toDate}
            company={selectedCompany}
            colSpan={5}
            mode="inventory"
          />
        ) : null}
      </Fragment>
    );
  }

  function renderGroupRows(nodes, level = 0) {
    return nodes.flatMap((node) => {
      const groupOpen = expandedGroups[String(node.id)];
      const rows = [
        <tr
          key={`group-${node.id}`}
          className={`${level === 0 ? "bg-white" : "bg-slate-50/50"} border-t border-slate-100`}
        >
          <td className="px-4 py-2.5 font-semibold text-slate-900">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 18}px` }}>
              <button
                type="button"
                data-report-nav="true"
                data-report-back={groupOpen ? "true" : "false"}
                className="flex items-center gap-2 rounded px-1 focus:bg-blue-50 focus:outline-none"
                onClick={() => toggleGroup(String(node.id))}
              >
                {groupOpen ? (
                  <ChevronDown className="h-4 w-4 text-blue-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <span>{node.name}</span>
              </button>
            </div>
          </td>
          <td className="px-4 py-2.5 text-right text-slate-700">
            {netBalanceLabel(node.totals?.openingDebit, node.totals?.openingCredit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right text-blue-600">
            {formatCurrencyAmount(node.totals?.debit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right text-rose-600">
            {formatCurrencyAmount(node.totals?.credit, selectedCompany)}
          </td>
          <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
            {netBalanceLabel(
              node.totals?.closingDebit,
              node.totals?.closingCredit,
              selectedCompany
            )}
          </td>
        </tr>,
      ];

      if (groupOpen) {
        rows.push(...(node.ledgers || []).map((ledger) => renderLedgerRow(ledger, level + 1)));
        rows.push(...renderGroupRows(node.children || [], level + 1));
      }

      return rows;
    });
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f7f9fc] px-6 py-6 text-slate-900">
      <div className="mx-auto max-w-[1380px]">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-5">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-slate-900">
                  Trial Balance
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-slate-500">
                  <span>Company : <span className="font-medium text-slate-700">{selectedCompany?.name || "-"}</span></span>
                  <span>Period : {formatDisplayDate(fromDate)} to {formatDisplayDate(toDate)}</span>
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
                <select
                  className="h-11 min-w-[140px] rounded-xl border border-slate-200 bg-white px-4 text-[14px] shadow-sm outline-none"
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
                  onClick={() => exportTrialCsv(visibleTree, selectedCompany)}
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
                subtitle=""
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
                subtitle={`Difference: ${formatCurrencyAmount(
                  Math.abs(Number(summary.debit || 0) - Number(summary.credit || 0)),
                  selectedCompany
                )}`}
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
                        <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold" colSpan={2}>
                          Transactions
                        </th>
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
                    <tbody>{renderGroupRows(visibleTree)}</tbody>
                    {(visibleTree || []).length > 0 ? (
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

                  {(visibleTree || []).length === 0 ? (
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
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
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

              <button
                type="button"
                className="w-full rounded-xl bg-[#1463ff] px-4 py-3 text-[14px] font-medium text-white shadow-sm"
              >
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
