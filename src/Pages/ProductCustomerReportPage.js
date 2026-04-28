import { useEffect, useState } from "react";
import api from "../api/api";
import CompanyPicker from "../Component/CompanyPicker";
import { formatCurrencyAmount } from "../utils/currency";

export default function ProductCustomerReportPage() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function loadCompanies() {
      const response = await api.get("/companies");
      setCompanies(response.data);
      if (response.data.length > 0) setCompanyId((current) => current || response.data[0]._id);
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    async function loadItemsAndReport() {
      if (!companyId) return;
      const [itemResponse, reportResponse] = await Promise.all([
        api.get(`/companies/${companyId}/items`),
        api.get(`/companies/${companyId}/reports/customer-behaviour/product-wise`, {
          params: itemId ? { itemId } : {},
        }),
      ]);
      setItems(itemResponse.data);
      setRows(reportResponse.data);
    }
    loadItemsAndReport();
  }, [companyId, itemId]);

  const selectedCompany = companies.find((company) => company._id === companyId);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-4 md:grid-cols-2">
            <CompanyPicker companies={companies} value={companyId} onChange={setCompanyId} />
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Filter Product</label>
              <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">All Products</option>
                {items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {rows.map((product) => (
          <section key={product.itemId} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{product.itemName}</h2>
                <p className="mt-1 text-sm text-slate-500">{product.groupName || "-"} / {product.stockCategoryName || "-"}</p>
              </div>
              <div className="text-right text-sm">
                <p>Qty Sold: <span className="font-semibold">{Number(product.totalQty || 0).toLocaleString("en-IN")}</span></p>
                <p>Total Sales: <span className="font-semibold">{formatCurrencyAmount(product.totalAmount, selectedCompany)}</span></p>
                <p>Unique Customers: <span className="font-semibold">{product.uniqueCustomers}</span></p>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Purchase Date</th>
                    <th className="px-4 py-3 font-medium">Voucher No.</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {product.customers.map((row, index) => (
                    <tr key={`${product.itemId}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.customerName}</td>
                      <td className="px-4 py-3">{row.phone}</td>
                      <td className="px-4 py-3">{new Date(row.purchaseDate).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">{row.voucherNo || "-"}</td>
                      <td className="px-4 py-3">{row.qty}</td>
                      <td className="px-4 py-3">{formatCurrencyAmount(row.amount, selectedCompany)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
