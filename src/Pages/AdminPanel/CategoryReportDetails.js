import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "../../Component/AdminSidebar";

const CategoryReportDetails = () => {
  const { category } = useParams(); // Get category name from URL
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategoryDetails = async () => {
      try {
        const response = await axios.get(
          `http://175.29.181.245:15001/api/sales/category/${category}`,
        );
        setProducts(response.data);
      } catch (err) {
        setError("Failed to fetch category details");
      } finally {
        setLoading(false);
      }
    };
    fetchCategoryDetails();
  }, [category]);

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-6 bg-gray-100 min-h-screen w-full">
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">
            Products Sold in Category: {category}
          </h2>
          {loading ? (
            <p className="text-center text-gray-500">Loading data...</p>
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : (
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2 text-left">Product Name</th>
                  <th className="border p-2 text-center">Barcode</th>
                  <th className="border p-2 text-center">Quantity Sold</th>
                  <th className="border p-2 text-center">Total TP</th>
                  <th className="border p-2 text-center">Total MRP</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border p-2">{product._id}</td>
                    <td className="border p-2 text-center">
                      {product.barcode}
                    </td>
                    <td className="border p-2 text-center">
                      {product.total_quantity}
                    </td>
                    <td className="border p-2 text-center">
                      {product.total_tp} BDT
                    </td>
                    <td className="border p-2 text-center">
                      {product.total_mrp} BDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryReportDetails;
