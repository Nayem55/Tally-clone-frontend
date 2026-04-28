import { Fragment, useEffect, useState } from "react";
import { CalendarRange, ChevronDown, ChevronRight } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import LedgerDrilldownRow from "../Component/LedgerDrilldownRow";
import { formatCurrencyAmount } from "../utils/currency";

function formatLocalDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function BalanceTable({
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
    <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="text-right text-sm">
          <div className="font-semibold text-slate-500">
            Opening: {formatCurrencyAmount(openingTotal, company)}
          </div>
          <div className="font-semibold text-slate-500">
            Closing: {formatCurrencyAmount(total, company)}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Particulars</th>
              <th className="px-4 py-3 text-right font-medium">Opening</th>
              <th className="px-4 py-3 text-right font-medium">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const groupKey = `${title}-${row.groupName}`;
              const groupOpen = expandedGroups[groupKey];
              const hasLedgers = (row.ledgers || []).length > 0;

              return (
                <Fragment key={groupKey}>
                  <tr className="border-t border-slate-100 bg-slate-50/70">
                    <td className="px-4 py-3">
                      {hasLedgers ? (
                        <button
                          type="button"
                          className="flex items-center gap-2 font-semibold text-slate-800"
                          onClick={() => onToggleGroup(groupKey)}
                        >
                          {groupOpen ? (
                            <ChevronDown className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                          {row.groupName}
                        </button>
                      ) : (
                        <div className="font-semibold text-slate-800">{row.groupName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.openingAmount, company)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrencyAmount(row.amount, company)}
                    </td>
                  </tr>

                  {hasLedgers &&
                    groupOpen &&
                    (row.ledgers || []).map((ledger) => {
                      const ledgerKey = `${groupKey}-${ledger.ledgerId}`;
                      const ledgerOpen = expandedLedgers[ledgerKey];

                      return (
                        <Fragment key={ledgerKey}>
                          <tr className="border-t border-slate-100">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 pl-6">
                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-slate-700"
                                  onClick={() => onToggleLedger(ledgerKey)}
                                >
                                  {ledgerOpen ? (
                                    <ChevronDown className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                  )}
                                  <span className="font-medium">{ledger.ledgerName}</span>
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-800">
                              {formatCurrencyAmount(ledger.openingAmount, company)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-800">
                              {formatCurrencyAmount(ledger.amount, company)}
                            </td>
                          </tr>
                          {ledgerOpen && (
                            <LedgerDrilldownRow
                              companyId={companyId}
                              ledgerId={ledger.ledgerId}
                              fromDate={fromDate}
                              toDate={toDate}
                              company={company}
                              colSpan={3}
                              mode="inventory"
                            />
                          )}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export default function BalanceSheetPage() {
  const now = new Date();
  const monthStart = formatLocalDateInput(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const monthEnd = formatLocalDateInput(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  );
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(monthEnd);
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

  function toggleGroup(key) {
    setExpandedGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleLedger(key) {
    setExpandedLedgers((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h1 className="text-3xl font-bold text-slate-900">Balance Sheet</h1>
              <p className="mt-2 text-sm text-slate-500">
                Review assets and liabilities as of the selected date.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
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

        <section className="grid gap-6 xl:grid-cols-2">
          <BalanceTable
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
          <BalanceTable
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
        </section>
      </div>
    </div>
  );
}
