import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-hot-toast";

const UserDashboard = () => {
  const { search } = useLocation();
  const [reports, setReports] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new URLSearchParams(search).get("month") || dayjs().format("YYYY-MM"),
  );
  const [target, setTarget] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const user = JSON.parse(localStorage.getItem("pos-user"));

  useEffect(() => {
    fetchDailyReports();
    fetchUserTarget();
  }, [user._id, selectedMonth]);

  const fetchDailyReports = async () => {
    try {
      const response = await axios.get(
        `http://175.29.181.245:15001/sales-reports/${user._id}?month=${selectedMonth}`,
      );
      setReports(response.data);
    } catch (error) {
      console.error("Error fetching daily reports:", error);
      toast.error("Failed to load reports");
    }
  };

  const fetchUserTarget = async () => {
    try {
      const year = selectedMonth.split("-")[0];
      const month = selectedMonth.split("-")[1];

      const response = await axios.get("http://175.29.181.245:15001/targets", {
        params: { year, month, userID: user._id },
      });

      const targetEntry = response.data.find(
        (entry) => entry.userID === user._id,
      );
      if (targetEntry) {
        const targetForMonth = targetEntry.targets.find(
          (t) => t.year === parseInt(year) && t.month === parseInt(month),
        );
        if (targetForMonth) {
          setTarget(targetForMonth.tp);
        }
      }
    } catch (error) {
      console.error("Error fetching user target:", error);
    }
  };

  const fetchProductStock = async (barcode) => {
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/outlet-stock",
        {
          params: { barcode, outlet: user.outlet },
        },
      );
      return response.data.stock || 0;
    } catch (error) {
      console.error("Error fetching stock:", error);
      return 0;
    }
  };

  // Modified handleEditReport function to include stock data
  const handleEditReport = async (report) => {
    try {
      // Fetch current stock for all products in the report
      const productsWithOriginalValues = await Promise.all(
        report.products.map(async (product) => {
          const currentStock = await fetchProductStock(product.barcode);
          return {
            ...product,
            originalQuantity: product.quantity, // Store original quantity
            originalDP: product.dp / product.quantity, // Store original DP
            originalTP: product.tp / product.quantity, // Store original TP
            currentStock, // Store current stock level
          };
        }),
      );

      setEditingReport({
        ...report,
        products: productsWithOriginalValues,
      });
      setIsEditing(true);
    } catch (error) {
      console.error("Error preparing edit:", error);
      toast.error("Failed to prepare report for editing");
    }
  };

  // Modified handleUpdateReport function to work with existing API
  const handleUpdateReport = async (e) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      // Prepare stock updates for all products
      const stockUpdates = await Promise.all(
        editingReport.products.map(async (product) => {
          // Get current stock info
          const stockRes = await axios.get(
            "http://175.29.181.245:15001/outlet-stock",
            { params: { barcode: product.barcode, outlet: user.outlet } },
          );

          const currentStock = stockRes.data.stock.currentStock || 0;
          const currentDPValue = stockRes.data.stock.currentStockValueDP || 0;
          const currentTPValue = stockRes.data.stock.currentStockValueTP || 0;

          // Calculate net changes
          const quantityChange = product.quantity - product.originalQuantity;
          const dpValueChange =
            product.dp - product.originalQuantity * product.originalDP;
          const tpValueChange =
            product.tp - product.originalQuantity * product.originalTP;

          return {
            barcode: product.barcode,
            newStock: currentStock - quantityChange,
            currentStockValueDP: currentDPValue - dpValueChange,
            currentStockValueTP: currentTPValue - tpValueChange,
          };
        }),
      );
      // Update all stock records
      await Promise.all(
        stockUpdates.map(
          ({ barcode, newStock, currentStockValueDP, currentStockValueTP }) => {
            return axios.put(
              "http://175.29.181.245:15001/update-outlet-stock",
              {
                barcode,
                outlet: user.outlet,
                newStock,
                currentStockValueDP,
                currentStockValueTP,
              },
            );
          },
        ),
      );

      // Then update the sales report
      const updatedReport = {
        ...editingReport,
        updatedAt: new Date().toISOString(),
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

  // Modified handleDeleteReport to restore stock using existing API
  // const handleDeleteReport = async (reportId) => {
  //   if (
  //     !window.confirm(
  //       "Are you sure you want to delete this report? This will restore the stock quantities."
  //     )
  //   )
  //     return;

  //   try {
  //     // First get the report to know what quantities to restore
  //     const reportResponse = await axios.get(
  //       `http://175.29.181.245:15001/sales-reports/${reportId}`
  //     );
  //     const report = reportResponse.data;

  //     // Restore stock for all products
  //     await Promise.all(
  //       report.products.map(async (product) => {
  //         // Get current stock info
  //         const stockRes = await axios.get(
  //           "http://175.29.181.245:15001/outlet-stock",
  //           { params: { barcode: product.barcode, outlet: user.outlet } }
  //         );
  //         const currentStock = stockRes.data.stock || 0;

  //         return axios.put(
  //           "http://175.29.181.245:15001/update-outlet-stock",
  //           {
  //             barcode: product.barcode,
  //             outlet: user.outlet,
  //             newStock: currentStock + product.quantity, // Add back the sold quantity
  //             currentStockValueDP:
  //               (currentStock + product.quantity) * product.dp,
  //             currentStockValueTP:
  //               (currentStock + product.quantity) * product.tp,
  //           }
  //         );
  //       })
  //     );

  //     // Then delete the report
  //     await axios.delete(
  //       `http://175.29.181.245:15001/delete-sales-report/${reportId}`
  //     );

  //     toast.success(
  //       "Report deleted and stock quantities restored successfully"
  //     );
  //     fetchDailyReports();
  //   } catch (error) {
  //     console.error("Error deleting report:", error);
  //     toast.error(error.response?.data?.message || "Failed to delete report");
  //   }
  // };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...editingReport.products];

    // Simply update the field that was changed
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]:
        field === "quantity" ? parseInt(value) || 0 : parseFloat(value) || 0,
    };

    // Calculate totals based on current values (no automatic price adjustments)
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

  const isEditable = (reportDate) => {
    return dayjs(reportDate).isSame(dayjs(), "day");
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
        (prodSum, product) => prodSum + product.quantity,
        0,
      ),
    0,
  );

  const percentageAchieved = target ? ((totalTP / target) * 100).toFixed(2) : 0;

  return (
    <div className="flex flex-col lg:flex-row bg-gray-50 min-h-screen">
      <div className="flex-1 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
            Sales Dashboard
          </h2>

          {/* Month Selector */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <label className="font-medium text-gray-700 mr-3">
                  Select Month:{" "}
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="text-gray-700 font-medium bg-blue-50 px-4 py-2 rounded-lg">
                {dayjs(selectedMonth).format("MMMM YYYY")}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
              <span className="text-gray-500 text-sm">Products Sold</span>
              <span className="text-2xl font-bold text-gray-800 mt-1">
                {totalProductsSold}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
              <span className="text-gray-500 text-sm">Monthly Target</span>
              <span className="text-2xl font-bold text-gray-800 mt-1">
                {target?.toLocaleString() || "N/A"}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
              <span className="text-gray-500 text-sm">Total TP</span>
              <span className="text-2xl font-bold text-gray-800 mt-1">
                {totalTP.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col">
              <span className="text-gray-500 text-sm">Target Achieved</span>
              <span
                className={`text-2xl font-bold mt-1 ${
                  percentageAchieved >= 100
                    ? "text-green-600"
                    : percentageAchieved >= 80
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {target ? `${percentageAchieved}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Daily Reports Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Daily Sales Reports
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total TP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reports.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        No reports found for selected month
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr key={report._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {dayjs(report.sale_date).format("DD MMM YYYY")}
                          </div>
                          <div className="text-sm text-gray-500">
                            {dayjs(report.sale_date).format("h:mm A")}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 space-y-1">
                            {report.products.map((product, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{product.product_name}</span>
                                <span className="text-gray-600">
                                  x{product.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.total_tp.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {isEditable(report.sale_date) ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditReport(report)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              {/* <button
                                onClick={() => handleDeleteReport(report._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button> */}
                            </div>
                          ) : (
                            <span className="text-gray-400">View Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Edit Sales Report
                </h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateReport} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date & Time
                  </label>
                  <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
                    {dayjs(editingReport.sale_date).format(
                      "DD MMM YYYY, h:mm A",
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Products
                  </label>
                  <div className="space-y-3">
                    {editingReport.products.map((product, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="font-medium mb-2">
                          {product.product_name}
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          {/* Quantity */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
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
                              className="w-full p-2 border rounded"
                              min="1"
                            />
                          </div>

                          {/* Unit DP */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Unit DP
                            </label>
                            <input
                              type="number"
                              value={product.dp / product.quantity}
                              onChange={(e) =>
                                handleProductChange(
                                  index,
                                  "dp",
                                  e.target.value * product.quantity,
                                )
                              }
                              className="w-full p-2 border rounded"
                            />
                          </div>

                          {/* Unit TP */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Unit TP
                            </label>
                            <input
                              type="number"
                              value={product.tp / product.quantity}
                              onChange={(e) =>
                                handleProductChange(
                                  index,
                                  "tp",
                                  e.target.value * product.quantity,
                                )
                              }
                              className="w-full p-2 border rounded"
                            />
                          </div>

                          {/* Unit MRP */}
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Unit MRP
                            </label>
                            <input
                              type="number"
                              value={product.mrp / product.quantity}
                              onChange={(e) =>
                                handleProductChange(
                                  index,
                                  "mrp",
                                  e.target.value * product.quantity,
                                )
                              }
                              className="w-full p-2 border rounded"
                            />
                          </div>
                        </div>

                        {/* Line Totals */}
                        <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                          <div className="bg-gray-100 p-1 rounded text-center">
                            <div>DP: {product.dp.toFixed(2)}</div>
                          </div>
                          <div className="bg-gray-100 p-1 rounded text-center">
                            <div>TP: {product.tp.toFixed(2)}</div>
                          </div>
                          <div className="bg-gray-100 p-1 rounded text-center">
                            <div>MRP: {product.mrp.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-gray-500">Total TP</div>
                    <div className="text-xl font-bold">
                      {editingReport.total_tp.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total DP</div>
                    <div className="text-xl font-bold">
                      {editingReport.total_dp.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border rounded-md text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 rounded-md text-sm font-medium text-white"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
