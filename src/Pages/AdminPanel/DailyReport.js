import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";

const DailyReport = () => {
  const { userId } = useParams();
  const { search } = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const queryParams = new URLSearchParams(search);
  const initialMonth = queryParams.get("month") || dayjs().format("YYYY-MM");
  const initialStartDate = queryParams.get("startDate") || "";
  const initialEndDate = queryParams.get("endDate") || "";

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const [filterMonth, setFilterMonth] = useState(initialMonth);
  const [filterStartDate, setFilterStartDate] = useState(initialStartDate);
  const [filterEndDate, setFilterEndDate] = useState(initialEndDate);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState([]);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("pos-user"));
        if (storedUser) {
          setUser(storedUser);
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        toast.error("Failed to load user details");
      }
    };

    const fetchViewedUser = async () => {
      try {
        setUserLoading(true);
        const response = await axios.get(
          `http://175.29.181.245:15001/getUser/${userId}`,
        );
        setViewedUser(response.data);
      } catch (error) {
        console.error("Error fetching viewed user details:", error);
        toast.error("Failed to load viewed user details");
      } finally {
        setUserLoading(false);
      }
    };

    fetchUserDetails();
    fetchViewedUser();
  }, [userId]);

  useEffect(() => {
    fetchDailyReports();
  }, [userId, filterMonth, filterStartDate, filterEndDate]);

  const fetchDailyReports = async () => {
    try {
      setLoading(true);
      let params = {};

      if (filterStartDate && filterEndDate) {
        params.startDate = filterStartDate;
        params.endDate = filterEndDate;
      } else {
        params.month = filterMonth;
      }

      const response = await axios.get(
        `http://175.29.181.245:15001/sales-reports/${userId}`,
        { params },
      );
      setReports(
        Array.isArray(response.data) ? response.data : [response.data],
      );
    } catch (error) {
      console.error("Error fetching daily reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleEditReport = (report) => {
    const productsWithOriginalValues = report.products.map((product) => ({
      ...product,
      originalQuantity: product.quantity,
      originalDP: product.quantity ? product.dp / product.quantity : 0,
      originalTP: product.quantity ? product.tp / product.quantity : 0,
      originalMRP: product.quantity ? product.mrp / product.quantity : 0,
    }));

    setEditingReport({
      ...report,
      products: productsWithOriginalValues,
      sale_date: dayjs(report.sale_date).format("YYYY-MM-DD HH:mm:ss"),
    });
    setIsEditing(true);
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      const updatedReport = {
        ...editingReport,
        updatedAt: new Date().toISOString(),
        sale_date: dayjs(editingReport.sale_date).format("YYYY-MM-DD HH:mm:ss"),
      };

      await axios.put(
        `http://175.29.181.245:15001/update-sales-report/${editingReport._id}`,
        updatedReport,
      );

      toast.success("Report and stock updated successfully");
      fetchDailyReports();
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating report:", error);
      toast.error(error.response?.data?.message || "Failed to update report");
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this report? This will restore the stock quantities.",
      )
    )
      return;

    try {
      const outlet = viewedUser?.outlet;
      if (!outlet) {
        throw new Error("Outlet information not available");
      }

      const reportResponse = await axios.get(
        `http://175.29.181.245:15001/sales-reports/report/${reportId}`,
      );
      const report = reportResponse.data;

      if (!Array.isArray(report.products)) {
        throw new Error(
          "Invalid report: products array missing or not iterable",
        );
      }

      await axios.delete(
        `http://175.29.181.245:15001/delete-sales-report/${reportId}`,
      );

      toast.success(
        "Report deleted and stock quantities restored successfully",
      );
      fetchDailyReports();
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete report",
      );
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...editingReport.products];
    const product = { ...updatedProducts[index] };

    if (field === "quantity") {
      const newQuantity = parseInt(value) || 0;
      const currentUnitDP = product.quantity
        ? product.dp / product.quantity
        : 0;
      const currentUnitTP = product.quantity
        ? product.tp / product.quantity
        : 0;
      const currentUnitMRP = product.quantity
        ? product.mrp / product.quantity
        : 0;
      product.quantity = newQuantity;
      product.dp = newQuantity * currentUnitDP;
      product.tp = newQuantity * currentUnitTP;
      product.mrp = newQuantity * currentUnitMRP;
    } else {
      const newValue = parseFloat(value) || 0;
      product[field] = newValue * product.quantity;
    }

    updatedProducts[index] = product;

    const total_tp = updatedProducts.reduce(
      (sum, product) => sum + (product.tp || 0),
      0,
    );
    const total_dp = updatedProducts.reduce(
      (sum, product) => sum + (product.dp || 0),
      0,
    );
    const total_mrp = updatedProducts.reduce(
      (sum, product) => sum + (product.mrp || 0),
      0,
    );

    setEditingReport((prev) => ({
      ...prev,
      products: updatedProducts,
      total_tp,
      total_dp,
      total_mrp,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleFieldChange = (field, value) => {
    setEditingReport((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const computeSummary = () => {
    const productMap = {};
    reports.forEach((report) => {
      report.products.forEach((prod) => {
        const name = prod.product_name;
        if (!productMap[name]) {
          productMap[name] = { quantity: 0, value: 0 };
        }
        productMap[name].quantity += prod.quantity || 0;
        productMap[name].value += prod.tp || 0;
      });
    });
    return Object.entries(productMap).map(([name, { quantity, value }]) => ({
      name,
      quantity,
      value,
    }));
  };

  const handleShowSummary = () => {
    const data = computeSummary();
    setSummaryData(data);
    setShowSummary(true);
  };

  const getSerialWiseReport = () => {
    const yearMonth = filterMonth || dayjs().format("YYYY-MM");
    const daysInMonth = dayjs(yearMonth).daysInMonth();
    const currentDate = dayjs();
    const isCurrentMonth = yearMonth === currentDate.format("YYYY-MM");
    const maxDay = isCurrentMonth ? currentDate.date() : daysInMonth;
    const reportData = [];

    for (let day = 1; day <= maxDay; day++) {
      const date = dayjs(`${yearMonth}-${day}`).format("YYYY-MM-DD");
      const dayReports = reports.filter(
        (report) => dayjs(report.sale_date).format("YYYY-MM-DD") === date,
      );

      const totalProductsSold = dayReports.reduce(
        (sum, report) =>
          sum +
          report.products.reduce(
            (prodSum, product) => prodSum + (product.quantity || 0),
            0,
          ),
        0,
      );
      const totalTP = dayReports.reduce(
        (sum, report) => sum + (report.total_tp || 0),
        0,
      );
      const totalMRP = dayReports.reduce(
        (sum, report) => sum + (report.total_mrp || 0),
        0,
      );

      if (dayReports.length > 0) {
        reportData.push({
          date,
          totalProductsSold,
          totalTP,
          totalMRP,
          reports: dayReports,
        });
      }
    }

    return reportData;
  };

  const exportToExcel = () => {
    try {
      // Prepare data for Excel export
      const excelData = [];

      // Add header row
      excelData.push([
        "Day",
        "Date",
        "Product Name",
        "Quantity",
        "Unit Price",
        "Memo",
        "Total TP",
        "Total MRP",
      ]);

      // Add data rows
      serialWiseReport.forEach((dayReport, dayIndex) => {
        let dayAdded = false;

        dayReport.reports.forEach((report) => {
          report.products.forEach((product, productIndex) => {
            const row = [];

            // Day (only for first product of the day)
            if (!dayAdded && productIndex === 0) {
              row.push(dayIndex + 1);
              dayAdded = true;
            } else {
              row.push("");
            }

            // Date (only for first product of the day)
            if (productIndex === 0) {
              row.push(dayReport.date);
            } else {
              row.push("");
            }

            // Product details
            row.push(
              product.product_name,
              product.quantity,
              (product.tp / product.quantity).toFixed(2),
              report.memo || "N/A",
            );

            // Total TP and MRP (only for first product of the report)
            if (productIndex === 0) {
              row.push(
                dayReport.totalTP.toFixed(2),
                dayReport.totalMRP.toFixed(2),
              );
            } else {
              row.push("", "");
            }

            excelData.push(row);
          });
        });
      });

      // Add summary row
      excelData.push([]); // Empty row
      excelData.push([
        "GRAND TOTAL",
        "",
        "",
        totalProductsSold,
        "",
        "",
        totalTP.toFixed(2),
        totalMRP.toFixed(2),
      ]);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Sales Report");

      // Generate Excel file and download
      const fileName = `sales-report-${viewedUser?.name || "user"}-${filterMonth || "custom"}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Report exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export report");
    }
  };

  const exportSummaryToExcel = () => {
    try {
      const excelData = [];

      // Add header row
      excelData.push(["Product Name", "Total Quantity", "Total Value (TP)"]);

      // Add data rows
      summaryData
        .filter((item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => {
          excelData.push([item.name, item.quantity, item.value.toFixed(2)]);
        });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Sales Summary");

      // Generate Excel file and download
      const fileName = `sales-summary-${viewedUser?.name || "user"}-${filterMonth || "custom"}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Summary exported successfully!");
    } catch (error) {
      console.error("Error exporting summary to Excel:", error);
      toast.error("Failed to export summary");
    }
  };

  const totalMRP = reports.reduce(
    (sum, report) => sum + (report.total_mrp || 0),
    0,
  );
  const totalTP = reports.reduce(
    (sum, report) => sum + (report.total_tp || 0),
    0,
  );
  const totalProductsSold = reports.reduce(
    (sum, report) =>
      sum +
      report.products.reduce(
        (prodSum, product) => prodSum + (product.quantity || 0),
        0,
      ),
    0,
  );

  const serialWiseReport = getSerialWiseReport();

  const getRowData = () => {
    const rowData = [];
    let serial = 0;

    serialWiseReport.forEach((dayReport) => {
      serial++;
      let allProducts = [];
      dayReport.reports.forEach((report) => {
        report.products.forEach((product) => {
          allProducts.push({
            name: product.product_name,
            quantity: product.quantity,
            price: (product.tp / product.quantity).toFixed(2),
            reportId: report._id,
            memo: report.memo || "N/A",
          });
        });
      });

      const rowSpan = allProducts.length || 1;

      allProducts.forEach((prod, prodIndex) => {
        if (prodIndex === 0) {
          rowData.push({
            isGroupHeader: true,
            day: serial,
            date: dayReport.date,
            productName: prod.name,
            quantity: prod.quantity,
            price: prod.price,
            memo: prod.memo,
            totalTP: dayReport.totalTP.toFixed(2),
            totalMRP: dayReport.totalMRP.toFixed(2),
            actions: dayReport.reports.map((report) => (
              <div key={report._id} className="flex space-x-2 mb-1">
                <button
                  onClick={() => handleEditReport(report)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  disabled={userLoading}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteReport(report._id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                  disabled={userLoading}
                >
                  Delete
                </button>
              </div>
            )),
            rowSpan,
          });
        } else {
          rowData.push({
            isGroupHeader: false,
            productName: prod.name,
            quantity: prod.quantity,
            price: prod.price,
            memo: prod.memo,
          });
        }
      });
    });

    return rowData;
  };

  const rowData = getRowData();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {viewedUser?.name}
            </h2>
            <p className="text-base text-gray-600 mb-6">
              Outlet: {viewedUser?.outlet}
            </p>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 items-end">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">
                  Select Month
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="border border-gray-400 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  disabled={startDate && endDate}
                />
              </div>
              {/* <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedMonth("");
                  }}
                  className="border border-gray-400 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setSelectedMonth("");
                  }}
                  className="border border-gray-400 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div> */}
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium"
                onClick={() => {
                  setFilterMonth(selectedMonth);
                  setFilterStartDate(startDate);
                  setFilterEndDate(endDate);
                }}
              >
                Filter Reports
              </button>
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-medium"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedMonth(dayjs().format("YYYY-MM"));
                  setFilterMonth(dayjs().format("YYYY-MM"));
                  setFilterStartDate("");
                  setFilterEndDate("");
                }}
              >
                Reset
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium"
                onClick={handleShowSummary}
              >
                Summary
              </button>
              <button
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium"
                onClick={exportToExcel}
                disabled={loading || rowData.length === 0}
              >
                Export to Excel
              </button>
            </div>

            {/* Report Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-100 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-blue-700 mb-1">
                  Total Products Sold
                </h4>
                <p className="text-xl font-bold text-gray-800">
                  {totalProductsSold}
                </p>
              </div>
              <div className="bg-green-100 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-green-700 mb-1">
                  Total TP
                </h4>
                <p className="text-xl font-bold text-gray-800">
                  {totalTP.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-100 rounded-lg p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-purple-700 mb-1">
                  Total MRP
                </h4>
                <p className="text-xl font-bold text-gray-800">
                  {totalMRP.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Serial-Wise Daily Report Table */}
            {loading || userLoading ? (
              <div className="flex justify-center items-center my-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-600"></div>
              </div>
            ) : filterStartDate && filterEndDate ? (
              <div className="text-center text-gray-600 py-6">
                Serial-wise report is only available for month selection. Please
                select a month.
              </div>
            ) : rowData.length === 0 ? (
              <div className="text-center text-gray-600 py-6">
                No sales found for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse bg-white shadow-sm rounded-lg">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Day
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Product Name
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Memo
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Total TP
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                        Total MRP
                      </th>
                      {user?.role === "super admin" && (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {rowData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 border-r border-gray-300"
                          >
                            {row.day}
                          </td>
                        ) : null}
                        {row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 border-r border-gray-300"
                          >
                            {row.date}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                          {row.productName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                          {row.quantity}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                          {row.price}
                        </td>
                        {row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 border border-gray-300 text-center"
                          >
                            {row.memo}
                          </td>
                        ) : null}
                        {row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="py-3 whitespace-nowrap text-sm text-center font-medium text-gray-800 border-r border-gray-300"
                          >
                            {row.totalTP}
                          </td>
                        ) : null}
                        {row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-gray-800 border-r border-gray-300"
                          >
                            {row.totalMRP}
                          </td>
                        ) : null}
                        {user?.role === "super admin" && row.isGroupHeader ? (
                          <td
                            rowSpan={row.rowSpan}
                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-600"
                          >
                            <div className="flex flex-col space-y-1">
                              {row.actions}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-200">
                    <tr className="font-semibold text-gray-800">
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-left border-t border-gray-300"
                      >
                        Grand Total
                      </td>
                      <td className="px-4 py-3 text-right border-t border-gray-300">
                        {totalProductsSold}
                      </td>
                      <td className="px-4 py-3 text-right border-t border-gray-300">
                        -
                      </td>
                      <td className="px-4 py-3 text-left border-t border-gray-300">
                        -
                      </td>
                      <td className="px-4 py-3 text-right border-t border-gray-300">
                        {totalTP.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right border-t border-gray-300">
                        {totalMRP.toFixed(2)}
                      </td>
                      {user?.role === "super admin" && (
                        <td className="px-4 py-3 border-t border-gray-300"></td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Edit Sales Report
                  </h3>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-gray-500 hover:text-gray-700 text-lg"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleUpdateReport} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={dayjs(editingReport.sale_date).format(
                          "YYYY-MM-DD",
                        )}
                        onChange={(e) =>
                          handleFieldChange("sale_date", e.target.value)
                        }
                        className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                        step="1"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Memo
                      </label>
                      <input
                        type="text"
                        value={editingReport.memo || ""}
                        onChange={(e) =>
                          handleFieldChange("memo", e.target.value)
                        }
                        className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm text-center"
                        placeholder="Enter memo"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Products
                    </label>
                    <div className="space-y-3">
                      {editingReport.products.map((product, index) => (
                        <div
                          key={index}
                          className="border border-gray-300 rounded-lg p-4 bg-gray-50"
                        >
                          <div className="font-medium text-gray-800 mb-2">
                            {product.product_name}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-600 mb-1">
                                Quantity
                              </label>
                              <input
                                type="number"
                                value={product.quantity}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                min="0"
                              />
                            </div>

                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-600 mb-1">
                                Unit DP
                              </label>
                              <input
                                type="number"
                                value={
                                  product.quantity
                                    ? product.dp / product.quantity
                                    : 0
                                }
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "dp",
                                    e.target.value,
                                  )
                                }
                                className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                step="0.01"
                              />
                            </div>

                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-600 mb-1">
                                Unit TP
                              </label>
                              <input
                                type="number"
                                value={
                                  product.quantity
                                    ? product.tp / product.quantity
                                    : 0
                                }
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "tp",
                                    e.target.value,
                                  )
                                }
                                className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                step="0.01"
                              />
                            </div>

                            <div className="flex flex-col">
                              <label className="text-xs font-medium text-gray-600 mb-1">
                                Unit MRP
                              </label>
                              <input
                                type="number"
                                value={
                                  product.quantity
                                    ? product.mrp / product.quantity
                                    : 0
                                }
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "mrp",
                                    e.target.value,
                                  )
                                }
                                className="p-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                step="0.01"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div className="bg-white p-2 rounded text-center border border-gray-300 text-sm">
                              <div className="text-gray-600">Total DP</div>
                              <div className="font-medium text-gray-800">
                                {product.dp?.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded text-center border border-gray-300 text-sm">
                              <div className="text-gray-600">Total TP</div>
                              <div className="font-medium text-gray-800">
                                {product.tp?.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-white p-2 rounded text-center border border-gray-300 text-sm">
                              <div className="text-gray-600">Total MRP</div>
                              <div className="font-medium text-gray-800">
                                {product.mrp?.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-300">
                    <div>
                      <div className="text-sm text-gray-600">Total TP</div>
                      <div className="text-xl font-bold text-gray-800">
                        {editingReport.total_tp?.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total DP</div>
                      <div className="text-xl font-bold text-gray-800">
                        {editingReport.total_dp?.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-gray-400 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      disabled={userLoading}
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Product Wise Sales Summary
                  </h3>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="text-gray-500 hover:text-gray-700 text-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Search Box */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Export Button */}
                <div className="mb-4 flex justify-end">
                  <button
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium"
                    onClick={exportSummaryToExcel}
                  >
                    Export Summary to Excel
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse bg-white shadow-sm rounded-lg">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                          Product Name
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                          Total Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                          Total Value (TP)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {summaryData
                        .filter((item) =>
                          item.name
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                              {item.value.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReport;
