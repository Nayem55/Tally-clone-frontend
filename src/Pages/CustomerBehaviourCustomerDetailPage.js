import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Gift,
  Phone,
  ShoppingBag,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/api";
import { formatCurrencyAmount } from "../utils/currency";

function formatPoints(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CustomerBehaviourCustomerDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("companyId") || "";
  const phone = searchParams.get("phone") || "";
  const [detail, setDetail] = useState({ customer: null, vouchers: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDetail() {
      if (!companyId || !phone) return;
      setLoading(true);
      try {
        const response = await api.get(
          `/companies/${companyId}/reports/customer-behaviour/customer-detail`,
          {
            params: { phone },
          },
        );
        setDetail(response.data);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [companyId, phone]);

  const customer = detail.customer;
  const vouchers = detail.vouchers || [];

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </section>

        {loading ? (
          <section className="rounded-[28px] bg-white px-6 py-20 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
            Loading customer lifetime history...
          </section>
        ) : customer ? (
          <>
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="rounded-[24px] bg-slate-950 p-5 text-white">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-200">
                      Customer Profile
                    </p>
                    <h1 className="mt-2 text-3xl font-bold">
                      {customer.name || "Unnamed Customer"}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-4 w-4" />
                        {customer.phone || "-"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        First purchase {formatDate(customer.firstPurchaseAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        Last purchase {formatDate(customer.lastPurchaseAt)}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm text-slate-400">
                      {customer.address || "No address saved yet for this customer."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-slate-300">
                      Primary company
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {customer.companyName || "Universal customer"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Trophy className="h-4 w-4 text-emerald-600" />
                    Remaining reward points
                  </p>
                  <p className="mt-3 text-3xl font-bold text-emerald-700">
                    {formatPoints(customer.rewardPoints)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Available right now</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Star className="h-4 w-4 text-amber-500" />
                    Reward earned
                  </p>
                  <p className="mt-3 text-3xl font-bold text-amber-700">
                    {formatPoints(customer.rewardEarned)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Universal lifetime earned</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Gift className="h-4 w-4 text-rose-500" />
                    Redeemed amount
                  </p>
                  <p className="mt-3 text-3xl font-bold text-rose-700">
                    {formatPoints(customer.rewardRedeemed)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Total points redeemed till now</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                    <ShoppingBag className="h-4 w-4 text-blue-600" />
                    Lifetime spending
                  </p>
                  <p className="mt-3 text-2xl font-bold text-slate-900">
                    {formatCurrencyAmount(customer.totalSpent)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {customer.totalOrders || 0} orders · avg{" "}
                    {formatCurrencyAmount(customer.averageOrderValue)}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Customer snapshot
                </h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      Customer name
                    </span>
                    <span className="font-medium text-slate-900">
                      {customer.name || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <Phone className="h-4 w-4 text-slate-400" />
                      Mobile number
                    </span>
                    <span className="font-medium text-slate-900">
                      {customer.phone || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <ShoppingBag className="h-4 w-4 text-slate-400" />
                      Total orders
                    </span>
                    <span className="font-medium text-slate-900">
                      {customer.totalOrders || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      First purchase
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatDate(customer.firstPurchaseAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-500">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      Last purchase
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatDate(customer.lastPurchaseAt)}
                    </span>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Lifetime purchase history
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Full POS history for this customer across all companies.
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {vouchers.length ? (
                    vouchers.map((row) => (
                      <div
                        key={row.voucherId}
                        className="rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                              {row.number || "POS Voucher"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {row.companyName || "Universal company"} · {formatDate(row.date)}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[300px]">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-slate-400">Amount</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {formatCurrencyAmount(row.totalAmount)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-amber-50 px-3 py-2">
                              <p className="text-amber-600">Earned</p>
                              <p className="mt-1 font-semibold text-amber-700">
                                {formatPoints(row.rewardEarned)} pts
                              </p>
                            </div>
                            <div className="rounded-xl bg-rose-50 px-3 py-2">
                              <p className="text-rose-600">Redeemed</p>
                              <p className="mt-1 font-semibold text-rose-700">
                                {formatPoints(row.rewardRedeemed)} pts
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      No lifetime purchase found for this customer.
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        ) : (
          <section className="rounded-[28px] bg-white px-6 py-20 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
            Customer not found.
          </section>
        )}
      </div>
    </div>
  );
}
