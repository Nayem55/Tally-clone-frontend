import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import AdminSidebar from "../../Component/AdminSidebar";

const DailyDealerSalesReport = () => {
  const { userId } = useParams();
  const [selectedDate, setSelectedDate] = useState(
    dayjs().format("YYYY-MM-DD"),
  );
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate, userId]);

  const fetchDailyReport = async () => {
    try {
      setLoading(true);

      const formattedDate = dayjs(selectedDate).format("YYYY-MM-DD");

      const response = await axios.get(
        `http://175.29.181.245:15001/sales-reports/${userId}`,
        {
          params: {
            startDate: formattedDate,
            endDate: formattedDate,
          },
        },
      );

      setReport(response.data);
    } catch (error) {
      console.error("Error fetching daily report:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6 bg-gray-100">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            Daily Sales Report
          </h2>

          {/* Date Picker */}
          <div className="mb-6 flex gap-4 items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border rounded p-2"
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={fetchDailyReport}
            >
              Filter Report
            </button>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              onClick={() => setSelectedDate(dayjs().format("YYYY-MM-DD"))}
            >
              Reset
            </button>
          </div>

          {/* Report Table */}
          {loading ? (
            <div className="text-center text-gray-600">Loading...</div>
          ) : report ? (
            <div className="bg-white shadow-lg rounded-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Sales on {selectedDate}
              </h3>
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-4 text-left font-medium text-gray-700">
                      Product
                    </th>
                    <th className="p-4 text-left font-medium text-gray-700">
                      Quantity
                    </th>
                    <th className="p-4 text-left font-medium text-gray-700">
                      Total MRP
                    </th>
                    <th className="p-4 text-left font-medium text-gray-700">
                      Total TP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report?.products.map((product, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-gray-800">
                        {product.product_name}
                      </td>
                      <td className="p-4 text-gray-600">{product.quantity}</td>
                      <td className="p-4 text-gray-800">
                        ৳{product.total_mrp.toFixed(2)}
                      </td>
                      <td className="p-4 text-gray-800">
                        ৳{product.total_tp.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-600">
              No sales found for this date.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyDealerSalesReport;
