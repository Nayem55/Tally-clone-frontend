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
import useAutoVoucherNumber from "../hooks/useAutoVoucherNumber";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";
import { formatDateForInput } from "../utils/voucherDates";
import {
  buildSalesFamilyPrintData,
  previewVoucherDocument,
  printVoucherDocument,
} from "../utils/printVoucher";

const emptyRow = {
  itemId: "",
  actualQty: "1",
  billedQty: "1",
  rate: "",
  discountPercent: "",
};

export default function SalesVoucher({ companyId, editVoucherId = "" }) {
  const isEditMode = Boolean(editVoucherId);
  const [salesTypeId, setSalesTypeId] = useState("");
  const [salesLedgerId, setSalesLedgerId] = useState("");
  const [partyLedgers, setPartyLedgers] = useState([]);
  const [salesLedgers, setSalesLedgers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [priceLevels, setPriceLevels] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const companyName =
    companies.find((entry) => entry._id === companyId)?.name || "";
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
  const { suggestedNumber, refreshSuggestedNumber } = useAutoVoucherNumber({
    companyId,
    voucherTypeId: salesTypeId,
    companyName,
    voucherLabel: "Sales",
    disabled: isEditMode,
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
    let alive = true;

    async function loadVoucherForEdit() {
      if (!companyId || !editVoucherId || items.length === 0) return;
      const response = await api.get(`/companies/${companyId}/vouchers/${editVoucherId}`);
      const voucher = response.data;
      const debitLine = (voucher.lines || []).find((line) => Number(line.debit || 0) > 0);
      const creditLine = (voucher.lines || []).find((line) => Number(line.credit || 0) > 0);

      if (!alive) return;
      setForm({
        number: voucher.number || "",
        date: voucher.date ? String(voucher.date).slice(0, 10) : formatDateForInput(new Date()),
        partyLedger: String(debitLine?.ledgerId || ""),
        salesLedger: String(creditLine?.ledgerId || salesLedgerId || ""),
        priceLevelId: "",
        narration: voucher.narration || "",
        discountAmount: "",
        additionalCharges: "",
        rows:
          (voucher.inventoryLines || []).map((line) => ({
            itemId: String(line.itemId || ""),
            actualQty: String(line.qty || line.billedQty || 1),
            billedQty: String(line.billedQty || line.qty || 1),
            rate: Number(line.rate || 0),
            discountPercent: "",
          })) || [emptyRow],
      });
    }

    loadVoucherForEdit();
    return () => {
      alive = false;
    };
  }, [companyId, editVoucherId, items.length, salesLedgerId]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => recalculateRow(row, prev.date, activePriceLevelId)),
    }));
  }, [form.partyLedger, form.priceLevelId, items.length]);

  useEffect(() => {
    if (!suggestedNumber || isEditMode) return;
    setForm((prev) => (prev.number ? prev : { ...prev, number: suggestedNumber }));
  }, [suggestedNumber, isEditMode]);

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

  const printData = useMemo(
    () =>
      buildSalesFamilyPrintData({
        company,
        voucherTypeLabel: "Sales",
        voucherSubtitle: "Sales Voucher Print Preview",
        voucherNumber: form.number,
        voucherDate: form.date,
        partyLabel: "Party Details",
        partyName: partyLedger?.name || "",
        partyMeta: [
          `Price Level: ${
            priceLevels.find((level) => level._id === activePriceLevelId)?.name ||
            priceLevels.find((level) => level._id === activePriceLevelId)?.code ||
            "Not Applicable"
          }`,
        ],
        accountLabel: "Sales Ledger",
        accountName: salesLedger?.name || "",
        rows: validRows.map((row) => {
          const item = itemMap.get(row.itemId);
          const billedQty = Number(row.billedQty || row.actualQty || 0);
          const actualQty = Number(row.actualQty || billedQty);
          return {
            name: item?.name || "-",
            subtext:
              actualQty !== billedQty
                ? `Actual Qty: ${actualQty} | Billed Qty: ${billedQty}`
                : "",
            qty: `${billedQty}`,
            rate: formatVoucherMoney(row.rate, currency.symbol),
            discount: Number(row.discountPercent || 0)
              ? `${Number(row.discountPercent || 0).toFixed(2)}%`
              : "",
            amount: formatVoucherMoney(lineAmount(row), currency.symbol),
          };
        }),
        totals: [
          { label: "Subtotal", value: formatVoucherMoney(subtotal, currency.symbol) },
          {
            label: "Discount",
            value: formatVoucherMoney(totalDiscount + invoiceDiscount, currency.symbol),
          },
          {
            label: "Additional Charges",
            value: formatVoucherMoney(additionalCharges, currency.symbol),
          },
          {
            label: "Net Payable",
            value: formatVoucherMoney(totalAmount, currency.symbol),
            emphasis: true,
          },
        ],
        narration: form.narration,
        currencySymbol: `${currency.code || ""} ${currency.symbol || ""}`.trim(),
      }),
    [
      company,
      form.number,
      form.date,
      form.narration,
      partyLedger,
      priceLevels,
      activePriceLevelId,
      salesLedger,
      validRows,
      itemMap,
      currency.symbol,
      currency.code,
      subtotal,
      totalDiscount,
      invoiceDiscount,
      additionalCharges,
      totalAmount,
    ]
  );

  const resetForm = (nextNumber = suggestedNumber) =>
    setForm({
      number: nextNumber || "",
      date: formatDateForInput(new Date()),
      partyLedger: "",
      salesLedger: salesLedgerId,
      priceLevelId: "",
      narration: "",
      discountAmount: "",
      additionalCharges: "",
      rows: [emptyRow],
    });

  const save = async (options = {}) => {
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

    const payload = {
      voucherTypeId: salesTypeId,
      voucherName: "Sales",
      number: form.number,
      date: form.date,
      narration: form.narration || "Sales Voucher",
      lines: [
        { ledgerId: form.partyLedger, debit: totalAmount, credit: 0 },
        { ledgerId: form.salesLedger || salesLedgerId, debit: 0, credit: totalAmount },
      ],
      inventoryLines,
    };

    if (isEditMode) {
      await api.put(`/companies/${companyId}/vouchers/${editVoucherId}`, payload);
    } else {
      await api.post(`/companies/${companyId}/vouchers`, payload);
    }

    if (options.printAfterSave) {
      await options.printVoucher?.();
    } else {
      alert(isEditMode ? "Sales voucher updated" : "Sales voucher saved");
    }
    if (!isEditMode) {
      const nextNumber = await refreshSuggestedNumber();
      resetForm(nextNumber);
    }
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
      onPreviewPrint={() => previewVoucherDocument(printData)}
      onPrintAfterSave={() => printVoucherDocument(printData)}
      >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              data-vnav="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <TallyDateInput
              data-voucher-date="true"
              className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
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
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.actualQty}
                        onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.billedQty}
                        onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <input
                        type="number"
                        data-vnav="true"
                        className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
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
                className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
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
            className="w-full border border-[#c8d2de] bg-[#EEF5FF] px-2 py-1.5 text-[14px] outline-none focus:border-[#3f83f8]"
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
          className="min-h-28 w-full border border-[#c8d2de] bg-[#EEF5FF] px-3 py-2 text-[14px] outline-none focus:border-[#3f83f8]"
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
