import { useEffect, useMemo, useState } from "react";
import { Calendar, FileText, Trash2 } from "lucide-react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { resolveItemRateByDate } from "../utils/pricing";

function getVoucherMode(voucherName) {
  const key = voucherName.toLowerCase();
  if (key === "stock journal") return "transfer";
  if (key === "delivery note") return "outward";
  return "inward";
}

export default function InventoryVoucherPage({ voucherName }) {
  const mode = getVoucherMode(voucherName);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [voucherTypeId, setVoucherTypeId] = useState("");
  const [items, setItems] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    narration: "",
    rows: [
      {
        itemId: "",
        qty: "1",
        rate: "",
        amount: "",
        godownId: "",
        toGodownId: "",
      },
    ],
  });

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
    async function loadData() {
      if (!companyId) return;
      setLoading(true);
      try {
        const [voucherTypeResponse, itemsResponse, godownsResponse] = await Promise.all([
          api.get(`/companies/${companyId}/voucher-types`),
          api.get(`/companies/${companyId}/items`),
          api.get(`/companies/${companyId}/godowns`),
        ]);
        const match = voucherTypeResponse.data.find(
          (row) => row.name.toLowerCase() === voucherName.toLowerCase()
        );
        setVoucherTypeId(match?._id || "");
        setItems(itemsResponse.data);
        setGodowns(godownsResponse.data);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [companyId, voucherName]);

  const validRows = useMemo(
    () => form.rows.filter((row) => row.itemId && Number(row.qty || 0) > 0),
    [form.rows]
  );

  const updateRow = (index, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };

      if (key === "itemId" && value) {
        const item = items.find((entry) => entry._id === value);
        const rate = resolveItemRateByDate(item, null, prev.date);
        rows[index].rate = rate;
      }

      rows[index].amount = (
        Number(rows[index].qty || 0) * Number(rows[index].rate || 0)
      ).toFixed(2);

      if (key === "itemId" && value && index === rows.length - 1) {
        rows.push({
          itemId: "",
          qty: "1",
          rate: "",
          amount: "",
          godownId: "",
          toGodownId: "",
        });
      }

      return { ...prev, rows };
    });
  };

  const updateVoucherDate = (value) => {
    setForm((prev) => ({
      ...prev,
      date: value,
      rows: prev.rows.map((row) => {
        if (!row.itemId) return row;
        const item = items.find((entry) => entry._id === row.itemId);
        const rate = resolveItemRateByDate(item, null, value);
        return {
          ...row,
          rate,
          amount: (Number(row.qty || 0) * Number(rate || 0)).toFixed(2),
        };
      }),
    }));
  };

  const removeRow = (index) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  async function save() {
    if (!voucherTypeId) return alert("Voucher type is missing");
    if (validRows.length === 0) return alert("Please add at least one stock line");

    const inventoryLines = validRows.map((row) => {
      const item = items.find((entry) => entry._id === row.itemId);
      const sourceGodown = godowns.find((entry) => entry._id === row.godownId);
      const targetGodown = godowns.find((entry) => entry._id === row.toGodownId);
      return {
        itemId: row.itemId,
        itemName: item?.name || "",
        qty: Number(row.qty || 0),
        rate: Number(row.rate || 0),
        amount: Number(row.amount || 0),
        godownId: row.godownId || "",
        godownName: sourceGodown?.name || "",
        toGodownId: row.toGodownId || "",
        toGodownName: targetGodown?.name || "",
      };
    });

    const body = {
      voucherTypeId,
      voucherName,
      number: form.number,
      date: form.date,
      narration: form.narration || voucherName,
      lines: [],
      inventoryLines,
    };

    try {
      await api.post(`/companies/${companyId}/vouchers`, body);
      alert(`${voucherName} saved successfully`);
      setForm({
        number: "",
        date: new Date().toISOString().slice(0, 10),
        narration: "",
        rows: [
          {
            itemId: "",
            qty: "1",
            rate: "",
            amount: "",
            godownId: "",
            toGodownId: "",
          },
        ],
      });
    } catch (error) {
      alert(error.response?.data?.message || `Unable to save ${voucherName}`);
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading {voucherName}...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
                <FileText className="h-8 w-8 text-blue-600" />
                {voucherName}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Maintain inventory movement with item, quantity, rate, and godown details.
              </p>
            </div>
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Voucher No"
              value={form.number}
              onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))}
            />
            <div className="relative">
              <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm"
                value={form.date}
                onChange={(event) => updateVoucherDate(event.target.value)}
              />
            </div>
            <textarea
              rows="1"
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Narration"
              value={form.narration}
              onChange={(event) => setForm((current) => ({ ...current, narration: event.target.value }))}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">Godown</th>
                  {mode === "transfer" ? (
                    <th className="px-4 py-3 font-medium">To Godown</th>
                  ) : null}
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {form.rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={row.itemId}
                        onChange={(event) => updateRow(index, "itemId", event.target.value)}
                      >
                        <option value="">Select item</option>
                        {items.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2"
                        value={row.qty}
                        onChange={(event) => updateRow(index, "qty", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                        value={row.rate}
                        onChange={(event) => updateRow(index, "rate", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={row.godownId}
                        onChange={(event) => updateRow(index, "godownId", event.target.value)}
                      >
                        <option value="">Select godown</option>
                        {godowns.map((godown) => (
                          <option key={godown._id} value={godown._id}>
                            {godown.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {mode === "transfer" ? (
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                          value={row.toGodownId}
                          onChange={(event) => updateRow(index, "toGodownId", event.target.value)}
                        >
                          <option value="">Select target godown</option>
                          {godowns.map((godown) => (
                            <option key={godown._id} value={godown._id}>
                              {godown.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {Number(row.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.itemId && form.rows.length > 1 ? (
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
        </section>

        <section className="flex justify-end">
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
            onClick={save}
          >
            Save {voucherName}
          </button>
        </section>
      </div>
    </div>
  );
}
