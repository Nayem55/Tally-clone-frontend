import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart2, FileDown, X } from "lucide-react";
import AdminSidebar from "../../Component/AdminSidebar";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { ClipLoader } from "react-spinners";
import toast from "react-hot-toast";

const ProductWiseSalesReport = () => {
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState({
    totalSold: 0,
    totalTP: 0,
    totalMRP: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [modalSummary, setModalSummary] = useState({
    totalQuantity: 0,
    totalTP: 0,
    totalMRP: 0,
    totalOutlets: 0,
  });

  const fetchSalesData = async (params) => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/api/sales/product-wise",
        { params },
      );
      setSalesData(response.data);
      calculateSummary(response.data);
    } catch (err) {
      setError("Failed to fetch sales data");
    } finally {
      setLoading(false);
    }
  };

  const fetchOutletDetails = async (productName) => {
    try {
      setModalLoading(true);
      setSelectedProduct(productName);
      const params = {};

      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (month) {
        params.month = month;
      }

      params.productName = productName;

      const response = await axios.get(
        "http://175.29.181.245:15001/api/sales/product-wise/outlet-details",
        { params },
      );

      setModalData(response.data);

      // Calculate modal summary
      const totalQuantity = response.data.reduce(
        (sum, outlet) => sum + outlet.total_quantity,
        0,
      );
      const totalTP = response.data.reduce(
        (sum, outlet) => sum + outlet.total_tp,
        0,
      );
      const totalMRP = response.data.reduce(
        (sum, outlet) => sum + outlet.total_mrp,
        0,
      );
      const totalOutlets = response.data.length;

      setModalSummary({ totalQuantity, totalTP, totalMRP, totalOutlets });
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error fetching outlet details:", err);
      toast.error("Failed to fetch outlet details");
    } finally {
      setModalLoading(false);
    }
  };

  const calculateSummary = (data) => {
    const totalSold = data.reduce((sum, item) => sum + item.total_quantity, 0);
    const totalTP = data.reduce((sum, item) => sum + item.total_tp, 0);
    const totalMRP = data.reduce((sum, item) => sum + item.total_mrp, 0);
    setSummary({ totalSold, totalTP, totalMRP });
  };

  useEffect(() => {
    fetchSalesData({ month });
  }, []);

  const handleFilter = () => {
    const params = {};
    if (startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    } else if (month) {
      params.month = month;
    }
    fetchSalesData(params);
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    const currentMonth = dayjs().format("YYYY-MM");
    setMonth(currentMonth);
    fetchSalesData({ month: currentMonth });
  };

  const handleExportToExcel = () => {
    const dataToExport = salesData.map((product) => ({
      "Product Name": product._id,
      Barcode: product.barcode || "N/A",
      "Total Sold (PCS)": product.total_quantity,
      "Total TP": product.total_tp,
      "Total MRP": product.total_mrp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const fileData = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(
      fileData,
      `ProductWiseSalesReport-${dayjs().format("YYYY-MM-DD")}.xlsx`,
    );
    toast.success("Product-wise report exported successfully");
  };

  const handleExportModalToExcel = () => {
    try {
      const exportData = modalData.map((outlet) => ({
        Product: selectedProduct,
        Outlet: outlet._id,
        "PCS Sold": outlet.total_quantity,
        "Total TP": outlet.total_tp,
        "Total MRP": outlet.total_mrp,
      }));

      // Add summary row
      exportData.push({
        Product: `${selectedProduct} - TOTAL`,
        Outlet: "",
        "PCS Sold": modalSummary.totalQuantity,
        "Total TP": modalSummary.totalTP,
        "Total MRP": modalSummary.totalMRP,
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();

      // Create safe sheet name
      const sheetName = `Sales-${selectedProduct}`
        .substring(0, 28)
        .replace(/[\\/*?:[\]]/g, "")
        .trim();

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Auto-size columns
      const wscols = [
        { wch: Math.max(20, selectedProduct.length + 5) }, // Product column
        { wch: 20 }, // Outlet column
        { wch: 10 }, // PCS Sold
        { wch: 15 }, // Total TP
        { wch: 15 }, // Total MRP
      ];
      worksheet["!cols"] = wscols;

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const fileName = `OutletSales-${selectedProduct}-${dayjs().format(
        "YYYY-MM-DD",
      )}.xlsx`;

      const fileData = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(fileData, fileName);
      toast.success("Outlet details exported successfully");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export data. Please try again.");
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-6 bg-gray-100 min-h-screen w-full">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={24} />
            <h2 className="text-xl font-semibold">Product-wise Sales Report</h2>
          </div>

          {/* Summary Report */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded-lg text-center shadow-md">
              <h3 className="text-lg font-semibold text-blue-800">
                Total Sales
              </h3>
              <p className="text-2xl font-bold">{summary.totalSold} PCS</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg text-center shadow-md">
              <h3 className="text-lg font-semibold text-green-800">Total TP</h3>
              <p className="text-2xl font-bold">{summary.totalTP.toFixed(2)}</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg text-center shadow-md">
              <h3 className="text-lg font-semibold text-red-800">Total MRP</h3>
              <p className="text-2xl font-bold">
                {summary.totalMRP.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-4 items-end">
            <div>
              <label className="font-medium">Select Month: </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border rounded p-2 ml-2"
                disabled={startDate && endDate}
              />
            </div>
            <div>
              <label className="font-medium">Start Date: </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded p-2 ml-2"
              />
            </div>
            <div>
              <label className="font-medium">End Date: </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded p-2 ml-2"
              />
            </div>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2"
              onClick={handleFilter}
            >
              Filter Reports
            </button>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
            <button
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-auto"
              onClick={handleExportToExcel}
            >
              <FileDown size={18} /> Export to Excel
            </button>
          </div>

          {/* Sales Report Table */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <ClipLoader color="#4F46E5" size={40} />
              <span className="ml-3 text-gray-600">Loading sales data...</span>
            </div>
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2 text-left">Product Name</th>
                    <th className="border p-2 text-left">Barcode</th>
                    <th className="border p-2 text-center">Total Sold (PCS)</th>
                    <th className="border p-2 text-center">Total TP</th>
                    <th className="border p-2 text-center">Total MRP</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="border p-2">{product._id}</td>
                      <td className="border p-2">{product.barcode || "N/A"}</td>
                      <td
                        className="border p-2 text-center cursor-pointer text-blue-600 hover:underline"
                        onClick={() => fetchOutletDetails(product._id)}
                      >
                        {product.total_quantity}
                      </td>
                      <td className="border p-2 text-center">
                        {product.total_tp.toFixed(2)}
                      </td>
                      <td className="border p-2 text-center">
                        {product.total_mrp.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Outlet Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center border-b p-4 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-semibold">
                Outlet-wise Sales for: {selectedProduct}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportModalToExcel}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Export to Excel
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 border-b">
              <div className="bg-blue-100 p-3 rounded-lg flex items-center gap-3">
                <div>
                  <p className="text-gray-600 text-xs">Total Outlets</p>
                  <h3 className="text-md font-bold">
                    {modalSummary.totalOutlets}
                  </h3>
                </div>
              </div>
              <div className="bg-green-100 p-3 rounded-lg flex items-center gap-3">
                <div>
                  <p className="text-gray-600 text-xs">Total PCS Sold</p>
                  <h3 className="text-md font-bold">
                    {modalSummary.totalQuantity}
                  </h3>
                </div>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg flex items-center gap-3">
                <div>
                  <p className="text-gray-600 text-xs">Total TP</p>
                  <h3 className="text-md font-bold">
                    {modalSummary.totalTP.toFixed(2)}
                  </h3>
                </div>
              </div>
              <div className="bg-red-100 p-3 rounded-lg flex items-center gap-3">
                <div>
                  <p className="text-gray-600 text-xs">Total MRP</p>
                  <h3 className="text-md font-bold">
                    {modalSummary.totalMRP.toFixed(2)}
                  </h3>
                </div>
              </div>
            </div>

            {/* Date Range Info */}
            <div className="p-4 text-sm text-gray-600">
              <p>
                Date Range:{" "}
                {startDate && endDate
                  ? `${dayjs(startDate).format("DD MMM YYYY")} - ${dayjs(
                      endDate,
                    ).format("DD MMM YYYY")}`
                  : month
                    ? dayjs(month).format("MMMM YYYY")
                    : "All time"}
              </p>
            </div>

            <div className="p-4">
              {modalLoading ? (
                <div className="flex justify-center items-center h-64">
                  <ClipLoader color="#4F46E5" size={40} />
                  <span className="ml-3 text-gray-600">
                    Loading outlet details...
                  </span>
                </div>
              ) : modalData.length === 0 ? (
                <p className="text-center text-gray-500">
                  No outlet data found
                </p>
              ) : (
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border p-2 text-left">SO</th>
                      <th className="border p-2 text-left">Outlet</th>
                      <th className="border p-2 text-center">PCS Sold</th>
                      <th className="border p-2 text-center">Total TP</th>
                      <th className="border p-2 text-center">Total MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((outlet) => (
                      <tr
                        key={`${outlet._id.so}-${outlet._id.outlet}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="border p-2">{outlet._id.so}</td>
                        <td className="border p-2">{outlet._id.outlet}</td>
                        <td className="border p-2 text-center">
                          {outlet.total_quantity}
                        </td>
                        <td className="border p-2 text-center">
                          {outlet.total_tp.toFixed(2)}
                        </td>
                        <td className="border p-2 text-center">
                          {outlet.total_mrp.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductWiseSalesReport;
