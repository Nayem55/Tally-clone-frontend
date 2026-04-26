import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  Landmark,
  Package,
} from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

const metricCards = [
  { key: "groupsCount", label: "Groups", icon: Boxes, accent: "bg-sky-50 text-sky-700" },
  { key: "ledgersCount", label: "Ledgers", icon: Landmark, accent: "bg-emerald-50 text-emerald-700" },
  { key: "itemsCount", label: "Stock Items", icon: Package, accent: "bg-amber-50 text-amber-700" },
  { key: "vouchersCount", label: "Vouchers", icon: FileText, accent: "bg-violet-50 text-violet-700" },
];

export default function DashboardPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) {
        setSelectedCompanyId((current) => current || response.data[0]._id);
      }
    }

    loadCompanies();
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      if (!selectedCompanyId) return;
      setLoading(true);
      try {
        const response = await api.get(
          `/companies/${selectedCompanyId}/reports/dashboard`
        );
        setDashboard(response.data);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company._id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-800 p-8 text-white shadow-2xl">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-100">
                <BarChart3 className="h-3.5 w-3.5" />
                Tally-style control room
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                Professional stock and accounts at a glance
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200">
                Review master counts, stock value, and the most recent item balances before you post vouchers or alter ledgers.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <CompanyPicker
                companies={companies}
                value={selectedCompanyId}
                onChange={setSelectedCompanyId}
                label="Working Company"
              />
              {selectedCompany && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Building2 className="h-4 w-4 text-blue-200" />
                    {selectedCompany.name}
                  </div>
                  <p className="mt-2 text-xs text-slate-200">
                    Financial year: {selectedCompany.financialYearFrom || "Not set"} to{" "}
                    {selectedCompany.financialYearTo || "Not set"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-500 shadow">
            Loading company dashboard...
          </div>
        )}

        {!loading && dashboard && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.key} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                    <div className={`inline-flex rounded-xl p-3 ${card.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-500">{card.label}</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {formatNumber(dashboard[card.key])}
                    </p>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">Inventory Position</h2>
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-700">Closing Stock Value</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-900">
                      {formatNumber(dashboard.stockValue)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-700">Closing Stock Quantity</p>
                    <p className="mt-2 text-3xl font-bold text-amber-900">
                      {formatNumber(dashboard.stockQuantity)}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Top Stock Items</h2>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Snapshot
                  </span>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Item</th>
                        <th className="px-4 py-3 font-medium">Group</th>
                        <th className="px-4 py-3 text-right font-medium">Closing Qty</th>
                        <th className="px-4 py-3 text-right font-medium">Closing Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.stockItems.map((item) => (
                        <tr key={item.itemId} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.itemName}
                            {item.alias && (
                              <span className="ml-2 text-xs font-normal text-slate-400">
                                {item.alias}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.groupName || "-"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatNumber(item.closingQty)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatNumber(item.closingValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {dashboard.stockItems.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No stock items found for this company yet.
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
