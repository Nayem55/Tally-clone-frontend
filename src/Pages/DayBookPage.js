import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { buildAlterVoucherPath } from "../utils/voucherRoutes";
import useReportKeyboardNav from "../hooks/useReportKeyboardNav";
import useReportFocusRestore from "../hooks/useReportFocusRestore";
import { buildReportReturnState, navigateBackFromReport } from "../utils/reportNavigation";

function formatAmount(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function voucherValue(voucher) {
  return (voucher.lines || []).reduce(
    (sum, line) => Math.max(sum, Number(line.debit || 0), Number(line.credit || 0)),
    0
  );
}

export default function DayBookPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || monthStart);
  const [toDate, setToDate] = useState(searchParams.get("to") || today);
  const requestedCompanyId = searchParams.get("companyId") || "";
  const ledgerQuery = (searchParams.get("ledger") || "").trim().toLowerCase();
  const partyQuery = (searchParams.get("party") || "").trim().toLowerCase();

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setCompanyId((current) => current || requestedCompanyId || response.data[0]._id);
      }
    }
    loadCompanies();
  }, [requestedCompanyId]);

  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      const [voucherTypeResponse, voucherResponse] = await Promise.all([
        api.get(`/companies/${companyId}/voucher-types`),
        api.get(`/companies/${companyId}/vouchers`, {
          params: {
            from: fromDate,
            to: toDate,
            ...(voucherTypeId ? { type: voucherTypeId } : {}),
          },
        }),
      ]);
      setVoucherTypes(voucherTypeResponse.data);
      setVouchers(voucherResponse.data);
    }
    loadData();
  }, [companyId, voucherTypeId, fromDate, toDate]);

  const filteredVouchers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vouchers.filter((voucher) =>
      {
        const baseSearch = `${voucher.voucherName} ${voucher.number || ""} ${voucher.narration || ""}`.toLowerCase();
        const lineSearch = (voucher.lines || [])
          .map((line) => `${line.ledgerName || ""} ${line.name || ""}`)
          .join(" ")
          .toLowerCase();
        const customerSearch = `${voucher.customerSnapshot?.name || ""} ${voucher.customerSnapshot?.phone || ""}`.toLowerCase();
        const searchable = `${baseSearch} ${lineSearch} ${customerSearch}`;
        const matchesText = !query || searchable.includes(query);
        const matchesLedger =
          !ledgerQuery ||
          (voucher.lines || []).some((line) =>
            `${line.ledgerName || ""} ${line.name || ""}`.toLowerCase().includes(ledgerQuery),
          );
        const matchesParty =
          !partyQuery ||
          searchable.includes(partyQuery) ||
          (voucher.lines || []).some((line) =>
            `${line.ledgerName || ""} ${line.name || ""}`.toLowerCase().includes(partyQuery),
          );

        return matchesText && matchesLedger && matchesParty;
      }
    );
  }, [ledgerQuery, partyQuery, search, vouchers]);
  useReportFocusRestore(containerRef, [filteredVouchers, companyId, fromDate, toDate]);
  useReportKeyboardNav(containerRef, [filteredVouchers], {
    onExit: () => navigateBackFromReport(navigate, location),
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-3xl font-bold text-slate-900">Day Book</h1>
          <p className="mt-2 text-sm text-slate-500">
            View transactions period-wise, and narrow the day book by voucher type.
          </p>

          <div className="mt-6 grid gap-4 xl:grid-cols-5">
            <CompanyPicker
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
              label="Company"
            />
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Type</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                value={voucherTypeId}
                onChange={(event) => setVoucherTypeId(event.target.value)}
              >
                <option value="">All Voucher Types</option>
                {voucherTypes.map((voucherType) => (
                  <option key={voucherType._id} value={voucherType._id}>
                    {voucherType.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="relative">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Search</label>
              <Search className="pointer-events-none absolute left-3 top-[46px] h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm"
                placeholder="Search day book..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Voucher</th>
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Narration</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-600">
                      {voucher.date ? new Date(voucher.date).toLocaleDateString("en-GB") : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{voucher.voucherName}</td>
                    <td className="px-4 py-3 text-slate-700">{voucher.number || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{voucher.narration || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatAmount(voucherValue(voucher))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        data-report-nav="true"
                        data-focus-key={`daybook-${voucher._id}`}
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        onClick={() =>
                          navigate(buildAlterVoucherPath(companyId, voucher._id), {
                            state: buildReportReturnState(location, `daybook-${voucher._id}`),
                          })
                        }
                      >
                        Alter
                      </button>
                    </td>
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
