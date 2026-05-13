import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, Download, Layers3, ScrollText, Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import api from "../api/api";
import { useActiveCompany } from "../Contexts/ActiveCompanyContext";
import { formatCurrencyAmount } from "../utils/currency";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SummaryCard({ icon: Icon, title, value, tone = "text-slate-900" }) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
        </div>
      </div>
    </article>
  );
}

function formatBalanceWithSide(value, side, company) {
  return `${formatCurrencyAmount(Math.abs(Number(value || 0)), company)} ${side || "DR"}`;
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatPlainAmount(value, company) {
  const decimals = Number(company?.decimalPlaces || 2);
  return Math.abs(Number(value || 0)).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function AccountBooksSummaryPage({ mode = "group" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = new Date();
  const monthStart = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const { companyId, selectedCompany } = useActiveCompany();

  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || monthEnd);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [report, setReport] = useState({ rows: [], searchRows: [], totals: {}, trail: [] });
  const [loading, setLoading] = useState(false);
  const groupId = searchParams.get("groupId") || "";

  useEffect(() => {
    async function loadReport() {
      if (!companyId) return;
      setLoading(true);
      try {
        const response = await api.get(`/companies/${companyId}/reports/account-books-summary`, {
          params: {
            mode,
            from: fromDate,
            to: toDate,
            groupId: mode === "group" ? groupId : "",
          },
        });
        setReport(response.data || { rows: [], searchRows: [], totals: {}, trail: [] });
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [companyId, fromDate, toDate, mode, groupId]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sourceRows = query ? report.searchRows || report.rows || [] : report.rows || [];
    return sourceRows.filter((row) =>
      [row.name, row.groupName, row.groupTrail]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [report.rows, report.searchRows, search]);

  useReportFocusRestore(containerRef, [filteredRows, companyId, fromDate, toDate, mode, groupId]);
  useReportKeyboardNav(containerRef, [filteredRows, companyId, fromDate, toDate, mode, groupId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function openRow(row) {
    if (row.rowType === "group") {
      navigate(
        `/reports/account-books/group?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&groupId=${encodeURIComponent(row.id)}`,
        {
          state: buildReportReturnState(location, `ab-group-${row.id}`),
        },
      );
      return;
    }

    navigate(
      `/reports/account-books/ledger-detail?companyId=${encodeURIComponent(companyId)}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&ledgerId=${encodeURIComponent(row.id)}&ledgerName=${encodeURIComponent(row.name)}&mode=inventory`,
      {
        state: buildReportReturnState(location, `ab-ledger-${row.id}`),
      },
    );
  }

  const title = mode === "group" ? "Group" : "Ledger";
  const searchLabel = mode === "group" ? "Group" : "Ledger";
  const breadcrumbLabel =
    mode === "group" && report.trail?.length
      ? report.trail.map((entry) => entry.name).join(" / ")
      : "";

  function exportToPdf() {
    const rowsForPdf = filteredRows.filter((row) => {
      const opening = Math.abs(Number(row.openingValue || 0));
      const debit = Math.abs(Number(row.debit || 0));
      const credit = Math.abs(Number(row.credit || 0));
      const closing = Math.abs(Number(row.closingValue || 0));
      return opening > 0 || debit > 0 || credit > 0 || closing > 0;
    });

    if (rowsForPdf.length === 0) {
      window.alert("No non-zero rows available for PDF export.");
      return;
    }

    const debitRows = rowsForPdf
      .filter((row) => String(row.closingSide || "DR").toUpperCase() !== "CR")
      .map((row) => ({
        date: formatShortDate(toDate),
        particulars: row.groupTrail ? `${row.name} (${row.groupTrail})` : row.name,
        amount: Number(row.closingValue || 0),
      }));
    const creditRows = rowsForPdf
      .filter((row) => String(row.closingSide || "DR").toUpperCase() === "CR")
      .map((row) => ({
        date: formatShortDate(toDate),
        particulars: row.groupTrail ? `${row.name} (${row.groupTrail})` : row.name,
        amount: Number(row.closingValue || 0),
      }));

    const debitTotal = debitRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const creditTotal = creditRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const closingDifference = Math.abs(debitTotal - creditTotal);
    const debitFinal = debitTotal < creditTotal ? debitTotal + closingDifference : debitTotal;
    const creditFinal = creditTotal < debitTotal ? creditTotal + closingDifference : creditTotal;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const verticalDividerX = pageWidth / 2;
    const leftX = marginX;
    const rightX = verticalDividerX + 3;
    const amountRightLeft = verticalDividerX - 2;
    const amountRightRight = pageWidth - marginX;
    const lineHeight = 5.2;
    const scopeLabel = breadcrumbLabel || (mode === "group" ? "Primary Groups" : "All Ledgers");
    const searchLabelText = search.trim() ? search.trim() : "All";
    const companyName = selectedCompany?.name || "Company";
    const reportTitle = mode === "group" ? "Group Report" : "Ledger Report";
    const todayText = formatShortDate(new Date());

    function drawHeader() {
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("To :", leftX, y);
      doc.text("From :", rightX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(scopeLabel, leftX + 12, y);
      doc.text(companyName, rightX + 18, y);
      y += 5;
      doc.text(`Filter: ${searchLabelText}`, leftX + 12, y);
      y += 5;
      doc.text(`Report: ${reportTitle}`, leftX + 12, y);

      y += 12;
      doc.text("Dear Sir/Madam,", leftX, y);
      doc.text(`Date : ${todayText}`, pageWidth - marginX, y, { align: "right" });

      y += 9;
      doc.setFont("helvetica", "bold");
      doc.text("Sub: Confirmation of Accounts", pageWidth / 2, y, { align: "center" });
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`${formatShortDate(fromDate)} to ${formatShortDate(toDate)}`, pageWidth / 2, y, {
        align: "center",
      });

      y += 10;
      const paragraph1 =
        "Given below is the details of your Accounts as standing in my/our Books of Accounts for the above mentioned period.";
      const paragraph2 =
        "Kindly return 3 copies stating your I.T. Permanent A/c No., duly signed and sealed, in confirmation of the same. Please note that if no reply is received from you within a fortnight, it will be assumed that you have accepted the balance shown below.";
      doc.text(doc.splitTextToSize(paragraph1, pageWidth - marginX * 2), leftX, y);
      y += 12;
      doc.text(doc.splitTextToSize(paragraph2, pageWidth - marginX * 2), leftX, y);
      y += 15;

      doc.setDrawColor(60);
      doc.setLineWidth(0.25);
      doc.line(leftX, y - 3, pageWidth - marginX, y - 3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("Date", leftX + 4, y);
      doc.text("Particulars", leftX + 28, y);
      doc.text("Debit Amount", amountRightLeft, y, { align: "right" });
      doc.text("Date", rightX + 4, y);
      doc.text("Particulars", rightX + 28, y);
      doc.text("Credit Amount", amountRightRight, y, { align: "right" });
      doc.line(verticalDividerX, y - 6, verticalDividerX, pageHeight - 36);
      return y + 4;
    }

    let y = drawHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const maxRows = Math.max(debitRows.length, creditRows.length);

    for (let index = 0; index < maxRows; index += 1) {
      if (y > pageHeight - 32) {
        doc.addPage();
        y = drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }

      const leftRow = debitRows[index];
      const rightRow = creditRows[index];

      if (leftRow) {
        doc.text(leftRow.date, leftX + 2, y);
        doc.text(String(leftRow.particulars || "").slice(0, 34), leftX + 24, y);
        doc.text(formatPlainAmount(leftRow.amount, selectedCompany), amountRightLeft, y, {
          align: "right",
        });
      }

      if (rightRow) {
        doc.text(rightRow.date, rightX + 2, y);
        doc.text(String(rightRow.particulars || "").slice(0, 34), rightX + 24, y);
        doc.text(formatPlainAmount(rightRow.amount, selectedCompany), amountRightRight, y, {
          align: "right",
        });
      }

      y += lineHeight;
    }

    y += 3;
    doc.line(leftX, y, amountRightLeft, y);
    doc.line(rightX, y, amountRightRight, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text(formatPlainAmount(debitTotal, selectedCompany), amountRightLeft, y, { align: "right" });
    doc.text(formatPlainAmount(creditTotal, selectedCompany), amountRightRight, y, { align: "right" });

    if (closingDifference > 0) {
      y += 8;
      doc.line(leftX, y - 3, amountRightLeft, y - 3);
      doc.line(rightX, y - 3, amountRightRight, y - 3);
      doc.setFont("helvetica", "normal");
      doc.text("Closing Balance", pageWidth / 2, y, { align: "center" });
      if (debitTotal < creditTotal) {
        doc.text(formatPlainAmount(closingDifference, selectedCompany), amountRightLeft, y, {
          align: "right",
        });
      } else {
        doc.text(formatPlainAmount(closingDifference, selectedCompany), amountRightRight, y, {
          align: "right",
        });
      }
    }

    y += 8;
    doc.line(leftX, y - 3, amountRightLeft, y - 3);
    doc.line(rightX, y - 3, amountRightRight, y - 3);
    doc.setFont("helvetica", "bold");
    doc.text(formatPlainAmount(debitFinal, selectedCompany), amountRightLeft, y, { align: "right" });
    doc.text(formatPlainAmount(creditFinal, selectedCompany), amountRightRight, y, { align: "right" });

    y += 16;
    doc.setFont("helvetica", "normal");
    doc.text("I/We hereby confirm the above", leftX, y);
    doc.text("Yours faithfully,", pageWidth - marginX, y, { align: "right" });

    const fileScope = mode === "group" ? "group" : "ledger";
    doc.save(`account-books-${fileScope}-${fromDate}-to-${toDate}.pdf`);
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1460px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
                <ScrollText className="h-3.5 w-3.5" />
                Account Books
              </div>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{title} Report</h1>
              <p className="mt-2 text-sm text-slate-500">
                Value-only account hierarchy. Drill deeper with Enter and step back with Esc or Backspace.
              </p>
              {breadcrumbLabel ? (
                <p className="mt-2 text-sm font-medium text-slate-700">{breadcrumbLabel}</p>
              ) : null}
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                className="mt-3 ml-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={exportToPdf}
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Company
                </label>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
                  {selectedCompany?.name || "-"}
                </div>
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  To
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Search className="h-4 w-4 text-blue-600" />
                  {searchLabel}
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder={`Search ${searchLabel.toLowerCase()}...`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Layers3}
            title={mode === "group" ? "Visible Groups / Ledgers" : "Visible Ledgers"}
            value={String(filteredRows.length)}
            tone="text-slate-900"
          />
          <SummaryCard
            icon={Building2}
            title="Opening Value"
            value={formatCurrencyAmount(report.totals?.openingValue, selectedCompany)}
            tone="text-slate-900"
          />
          <SummaryCard
            icon={Building2}
            title="Debit"
            value={formatCurrencyAmount(report.totals?.debit, selectedCompany)}
            tone="text-emerald-700"
          />
          <SummaryCard
            icon={Building2}
            title="Credit"
            value={formatCurrencyAmount(Math.abs(Number(report.totals?.credit || 0)), selectedCompany)}
            tone="text-rose-700"
          />
          {/* <SummaryCard
            icon={Building2}
            title="Closing Value"
            value={formatCurrencyAmount(Math.abs(Number(report.totals?.closingValue || 0)), selectedCompany)}
            tone="text-blue-700"
          /> */}
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title} Report</h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "group"
                ? "Opening, debit, credit, and closing values are shown here. Voucher details remain in the ledger drill screen."
                : "Ledger opening, debit, credit, and closing values are shown here. Open any ledger to continue to voucher details and alteration."}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">{title}</th>
                  <th className="px-6 py-3 text-right font-medium">Opening Value</th>
                  <th className="px-6 py-3 text-right font-medium">Debit</th>
                  <th className="px-6 py-3 text-right font-medium">Credit</th>
                  <th className="px-6 py-3 text-right font-medium">Closing (DR/CR)</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.rowType}-${row.id}`} className="border-t border-slate-100">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        data-report-nav="true"
                        data-focus-key={`ab-${row.rowType}-${row.id}`}
                        className="w-full rounded px-1 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                        onClick={() => openRow(row)}
                      >
                        <div className="font-medium text-slate-900">{row.name}</div>
                        {row.groupTrail ? (
                          <div className="mt-1 text-xs text-slate-500">{row.groupTrail}</div>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.openingValue, selectedCompany)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-700">
                      {formatCurrencyAmount(row.debit, selectedCompany)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-rose-700">
                      {formatCurrencyAmount(Math.abs(Number(row.credit || 0)), selectedCompany)}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-blue-700">
                      {formatBalanceWithSide(row.closingValue, row.closingSide, selectedCompany)}
                    </td>
                  </tr>
                ))}
                {!loading && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No rows found for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
