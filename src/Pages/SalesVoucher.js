import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import SearchableSelect from "../Component/SearchableSelect";
import TallyDateInput from "../Component/TallyDateInput";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";

const emptyRow = {
  itemId: "",
  actualQty: "1",
  billedQty: "1",
  rate: "",
  discountPercent: "",
};

export default function SalesVoucher({ companyId }) {
  const [salesTypeId, setSalesTypeId] = useState("");
  const [salesLedgerId, setSalesLedgerId] = useState("");
  const [partyLedgers, setPartyLedgers] = useState([]);
  const [salesLedgers, setSalesLedgers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    number: "",
    date: formatDateForInput(new Date()),
    partyLedger: "",
    salesLedger: "",
    priceLevelId: "",
    narration: "",
    discountAmount: "",
    additionalCharges: "",
    rows: [emptyRow],
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      setLoading(true);
      try {
        const [
          voucherResponse,
          debtorResponse,
          itemResponse,
          defaultsResponse,
          companyResponse,
          balanceResponse,
          salesLedgerResponse,
          priceLevelResponse,
        ] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Debtors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
          api.get("/companies"),
          api.get(`/companies/${companyId}/ledgers/with-balances`, { params: { to: form.date } }),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sales Accounts`),
          api.get(`/companies/${companyId}/price-levels`),
        ]);

        const salesType = voucherResponse.data.find((row) => row.name.toLowerCase() === "sales");
        const defaultSalesId = defaultsResponse.data.salesLedger?._id || "";
        setSalesTypeId(salesType?._id || "");
        setPartyLedgers(debtorResponse.data);
        setItems(itemResponse.data);
        setCompanies(companyResponse.data);
        setAllLedgers(balanceResponse.data);
        setSalesLedgers(salesLedgerResponse.data);
        setPriceLevels(priceLevelResponse.data);
        setSalesLedgerId(defaultSalesId);
        setForm((prev) => ({
          ...prev,
          salesLedger: prev.salesLedger || defaultSalesId,
        }));
      } catch (error) {
        alert("Failed to load sales master data");
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, [companyId, form.date]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => recalculateRow(row, prev.date, activePriceLevelId)),
    }));
  }, [form.partyLedger, form.priceLevelId, items.length]);

  const company = companies.find((entry) => entry._id === companyId);
  const currency = getCompanyCurrency(company);
  const ledgerMap = useMemo(
    () => new Map(allLedgers.map((ledger) => [ledger._id, ledger])),
    [allLedgers]
  );
  const itemMap = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const partyLedger = ledgerMap.get(form.partyLedger) || partyLedgers.find((row) => row._id === form.partyLedger);
  const activePriceLevelId = form.priceLevelId || partyLedger?.priceLevelId || "";
  const salesLedger = ledgerMap.get(form.salesLedger || salesLedgerId);
  const partyOptions = useMemo(
    () => partyLedgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [partyLedgers]
  );
  const salesLedgerOptions = useMemo(
    () => salesLedgers.map((ledger) => ({ value: ledger._id, label: ledger.name })),
    [salesLedgers]
  );
  const priceLevelOptions = useMemo(
    () => priceLevels.map((level) => ({ value: level._id, label: level.name || level.code })),
    [priceLevels]
  );
  const itemOptions = useMemo(
    () => items.map((item) => ({ value: item._id, label: item.name })),
    [items]
  );

  const lineAmount = (row) => {
    const qty = Number(row.billedQty || row.actualQty || 0);
    const rate = Number(row.rate || 0);
    const gross = qty * rate;
    const discount = (gross * Number(row.discountPercent || 0)) / 100;
    return Number((gross - discount).toFixed(2));
  };

  const recalculateRow = (row, voucherDate, priceLevelId) => {
    if (!row.itemId) return row;
    const item = itemMap.get(row.itemId);
    const rate = resolveItemRateByDate(item, priceLevelId || null, voucherDate);
    return { ...row, rate };
  };

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        rows[index] = recalculateRow(rows[index], prev.date, activePriceLevelId);
      }
      if (key === "actualQty" && !rows[index].billedQty) {
        rows[index].billedQty = value;
      }
      return { ...prev, rows };
    });
  };

  const addRow = () => {
    setForm((prev) => ({
      ...prev,
      rows: [...prev.rows, emptyRow],
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const updateDate = (value) => {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => recalculateRow(row, value, activePriceLevelId)),
    }));
  };

  const updatePriceLevel = (value) => {
    setForm((prev) => ({
      ...prev,
      priceLevelId: value,
      rows: prev.rows.map((row) => recalculateRow(row, prev.date, value || partyLedger?.priceLevelId)),
    }));
  };

  const validRows = form.rows.filter((row) => row.itemId && Number(row.billedQty || row.actualQty || 0) > 0);
  const subtotal = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalDiscount = validRows.reduce((sum, row) => {
    const qty = Number(row.billedQty || row.actualQty || 0);
    const rate = Number(row.rate || 0);
    return sum + (qty * rate * Number(row.discountPercent || 0)) / 100;
  }, 0);
  const invoiceDiscount = Number(form.discountAmount || 0);
  const additionalCharges = Number(form.additionalCharges || 0);
  const totalAmount = Number((subtotal - invoiceDiscount + additionalCharges).toFixed(2));
  const totalQty = validRows.reduce((sum, row) => sum + Number(row.billedQty || row.actualQty || 0), 0);

  const resetForm = () =>
    setForm({
      number: "",
      date: formatDateForInput(new Date()),
      partyLedger: "",
      salesLedger: salesLedgerId,
      priceLevelId: "",
      narration: "",
      discountAmount: "",
      additionalCharges: "",
      rows: [emptyRow],
    });

  const save = async () => {
    if (!form.partyLedger) return alert("Please select a party account");
    if (!form.salesLedger && !salesLedgerId) return alert("Sales ledger is missing for this company");
    if (validRows.length === 0) return alert("Please add at least one item");

    const inventoryLines = validRows.map((row) => {
      const item = itemMap.get(row.itemId);
      return {
        itemId: item._id,
        itemName: item.name,
        qty: Number(row.billedQty || row.actualQty),
        rate: Number(row.rate),
        discount: Number(row.discountPercent || 0),
        amount: lineAmount(row),
        productSnapshot: { name: item.name, prices: item.prices },
      };
    });

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: salesTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration || "Sales Voucher",
      lines: [
        { ledgerId: form.partyLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.salesLedger || salesLedgerId, debit: 0, credit: totalAmount },
      ],
      inventoryLines,
    });

    alert("Sales voucher saved");
    resetForm();
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading sales voucher...</div>;
  }

  return (
    <VoucherWorkspace
      title="Sales Voucher"
      subtitle="Create item-wise sales invoices with party balances, price levels, and dated rates."
      icon={FileText}
      iconTone="bg-emerald-50 text-emerald-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      onAddRow={addRow}
      summaryTag="Sales Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Party A/c", value: partyLedger?.name || "-" },
        { label: "Sales Ledger", value: salesLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        { label: "Subtotal", value: formatVoucherMoney(subtotal, currency.symbol) },
        { label: "Discount", value: formatVoucherMoney(totalDiscount + invoiceDiscount, currency.symbol) },
        { label: "Additional Charges", value: formatVoucherMoney(additionalCharges, currency.symbol) },
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.date}
              onChange={updateDate}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Price Level</label>
            <SearchableSelect
              options={[{ value: "", label: "Party Default / Not Applicable" }, ...priceLevelOptions]}
              value={form.priceLevelId}
              onChange={updatePriceLevel}
              placeholder="Search price level"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Party A/c Name</label>
            <SearchableSelect
              options={partyOptions}
              value={form.partyLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, partyLedger: newValue }))}
              placeholder="Search customer"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {partyLedger
                ? renderBalance(
                    partyLedger.currentBalanceAbs,
                    partyLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Sales Ledger</label>
            <SearchableSelect
              options={salesLedgerOptions}
              value={form.salesLedger}
              onChange={(newValue) => setForm((prev) => ({ ...prev, salesLedger: newValue }))}
              placeholder="Search sales ledger"
            />
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {salesLedger
                ? renderBalance(
                    salesLedger.currentBalanceAbs,
                    salesLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Item Details">
        <div className="overflow-visible rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm table-head">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Item Name</th>
                <th className="px-4 py-3 font-medium">Actual</th>
                <th className="px-4 py-3 font-medium">Billed</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 font-medium">Disc %</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => {
                const item = itemMap.get(row.itemId);
                return (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-4 align-top text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 align-top">
                      <SearchableSelect
                        options={itemOptions}
                        value={row.itemId}
                        onChange={(newValue) => updateRow(index, "itemId", newValue)}
                        placeholder="Search item"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Stock: {Number(item?.openingQty || item?.currentQty || 0).toLocaleString("en-IN")} pcs
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.actualQty}
                        onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.billedQty}
                        onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.discountPercent}
                        onChange={(event) => updateRow(index, "discountPercent", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top text-right font-semibold text-slate-900">
                      {formatVoucherMoney(lineAmount(row), currency.symbol)}
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      {form.rows.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Add New Item
        </button>
      </VoucherPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <VoucherPanel title="Discount">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Discount Type</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Invoice Discount
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Amount</label>
              <input
                type="number"
                data-vnav="true"
                className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                value={form.discountAmount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, discountAmount: event.target.value }))
                }
              />
            </div>
          </div>
        </VoucherPanel>
        <VoucherPanel title="Additional Charges">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Amount</label>
          <input
            type="number"
            data-vnav="true"
            className="w-full border border-[#c8d2de] bg-[#fff7cf] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
            value={form.additionalCharges}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, additionalCharges: event.target.value }))
            }
          />
        </VoucherPanel>
      </div>

      <VoucherPanel title="Narration">
        <textarea
          data-vnav="true"
          className="min-h-28 w-full border border-[#c8d2de] bg-[#fffdf4] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Sold to customer as per invoice."
        />
      </VoucherPanel>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-center">
            <p className="text-sm text-slate-500">Total Quantity</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalQty} pcs</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-5 text-center">
            <p className="text-sm text-rose-600">Total Discount</p>
            <p className="mt-2 text-3xl font-bold text-rose-600">
              {formatVoucherMoney(totalDiscount + invoiceDiscount, currency.symbol)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-center">
            <p className="text-sm text-emerald-700">Total Amount Payable</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">
              {formatVoucherMoney(totalAmount, currency.symbol)}
            </p>
          </div>
        </div>
      </section>
    </VoucherWorkspace>
  );
}
