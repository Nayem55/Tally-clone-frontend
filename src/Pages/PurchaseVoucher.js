import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import api from "../api/api";
import VoucherWorkspace, {
  VoucherPanel,
  formatVoucherMoney,
  renderBalance,
} from "../Component/VoucherWorkspace";
import { resolveItemRateByDate } from "../utils/pricing";
import { getCompanyCurrency } from "../utils/currency";

const shortcutKeys = [
  { key: "F5", label: "Payment" },
  { key: "F6", label: "Receipt" },
  { key: "F7", label: "Journal" },
  { key: "F8", label: "Sales" },
  { key: "F9", label: "Purchase", active: true },
];

const emptyRow = {
  itemId: "",
  actualQty: "1",
  billedQty: "1",
  rate: "",
};

export default function PurchaseVoucher({ companyId }) {
  const [purchaseTypeId, setPurchaseTypeId] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseLedgers, setPurchaseLedgers] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [defaultPurchaseLedgerId, setDefaultPurchaseLedgerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    supplierInvoiceNo: "",
    supplierLedger: "",
    purchaseLedger: "",
    narration: "",
    rows: [emptyRow],
  });

  useEffect(() => {
    if (!companyId) return;
    async function loadMasters() {
      setLoading(true);
      try {
        const [
          voucherResponse,
          supplierResponse,
          itemResponse,
          defaultsResponse,
          companyResponse,
          balanceResponse,
          purchaseLedgerResponse,
        ] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Sundry Creditors`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/ledgers/defaults`),
          api.get("/companies"),
          api.get(`/companies/${companyId}/ledgers/with-balances`, { params: { to: form.date } }),
          api.get(`/companies/${companyId}/ledgers/by-group?names=Purchase Accounts`),
        ]);

        const purchaseType = voucherResponse.data.find(
          (row) => row.name.toLowerCase() === "purchase"
        );
        const defaultPurchaseId = defaultsResponse.data.purchaseLedger?._id || "";
        setPurchaseTypeId(purchaseType?._id || "");
        setSuppliers(supplierResponse.data);
        setItems(itemResponse.data);
        setCompanies(companyResponse.data);
        setAllLedgers(balanceResponse.data);
        setPurchaseLedgers(purchaseLedgerResponse.data);
        setDefaultPurchaseLedgerId(defaultPurchaseId);
        setForm((prev) => ({
          ...prev,
          purchaseLedger: prev.purchaseLedger || defaultPurchaseId,
        }));
      } catch (error) {
        alert("Failed to load purchase master data");
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, [companyId, form.date]);

  const company = companies.find((entry) => entry._id === companyId);
  const currency = getCompanyCurrency(company);
  const itemMap = useMemo(() => new Map(items.map((item) => [item._id, item])), [items]);
  const ledgerMap = useMemo(
    () => new Map(allLedgers.map((ledger) => [ledger._id, ledger])),
    [allLedgers]
  );
  const supplierLedger = ledgerMap.get(form.supplierLedger);
  const purchaseLedger = ledgerMap.get(form.purchaseLedger || defaultPurchaseLedgerId);

  const lineAmount = (row) =>
    Number((Number(row.billedQty || row.actualQty || 0) * Number(row.rate || 0)).toFixed(2));

  const recalculateRow = (row, voucherDate) => {
    if (!row.itemId) return row;
    const item = itemMap.get(row.itemId);
    return {
      ...row,
      rate: resolveItemRateByDate(item, null, voucherDate),
    };
  };

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      if (key === "itemId") {
        rows[index] = recalculateRow(rows[index], prev.date);
      }
      if (key === "actualQty" && !rows[index].billedQty) {
        rows[index].billedQty = value;
      }
      return { ...prev, rows };
    });
  };

  const addRow = () => setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow] }));
  const removeRow = (index) =>
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));

  const updateDate = (value) =>
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => recalculateRow(row, value)),
    }));

  const validRows = form.rows.filter((row) => row.itemId && Number(row.billedQty || row.actualQty || 0) > 0);
  const totalAmount = validRows.reduce((sum, row) => sum + lineAmount(row), 0);
  const totalQty = validRows.reduce((sum, row) => sum + Number(row.billedQty || row.actualQty || 0), 0);

  const resetForm = () =>
    setForm({
      number: "",
      date: new Date().toISOString().slice(0, 10),
      supplierInvoiceNo: "",
      supplierLedger: "",
      purchaseLedger: defaultPurchaseLedgerId,
      narration: "",
      rows: [emptyRow],
    });

  const save = async () => {
    if (!form.supplierLedger) return alert("Please select a supplier");
    if (!form.purchaseLedger && !defaultPurchaseLedgerId) return alert("Purchase ledger is missing");
    if (validRows.length === 0) return alert("Please add at least one item");

    const inventoryLines = validRows.map((row) => {
      const item = itemMap.get(row.itemId);
      return {
        itemId: item._id,
        itemName: item.name,
        qty: Number(row.billedQty || row.actualQty),
        rate: Number(row.rate),
        amount: lineAmount(row),
        productSnapshot: { name: item.name, prices: item.prices },
      };
    });

    await api.post(`/companies/${companyId}/vouchers`, {
      voucherTypeId: purchaseTypeId,
      number: form.number,
      date: form.date,
      narration: form.narration || "Purchase Voucher",
      lines: [
        { ledgerId: form.purchaseLedger || defaultPurchaseLedgerId, debit: totalAmount, credit: 0 },
        { ledgerId: form.supplierLedger, debit: 0, credit: totalAmount },
      ],
      inventoryLines,
    });
    alert("Purchase voucher saved");
    resetForm();
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading purchase voucher...</div>;
  }

  return (
    <VoucherWorkspace
      title="Purchase Voucher"
      subtitle="Capture supplier purchases with item-level quantities, rates, and voucher-wise balances."
      icon={FileSpreadsheet}
      iconTone="bg-blue-50 text-blue-600"
      onCancel={resetForm}
      onSave={save}
      onSaveDraft={() => alert("Draft support can be added next.")}
      summaryTag="Purchase Voucher"
      summaryItems={[
        { label: "Voucher No.", value: form.number || "-" },
        { label: "Date", value: form.date },
        { label: "Company", value: company?.name },
        { label: "Supplier", value: supplierLedger?.name || "-" },
        { label: "Purchase Ledger", value: purchaseLedger?.name || "-" },
      ]}
      amountSummaryItems={[
        {
          label: "Total Amount",
          value: formatVoucherMoney(totalAmount, currency.symbol),
          tone: "text-emerald-600",
          emphasis: true,
        },
      ]}
      shortcuts={shortcutKeys}
    >
      <VoucherPanel title="Voucher Header">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher No.</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Voucher Date</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.date}
              onChange={(event) => updateDate(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Supplier Invoice No.
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.supplierInvoiceNo}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplierInvoiceNo: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Company</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {company?.name || "-"}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Supplier</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.supplierLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplierLedger: event.target.value }))
              }
            >
              <option value="">Select supplier</option>
              {suppliers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {supplierLedger
                ? renderBalance(
                    supplierLedger.currentBalanceAbs,
                    supplierLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Purchase Ledger</label>
            <select
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              value={form.purchaseLedger}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, purchaseLedger: event.target.value }))
              }
            >
              <option value="">Select purchase ledger</option>
              {purchaseLedgers.map((ledger) => (
                <option key={ledger._id} value={ledger._id}>
                  {ledger.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Current Balance:{" "}
              {purchaseLedger
                ? renderBalance(
                    purchaseLedger.currentBalanceAbs,
                    purchaseLedger.currentBalanceSide,
                    currency.symbol
                  )
                : "-"}
            </p>
          </div>
        </div>
      </VoucherPanel>

      <VoucherPanel title="Item Details">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Item Name</th>
                <th className="px-4 py-3 font-medium">Actual</th>
                <th className="px-4 py-3 font-medium">Billed</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                  <td className="px-4 py-4">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.itemId}
                      onChange={(event) => updateRow(index, "itemId", event.target.value)}
                    >
                      <option value="">Select item</option>
                      {items.map((entry) => (
                        <option key={entry._id} value={entry._id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.actualQty}
                      onChange={(event) => updateRow(index, "actualQty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.billedQty}
                      onChange={(event) => updateRow(index, "billedQty", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 px-3 py-3"
                      value={row.rate}
                      onChange={(event) => updateRow(index, "rate", event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatVoucherMoney(lineAmount(row), currency.symbol)}
                  </td>
                  <td className="px-4 py-4 text-right">
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
              ))}
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

      <VoucherPanel title="Narration">
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          value={form.narration}
          onChange={(event) => setForm((prev) => ({ ...prev, narration: event.target.value }))}
          placeholder="Purchased from supplier as per bill."
        />
      </VoucherPanel>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-center">
            <p className="text-sm text-slate-500">Total Quantity</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalQty} pcs</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-center">
            <p className="text-sm text-emerald-700">Total Amount</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">
              {formatVoucherMoney(totalAmount, currency.symbol)}
            </p>
          </div>
        </div>
      </section>
    </VoucherWorkspace>
  );
}
