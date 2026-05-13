import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarRange, Download, Landmark } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { jsPDF } from "jspdf/dist/jspdf.umd.min.js";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export default function LedgerDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = formatLocalDateInput(new Date());
  const monthStart = formatLocalDateInput(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(searchParams.get("companyId") || "");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || today);
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const ledgerId = searchParams.get("ledgerId") || "";
  const ledgerName = searchParams.get("ledgerName") || "Ledger Detail";
  const mode = searchParams.get("mode") || "full";

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      const list = response.data || [];
      setCompanies(list);
      if (list.length > 0) {
        setCompanyId((current) => current || list[0]._id);
      }
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!companyId || !ledgerId) return;
      setState({ loading: true, error: "", data: null });
      try {
        const endpoint =
          mode === "profit-loss"
            ? `/companies/${companyId}/reports/profit-loss-drilldown`
            : `/companies/${companyId}/reports/ledger-drilldown`;
        const response = await api.get(endpoint, {
          params:
            mode === "profit-loss"
              ? {
                  from: fromDate || undefined,
                  to: toDate || undefined,
                }
              : {
                  ledgerId,
                  from: fromDate || undefined,
                  to: toDate || undefined,
                },
        });
        if (active) {
          setState({ loading: false, error: "", data: response.data });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error?.response?.data?.message || "Could not load ledger details.",
            data: null,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [companyId, ledgerId, fromDate, toDate]);

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company._id) === String(companyId)),
    [companies, companyId],
  );

  useReportFocusRestore(containerRef, [companyId, ledgerId, fromDate, toDate]);
  useReportKeyboardNav(containerRef, [state.data?.entries, companyId, ledgerId], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  function exportToPdf() {
    const entries = state.data?.entries || [];
    const debitRows = [];
    const creditRows = [];

    const openingBalance = Number(state.data?.openingBalance || 0);
    if (openingBalance > 0) {
      debitRows.push({
        date: formatShortDate(fromDate),
        particulars: "Opening Balance",
        amount: openingBalance,
      });
    } else if (openingBalance < 0) {
      creditRows.push({
        date: formatShortDate(fromDate),
        particulars: "Opening Balance",
        amount: Math.abs(openingBalance),
      });
    }

    entries.forEach((entry) => {
      const particulars =
        mode === "inventory"
          ? `${entry.voucherName}${entry.itemName ? ` ${entry.itemName}` : ""}`.trim()
          : `${entry.voucherName}${entry.voucherNumber ? ` ${entry.voucherNumber}` : ""}${entry.counterpart ? ` ${entry.counterpart}` : ""}`.trim();

      if (Number(entry.debit || 0) > 0) {
        debitRows.push({
          date: entry.dateLabel || formatShortDate(toDate),
          particulars,
          amount: Number(entry.debit || 0),
        });
      }
      if (Number(entry.credit || 0) > 0) {
        creditRows.push({
          date: entry.dateLabel || formatShortDate(toDate),
          particulars,
          amount: Number(entry.credit || 0),
        });
      }
    });

    if (debitRows.length === 0 && creditRows.length === 0) {
      window.alert("No ledger entries available for PDF export.");
      return;
    }

    const debitTotal = debitRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const creditTotal = creditRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const closingBalance = Math.abs(Number(state.data?.closingBalance || 0));
    const closingOnDebit = Number(state.data?.closingBalance || 0) > 0;
    const debitFinal =
      closingOnDebit && closingBalance > 0 ? closingBalance : debitTotal;
    const creditFinal =
      !closingOnDebit && closingBalance > 0 ? closingBalance : creditTotal;

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
    const companyName = selectedCompany?.name || "Company";
    const groupName = state.data?.ledger?.groupName || "-";
    const todayText = formatShortDate(new Date());

    function drawHeader() {
      let y = 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("To :", leftX, y);
      doc.text("From :", rightX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(ledgerName, leftX + 12, y);
      doc.text(companyName, rightX + 18, y);
      y += 5;
      doc.text(`Group: ${groupName}`, leftX + 12, y);
      y += 5;
      doc.text(`Ledger Register`, leftX + 12, y);

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

    if (closingBalance > 0) {
      y += 8;
      doc.line(leftX, y - 3, amountRightLeft, y - 3);
      doc.line(rightX, y - 3, amountRightRight, y - 3);
      doc.setFont("helvetica", "normal");
      // doc.text(
      //   `Closing Balance (${closingOnDebit ? "DR" : "CR"})`,
      //   pageWidth / 2,
      //   y,
      //   { align: "right" },
      // );
      if (closingOnDebit) {
        doc.text(formatPlainAmount(closingBalance, selectedCompany), amountRightLeft, y, {
          align: "right",
        });
      } else {
        doc.text(formatPlainAmount(closingBalance, selectedCompany), amountRightRight, y, {
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

    doc.save(`ledger-register-${ledgerName}-${fromDate}-to-${toDate}.pdf`);
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
                onClick={() => navigateBackFromReport(navigate, location)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">{ledgerName}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {mode === "profit-loss"
                  ? <>Profit & loss contribution register. Press <span className="font-semibold">Esc</span> or <span className="font-semibold">Backspace</span> to go back.</>
                  : <>Voucher-wise ledger register. Press <span className="font-semibold">Esc</span> or <span className="font-semibold">Backspace</span> to go back.</>}
              </p>
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={exportToPdf}
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CompanyPicker
                companies={companies}
                value={companyId}
                onChange={setCompanyId}
                label="Company"
              />
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  From
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarRange className="h-4 w-4 text-blue-600" />
                  To
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {state.loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Loading ledger breakdown...
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {state.error}
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Opening", state.data?.openingBalance, "text-slate-900"],
                ["Debit", state.data?.totals?.debit, "text-emerald-700"],
                ["Credit", state.data?.totals?.credit, "text-rose-700"],
                ["Closing", state.data?.closingBalance, "text-blue-700"],
              ].map(([label, value, tone]) => (
                <article
                  key={label}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                >
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className={`mt-2 text-2xl font-bold ${tone}`}>
                    {formatCurrencyAmount(value, selectedCompany)}
                  </p>
                </article>
              ))}
            </section>

            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  Voucher Register
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Voucher</th>
                      {mode === "inventory" ? (
                        <th className="px-3 py-2 font-medium">Item Name</th>
                      ) : (
                        <>
                          <th className="px-3 py-2 font-medium">No.</th>
                          <th className="px-3 py-2 font-medium">Counterpart</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                      <th className="px-3 py-2 text-right font-medium">Running</th>
                      <th className="px-3 py-2 text-right font-medium">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.entries || []).map((entry, index) => (
                      <tr key={`${entry.voucherId}-${entry.lineIndex}-${index}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{entry.dateLabel}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{entry.voucherName}</td>
                        {mode === "inventory" ? (
                          <td className="px-3 py-2 text-slate-600">{entry.itemName || "-"}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-slate-700">{entry.voucherNumber || "-"}</td>
                            <td className="px-3 py-2 text-slate-600">{entry.counterpart || "-"}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {formatCurrencyAmount(entry.debit, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right text-rose-700">
                          {formatCurrencyAmount(entry.credit, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {formatCurrencyAmount(entry.runningBalance, selectedCompany)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            disabled={!entry.voucherId}
                            type="button"
                            data-report-nav="true"
                            data-focus-key={`entry-${entry.voucherId}-${entry.lineIndex}-${index}`}
                            className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent"
                            onClick={() =>
                              entry.voucherId
                                ? navigate(buildAlterVoucherPath(companyId, entry.voucherId), {
                                    state: buildReportReturnState(
                                      location,
                                      `entry-${entry.voucherId}-${entry.lineIndex}-${index}`,
                                    ),
                                  })
                                : null
                            }
                          >
                            Alter
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(state.data?.entries || []).length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No voucher entries found for this ledger in the selected range.
                  </div>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
