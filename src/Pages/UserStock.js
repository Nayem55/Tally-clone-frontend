import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const ManageUserStock = () => {
  const user = JSON.parse(localStorage.getItem("pos-user"));
  const [selectedOutlet, setSelectedOutlet] = useState(user?.outlet || "");
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState({});
  const [originalStocks, setOriginalStocks] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef();

  useEffect(() => {
    if (selectedOutlet) {
      setProducts([]); // Clear products on outlet change or search
      setPage(1); // Reset page to 1 for fresh fetch
      setHasMore(true); // Reset pagination
      fetchProducts(1);
    }
  }, [selectedOutlet, searchQuery]);

  const fetchProducts = async (pageNumber) => {
    if (!hasMore && !searchQuery) return;
    setLoading(true);
    try {
      let response;
      let fetchedProducts;

      if (searchQuery) {
        // Search query, disable pagination
        response = await axios.get(
          `http://175.29.181.245:15001/search-product?search=${searchQuery}&type=name`,
        );
        fetchedProducts = response.data;
        setHasMore(false); // No more products for pagination if searching
      } else {
        // Regular fetch with pagination
        response = await axios.get(
          `http://175.29.181.245:15001/products?page=${pageNumber}`,
        );
        fetchedProducts = response.data.products;
        setHasMore(response.data.products.length > 0);
      }

      setProducts((prev) => [...prev, ...fetchedProducts]);

      const stockData = {};
      const originalStockData = {};

      const stockRequests = fetchedProducts.map(async (product) => {
        try {
          const stockResponse = await axios.get(
            `http://175.29.181.245:15001/outlet-stock?barcode=${product.barcode}&outlet=${selectedOutlet}`,
          );
          const stockValue = stockResponse.data.stock || 0;
          stockData[product.barcode] = stockValue;
          originalStockData[product.barcode] = stockValue;
        } catch (error) {
          stockData[product.barcode] = 0;
          originalStockData[product.barcode] = 0;
        }
      });

      await Promise.all(stockRequests);
      setStocks((prev) => ({ ...prev, ...stockData }));
      setOriginalStocks((prev) => ({ ...prev, ...originalStockData }));
    } catch (error) {
      console.error("Error fetching products or stocks:", error);
    }
    setLoading(false);
  };

  const lastProductRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !searchQuery) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, searchQuery],
  );

  useEffect(() => {
    if (page > 1 && !searchQuery) {
      fetchProducts(page);
    }
  }, [page, searchQuery]);

  const handleStockChange = (barcode, value) => {
    setStocks((prevStocks) => ({
      ...prevStocks,
      [barcode]: value,
    }));
  };

  const updateStock = async (barcode) => {
    try {
      await axios.put("http://175.29.181.245:15001/update-outlet-stock", {
        barcode,
        outlet: selectedOutlet,
        newStock: stocks[barcode],
      });
      toast.success("Stock updated successfully");
      setOriginalStocks((prev) => ({ ...prev, [barcode]: stocks[barcode] }));
    } catch (error) {
      console.error("Error updating stock:", error);
      toast.error("Failed to update stock");
    }
  };

  return (
    <div className="flex sm:p-10 p-4">
      <div className="w-full">
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">
            Manage Stock: {selectedOutlet}
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by product name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border p-2 rounded w-full sm:w-64"
            />
            <button
              onClick={() => {
                setSearchQuery(search);
                setPage(1); // Reset page on new search
              }}
              className="bg-gray-800 text-white px-4 py-2 rounded w-full sm:w-auto"
            >
              Search
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm sm:text-base">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border p-2">Barcode</th>
                <th className="border p-2">Product Name</th>
                <th className="border p-2">Opening Stock</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr
                  key={product.barcode}
                  ref={products.length - 1 === index ? lastProductRef : null}
                  className="border"
                >
                  <td className="border p-2">{product.barcode}</td>
                  <td className="border p-2">{product.name}</td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={stocks[product.barcode]}
                      onChange={(e) =>
                        handleStockChange(
                          product.barcode,
                          parseInt(e.target.value),
                        )
                      }
                      className="border p-1 w-full text-center"
                    />
                  </td>
                  <td className="border p-2">
                    <button
                      onClick={() => updateStock(product.barcode)}
                      disabled={originalStocks[product.barcode] > 0}
                      className={`px-3 text-white py-1 rounded-md w-full sm:w-auto ${
                        originalStocks[product.barcode] > 0
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-green-500 hover:bg-gray-800 "
                      }`}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="flex justify-center items-center my-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUserStock;
