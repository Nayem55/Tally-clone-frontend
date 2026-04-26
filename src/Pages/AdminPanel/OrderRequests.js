import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiSearch,
  FiDownload,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiChevronDown,
} from "react-icons/fi";

/* ─────────────────────────── axios helper ─────────────────────────── */
const api = axios.create({
  baseURL: "http://175.29.181.245:15001",
  timeout: 50000,
});

/* ─────────────────────────── component ────────────────────────────── */
export default function OrderRequests() {
  /* ─────────── state ─────────── */
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* filters */
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");

  /* modal */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [pastSales, setPastSales] = useState({});
  const [loadingPast, setLoadingPast] = useState(false);
  const [modalExportDropdownOpen, setModalExportDropdownOpen] = useState(false);

  /* export dropdown */
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  /* ─────────── fetch ─────────── */
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/order-requests", {
        params: {
          status: statusFilter || undefined,
          month: selectedMonth || undefined,
        },
      });
      setRequests(data.data || []);
    } catch (err) {
      setError("Could not load requests");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedMonth]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  /* ─────────── derived list ─────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.trim().toLowerCase();
    return requests.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.outlet?.toLowerCase().includes(q) ||
        r.zone?.toLowerCase().includes(q),
    );
  }, [search, requests]);

  // Calculate total quantity for main table
  const totalQuantity = useMemo(() => {
    return filtered.reduce((total, req) => {
      return total + req.items.reduce((sum, item) => sum + item.qty, 0);
    }, 0);
  }, [filtered]);

  // Calculate total quantity for selected request in modal
  const modalTotalQuantity = useMemo(() => {
    return selectedRequest
      ? selectedRequest.items.reduce((sum, item) => sum + item.qty, 0)
      : 0;
  }, [selectedRequest]);

  /* ─────────── mark complete ─────────── */
  const markCompleted = async (id) => {
    if (!window.confirm("Mark this request as completed?")) return;
    try {
      await api.put(`/order-requests/${id}`, { status: "completed" });
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: "completed" } : r)),
      );
      if (selectedRequest?._id === id) {
        setSelectedRequest({ ...selectedRequest, status: "completed" });
      }
    } catch (err) {
      alert("Update failed");
      console.error(err);
    }
  };

  /* ─────────── open modal and fetch past sales ─────────── */
  const openModal = async (req) => {
    setSelectedRequest(req);
    setIsModalOpen(true);
    setLoadingPast(true);
    setPastSales({});
    try {
      const salesMap = {};
      await Promise.all(
        req.items.map(async (item) => {
          try {
            const { data } = await api.get(
              `/sales-reports/user/${req.userId}/barcode/${item.barcode}`,
            );
            salesMap[item.barcode] = data.totalQuantity || 0;
          } catch (err) {
            console.error(
              `Error fetching sales for barcode ${item.barcode}:`,
              err,
            );
            salesMap[item.barcode] = 0;
          }
        }),
      );
      setPastSales(salesMap);
    } catch (err) {
      console.error("Error fetching past sales:", err);
    } finally {
      setLoadingPast(false);
    }
  };

  /* ─────────── excel export (main) ─────────── */
  const exportToExcel = () => {
    const rows = filtered.flatMap((req) =>
      req.items.map((it) => ({
        Date: dayjs(req.date).format("YYYY-MM-DD"),
        Status: req.status,
        name: req.name,
        Outlet: req.outlet,
        Zone: req.zone,
        Barcode: it.barcode,
        Product: it.name,
        Quantity: it.qty,
      })),
    );
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      ...rows,
      {}, // Empty row for separation
      { Date: "Total Quantity:", Quantity: totalQuantity },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "PrimaryRequests");
    XLSX.writeFile(
      wb,
      `Primary_Requests_${selectedMonth}_${statusFilter || "all"}.xlsx`,
    );
    setExportDropdownOpen(false);
  };

  /* ─────────── pdf export (main) ─────────── */
  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Order Requests - ${selectedMonth}`, 14, 15);

    doc.setFontSize(10);
    doc.text(`Total Requests: ${filtered.length}`, 14, 25);
    doc.text(`Total Quantity: ${totalQuantity}`, 14, 30);

    const tableData = filtered.flatMap((req) =>
      req.items.map((it) => [
        dayjs(req.date).format("DD MMM YYYY"),
        req.name,
        req.outlet,
        req.zone,
        it.barcode,
        it.name,
        it.qty.toString(),
        req.status,
      ]),
    );

    autoTable(doc, {
      startY: 35,
      head: [
        [
          "Date",
          "Name",
          "Outlet",
          "Zone",
          "Barcode",
          "Product",
          "Qty",
          "Status",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229] },
      margin: { top: 35 },
    });

    doc.save(`Order_Requests_${selectedMonth}_${statusFilter || "all"}.pdf`);
    setExportDropdownOpen(false);
  };

  /* ─────────── modal excel export ─────────── */
  const exportModalToExcel = () => {
    if (!selectedRequest) return;
    const rows = selectedRequest.items.map((it) => ({
      Barcode: it.barcode,
      Product: it.name,
      "Requested Qty": it.qty,
      "Last 3 Months Sold": pastSales[it.barcode] || 0,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      ...rows,
      {}, // Empty row for separation
      { Barcode: "Total Quantity:", "Requested Qty": modalTotalQuantity },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "OrderDetails");
    XLSX.writeFile(
      wb,
      `Order_Details_${selectedRequest.name}_${dayjs(
        selectedRequest.date,
      ).format("YYYY-MM-DD")}.xlsx`,
    );
    setModalExportDropdownOpen(false);
  };

  /* ─────────── modal pdf export ─────────── */
  const exportModalToPDF = () => {
    if (!selectedRequest) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Order Details - ${selectedRequest.name}`, 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Date: ${dayjs(selectedRequest.date).format("DD MMM YYYY")}`,
      14,
      22,
    );
    doc.text(`Total Quantity: ${modalTotalQuantity}`, 14, 27);

    const tableData = selectedRequest.items.map((it) => [
      it.barcode,
      it.name,
      it.qty.toString(),
      (pastSales[it.barcode] || 0).toString(),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [["Barcode", "Product", "Requested Qty", "Last 3 Months Sold"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229] },
      margin: { top: 35 },
    });

    doc.save(
      `Order_Details_${selectedRequest.name}_${dayjs(
        selectedRequest.date,
      ).format("YYYY-MM-DD")}.pdf`,
    );
    setModalExportDropdownOpen(false);
  };

  /* ─────────── render ─────────── */
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 p-6 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Order Requests</h1>
            <p className="text-sm text-gray-600">
              Manage and track all primary order requests
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-2">
            <div className="bg-indigo-100 text-indigo-800 px-3 py-2 rounded-lg mr-2">
              <span className="font-semibold">Total Qty: {totalQuantity}</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
                disabled={filtered.length === 0}
              >
                <FiDownload className="text-lg" />
                <span>Export</span>
                <FiChevronDown />
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={exportToExcel}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export to Excel
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export to PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="">All Status</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, outlet or zone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500">
            <h3 className="text-sm font-medium text-gray-500">
              Total Requests
            </h3>
            <p className="text-2xl font-semibold text-gray-800">
              {requests.length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-500">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-semibold text-gray-800">
              {requests.filter((r) => r.status === "pending").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="text-2xl font-semibold text-gray-800">
              {requests.filter((r) => r.status === "completed").length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-60">
              <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchRequests}
                className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-600">
                No requests found matching your criteria
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setSelectedMonth(dayjs().format("YYYY-MM"));
                }}
                className="mt-2 text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Requested By
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Outlet
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Zone
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Total Qty
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Lines
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((req) => (
                    <tr
                      key={req._id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openModal(req)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {dayjs(req.date).format("DD MMM YYYY")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {req.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {req.outlet}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {req.zone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {req.items.reduce((s, i) => s + i.qty, 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {req.items.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {req.status === "completed" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <FiCheckCircle className="mr-1" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <FiClock className="mr-1" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {req.status === "pending" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markCompleted(req._id);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  Order Details - {selectedRequest.name} -{" "}
                  {dayjs(selectedRequest.date).format("DD MMM YYYY")}
                </h2>
                <p className="text-sm text-gray-600">
                  Total Quantity: {modalTotalQuantity}
                </p>
              </div>
              <div className="mt-4 md:mt-0 relative">
                <button
                  onClick={() =>
                    setModalExportDropdownOpen(!modalExportDropdownOpen)
                  }
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
                >
                  <FiDownload className="text-lg" />
                  <span>Export</span>
                  <FiChevronDown />
                </button>
                {modalExportDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <button
                      onClick={exportModalToExcel}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export to Excel
                    </button>
                    <button
                      onClick={exportModalToPDF}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export to PDF
                    </button>
                  </div>
                )}
              </div>
            </div>

            {loadingPast ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Barcode
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested Qty
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last 3 Months Sold
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedRequest.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {it.barcode}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {it.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                          {it.qty}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 text-right">
                          {pastSales[it.barcode] || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
