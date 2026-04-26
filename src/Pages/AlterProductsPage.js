import { useEffect, useState } from "react";
import axios from "axios";
import {
  Pencil,
  ChevronLeft,
  ChevronRight,
  Filter,
  SaveAll,
  X,
  Check,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import AdminSidebar from "../Component/AdminSidebar";

const AlterProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [bulkUpdateMode, setBulkUpdateMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [bulkUpdateFields, setBulkUpdateFields] = useState({
    dp: 0,
    tp: 0,
    mrp: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPriceLists, setExpandedPriceLists] = useState({});
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const API_URL = "http://175.29.181.245:15001/products";

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/categories",
      );
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await axios.get("http://175.29.181.245:15001/brands");
      setBrands(response.data);
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast.error("Failed to load brands");
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://175.29.181.245:15001/all-products`);
      setProducts(res.data);
      setFilteredProducts(res.data);

      const initialExpandedState = {};
      res.data.forEach((product) => {
        initialExpandedState[product._id] = false;
      });
      setExpandedPriceLists(initialExpandedState);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, []);

  const handleInputChange = (e, id, field) => {
    const value =
      field === "dp" || field === "tp" || field === "mrp"
        ? Number(e.target.value)
        : e.target.value;
    const updatedProducts = products.map((product) =>
      product._id === id ? { ...product, [field]: value } : product,
    );
    setProducts(updatedProducts);

    if (bulkUpdateMode && selectedCategory) {
      const updatedFiltered = filteredProducts.map((product) =>
        product._id === id ? { ...product, [field]: value } : product,
      );
      setFilteredProducts(updatedFiltered);
    }
  };

  const handlePriceListChange = (productId, outlet, field, value) => {
    const updatedProducts = products.map((product) => {
      if (product._id === productId) {
        return {
          ...product,
          priceList: {
            ...product.priceList,
            [outlet]: {
              ...product.priceList?.[outlet],
              [field]: Number(value),
            },
          },
        };
      }
      return product;
    });
    setProducts(updatedProducts);

    if (bulkUpdateMode && selectedCategory) {
      const updatedFiltered = filteredProducts.map((product) => {
        if (product._id === productId) {
          return {
            ...product,
            priceList: {
              ...product.priceList,
              [outlet]: {
                ...product.priceList?.[outlet],
                [field]: Number(value),
              },
            },
          };
        }
        return product;
      });
      setFilteredProducts(updatedFiltered);
    }
  };

  const handleBulkFieldChange = (e, field) => {
    setBulkUpdateFields({
      ...bulkUpdateFields,
      [field]: Number(e.target.value),
    });
  };

  const saveUpdate = async (product) => {
    setUpdating(true);
    try {
      await axios.put(`${API_URL}/${product._id}`, product);
      setEditingProduct(null);
      toast.success("Product updated successfully");
      fetchProducts();
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Product update failed");
    } finally {
      setUpdating(false);
    }
  };

  const applyBulkUpdate = async () => {
    if (!selectedCategory) {
      toast.error("Please select a category first");
      return;
    }

    const updateFields = Object.fromEntries(
      Object.entries(bulkUpdateFields).filter(([_, value]) => value !== 0),
    );

    if (Object.keys(updateFields).length === 0) {
      toast.error("Please specify at least one field to update");
      return;
    }

    setUpdating(true);
    try {
      const response = await axios.put(
        `http://175.29.181.245:15001/category-bulk-update`,
        {
          category: selectedCategory,
          updateFields,
        },
      );

      toast.success(
        `Updated ${response.data.modifiedCount} products in ${selectedCategory}`,
      );
      resetBulkUpdate();
      fetchProducts();
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error("Bulk update failed");
    } finally {
      setUpdating(false);
    }
  };

  const filterByCategory = (category) => {
    setSelectedCategory(category);
    if (category) {
      const filtered = products.filter(
        (p) =>
          p.category === category &&
          p.name?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredProducts(filtered);
    } else {
      const filtered = products.filter((p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredProducts(filtered);
    }
  };

  const resetBulkUpdate = () => {
    setBulkUpdateMode(false);
    setSelectedCategory("");
    setBulkUpdateFields({ dp: 0, tp: 0, mrp: 0 });
    setFilteredProducts(products);
  };

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (bulkUpdateMode && selectedCategory) {
      const filtered = products.filter(
        (p) =>
          p.category === selectedCategory &&
          p.name?.toLowerCase().includes(term.toLowerCase()),
      );
      setFilteredProducts(filtered);
    } else {
      const filtered = products.filter((p) =>
        p.name?.toLowerCase().includes(term.toLowerCase()),
      );
      setFilteredProducts(filtered);
    }
  };

  const togglePriceList = (productId) => {
    setExpandedPriceLists((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const exportToExcel = () => {
    setExportLoading(true);
    try {
      const exportData = products.map((product) => {
        const baseData = {
          "Product ID": product._id,
          "Product Name": product.name,
          Barcode: product.barcode,
          Brand: product.brand,
          Category: product.category,
          DP: product.dp,
          TP: product.tp,
          MRP: product.mrp,
        };

        if (product.priceList) {
          Object.entries(product.priceList).forEach(([outlet, prices]) => {
            baseData[`${outlet} DP`] = prices.dp || 0;
            baseData[`${outlet} TP`] = prices.tp || 0;
            baseData[`${outlet} MRP`] = prices.mrp || 0;
          });
        }

        return baseData;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "Products");

      const fileName = `products_export_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success("Export completed successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export products");
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      setImportPreview(jsonData.slice(0, 5));
    };

    reader.readAsArrayBuffer(file);
  };

  const processImport = async () => {
    if (!importFile) {
      toast.error("Please select a file first");
      return;
    }

    setImportLoading(true);

    try {
      const importResult = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            const importData = jsonData.map((row) => {
              const priceList = {};

              Object.keys(row).forEach((key) => {
                if (
                  key.includes(" DP") ||
                  key.includes(" TP") ||
                  key.includes(" MRP")
                ) {
                  const [outlet, type] = key.split(" ");
                  if (!priceList[outlet]) priceList[outlet] = {};
                  priceList[outlet][type.toLowerCase()] = Number(row[key]) || 0;
                }
              });

              return {
                _id: row["Product ID"],
                name: row["Product Name"] || "",
                barcode: row["Barcode"] || "",
                brand: row["Brand"] || "",
                category: row["Category"] || "",
                dp: Number(row["DP"]) || 0,
                tp: Number(row["TP"]) || 0,
                mrp: Number(row["MRP"]) || 0,
                ...(Object.keys(priceList).length > 0 && { priceList }),
              };
            });

            const response = await axios.post(
              "http://175.29.181.245:15001/bulk-import-products",
              { updatedProducts: importData },
            );

            resolve(response.data);
          } catch (error) {
            reject(error);
          }
        };

        reader.onerror = () => {
          reject(new Error("File reading failed"));
        };

        reader.readAsArrayBuffer(importFile);
      });

      if (importResult.success) {
        toast.success(`Processed ${importResult.totalProcessed} products`);
        if (importResult.insertedCount > 0) {
          toast.success(`Added ${importResult.insertedCount} new products`);
        }
        if (importResult.updatedCount > 0) {
          toast.success(`Updated ${importResult.updatedCount} products`);
        }
        if (
          importResult.updatedCount === 0 &&
          importResult.insertedCount === 0
        ) {
          toast("No changes needed - data matches existing records");
        }
      } else {
        toast.error(importResult.error || "Import completed with issues");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error.response?.data?.error ||
          error.message ||
          "Failed to import products",
      );
    } finally {
      setImportLoading(false);
      setImportModalOpen(false);
      setImportPreview([]);
      fetchProducts();
    }
  };

  const displayProducts = bulkUpdateMode
    ? filteredProducts
    : products.filter((p) =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()),
      );

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Product Management
              </h1>
              <p className="text-sm text-gray-500">
                {bulkUpdateMode
                  ? `Bulk Update Mode - ${
                      selectedCategory || "Select a category"
                    }`
                  : "Manage your product inventory"}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4 md:mt-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              <button
                onClick={exportToExcel}
                disabled={exportLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {exportLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                Export
              </button>

              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                <Upload size={18} />
                Import
              </button>

              <button
                onClick={() =>
                  bulkUpdateMode ? resetBulkUpdate() : setBulkUpdateMode(true)
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  bulkUpdateMode
                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {bulkUpdateMode ? (
                  <>
                    <X size={18} /> Cancel
                  </>
                ) : (
                  <>
                    <SaveAll size={18} /> Bulk Update
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Import Modal */}
          {importModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Import Products from Excel
                  </h3>
                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportFile(null);
                      setImportPreview([]);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File
                  </label>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleImportFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700 file:cursor-pointer
                      hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Please upload an Excel file with product data. Download the
                    template first if needed.
                  </p>
                </div>

                {importPreview.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Data Preview (First 5 Rows)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {Object.keys(importPreview[0]).map((key) => (
                              <th
                                key={key}
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {importPreview.map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, i) => (
                                <td
                                  key={i}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportFile(null);
                      setImportPreview([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={processImport}
                    disabled={!importFile || importLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Import"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Update Panel */}
          {bulkUpdateMode && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6">
              <h3 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                <Filter size={18} className="text-blue-500" />
                Bulk Update Products by Category
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => filterByCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dealer Price (DP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      ৳
                    </span>
                    <input
                      type="number"
                      placeholder="Enter new DP"
                      value={bulkUpdateFields.dp || ""}
                      onChange={(e) => handleBulkFieldChange(e, "dp")}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trade Price (TP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      ৳
                    </span>
                    <input
                      type="number"
                      placeholder="Enter new TP"
                      value={bulkUpdateFields.tp || ""}
                      onChange={(e) => handleBulkFieldChange(e, "tp")}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Retail Price (MRP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">
                      ৳
                    </span>
                    <input
                      type="number"
                      placeholder="Enter new MRP"
                      value={bulkUpdateFields.mrp || ""}
                      onChange={(e) => handleBulkFieldChange(e, "mrp")}
                      className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={applyBulkUpdate}
                    disabled={updating || !selectedCategory}
                    className="flex items-center justify-center gap-2 w-full h-[42px] bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {updating ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                    Apply
                  </button>
                </div>
              </div>

              {selectedCategory && (
                <div className="flex justify-between items-center bg-blue-50 px-4 py-2 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">
                    {filteredProducts.length} products in{" "}
                    <span className="font-semibold">{selectedCategory}</span>{" "}
                    will be updated
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 size={32} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"
                      >
                        {/* Empty for expand/collapse button */}
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Product
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Barcode
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Brand
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Category
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        DP
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        TP
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        MRP
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayProducts.length > 0 ? (
                      displayProducts.map((product) => (
                        <>
                          <tr
                            key={product._id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-2 py-4 text-center">
                              {product.priceList &&
                                Object.keys(product.priceList).length > 0 && (
                                  <button
                                    onClick={() => togglePriceList(product._id)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    {expandedPriceLists[product._id] ? (
                                      <ChevronUp size={18} />
                                    ) : (
                                      <ChevronDown size={18} />
                                    )}
                                  </button>
                                )}
                            </td>
                            <td className="px-6 py-4">
                              {editingProduct?._id === product._id ? (
                                <input
                                  type="text"
                                  value={product.name}
                                  onChange={(e) =>
                                    handleInputChange(e, product._id, "name")
                                  }
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              ) : (
                                <div className="text-sm font-medium text-gray-900 break-words min-w-[200px] max-w-[300px]">
                                  {product.name}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <input
                                  type="text"
                                  value={product.barcode}
                                  onChange={(e) =>
                                    handleInputChange(e, product._id, "barcode")
                                  }
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              ) : (
                                <div className="text-sm text-gray-500 font-mono">
                                  {product.barcode}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <select
                                  value={product.brand || ""}
                                  onChange={(e) =>
                                    handleInputChange(e, product._id, "brand")
                                  }
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select Brand</option>
                                  {brands.map((brand) => (
                                    <option key={brand} value={brand}>
                                      {brand}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="text-sm text-gray-500">
                                  {product.brand || "-"}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <select
                                  value={product.category}
                                  onChange={(e) =>
                                    handleInputChange(
                                      e,
                                      product._id,
                                      "category",
                                    )
                                  }
                                  className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select Category</option>
                                  {categories.map((category) => (
                                    <option key={category} value={category}>
                                      {category}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {product.category || "-"}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-gray-500">
                                    ৳
                                  </span>
                                  <input
                                    type="number"
                                    value={product.dp || ""}
                                    onChange={(e) =>
                                      handleInputChange(e, product._id, "dp")
                                    }
                                    className="pl-6 pr-2 py-1 w-24 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              ) : (
                                <div className="text-sm text-gray-900">
                                  ৳{product.dp}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-gray-500">
                                    ৳
                                  </span>
                                  <input
                                    type="number"
                                    value={product.tp || ""}
                                    onChange={(e) =>
                                      handleInputChange(e, product._id, "tp")
                                    }
                                    className="pl-6 pr-2 py-1 w-24 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              ) : (
                                <div className="text-sm text-gray-900">
                                  ৳{product.tp}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingProduct?._id === product._id ? (
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-gray-500">
                                    ৳
                                  </span>
                                  <input
                                    type="number"
                                    value={product.mrp || ""}
                                    onChange={(e) =>
                                      handleInputChange(e, product._id, "mrp")
                                    }
                                    className="pl-6 pr-2 py-1 w-24 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-gray-900">
                                  ৳{product.mrp}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {editingProduct?._id === product._id ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingProduct(null)}
                                    className="text-gray-500 hover:text-gray-700"
                                  >
                                    <X size={18} />
                                  </button>
                                  <button
                                    onClick={() => saveUpdate(product)}
                                    disabled={updating}
                                    className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                                  >
                                    {updating ? (
                                      <Loader2
                                        size={18}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Check size={18} />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingProduct(product)}
                                  className="text-blue-600 hover:text-blue-900 disabled:text-gray-400"
                                  disabled={bulkUpdateMode}
                                  title={
                                    bulkUpdateMode
                                      ? "Finish bulk update first"
                                      : "Edit product"
                                  }
                                >
                                  <Pencil size={18} />
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Price List Row */}
                          {expandedPriceLists[product._id] &&
                            product.priceList && (
                              <tr className="bg-gray-50">
                                <td colSpan="9" className="px-6 py-4">
                                  <div className="ml-8">
                                    <h4 className="font-medium text-gray-700 mb-2">
                                      Outlet Specific Prices
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      {Object.entries(product.priceList).map(
                                        ([outlet, prices]) => (
                                          <div
                                            key={outlet}
                                            className="border p-3 rounded bg-white"
                                          >
                                            <h5 className="font-medium capitalize mb-2">
                                              {outlet}
                                            </h5>
                                            <div className="space-y-2">
                                              <div>
                                                <label className="text-xs text-gray-500">
                                                  DP Price
                                                </label>
                                                {editingProduct?._id ===
                                                product._id ? (
                                                  <input
                                                    type="number"
                                                    value={prices.dp || ""}
                                                    onChange={(e) =>
                                                      handlePriceListChange(
                                                        product._id,
                                                        outlet,
                                                        "dp",
                                                        e.target.value,
                                                      )
                                                    }
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                  />
                                                ) : (
                                                  <div className="text-sm">
                                                    ৳{prices.dp || "-"}
                                                  </div>
                                                )}
                                              </div>
                                              <div>
                                                <label className="text-xs text-gray-500">
                                                  TP Price
                                                </label>
                                                {editingProduct?._id ===
                                                product._id ? (
                                                  <input
                                                    type="number"
                                                    value={prices.tp || ""}
                                                    onChange={(e) =>
                                                      handlePriceListChange(
                                                        product._id,
                                                        outlet,
                                                        "tp",
                                                        e.target.value,
                                                      )
                                                    }
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                  />
                                                ) : (
                                                  <div className="text-sm">
                                                    ৳{prices.tp || "-"}
                                                  </div>
                                                )}
                                              </div>
                                              <div>
                                                <label className="text-xs text-gray-500">
                                                  MRP Price
                                                </label>
                                                {editingProduct?._id ===
                                                product._id ? (
                                                  <input
                                                    type="number"
                                                    value={prices.mrp || ""}
                                                    onChange={(e) =>
                                                      handlePriceListChange(
                                                        product._id,
                                                        outlet,
                                                        "mrp",
                                                        e.target.value,
                                                      )
                                                    }
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                  />
                                                ) : (
                                                  <div className="text-sm font-medium">
                                                    ৳{prices.mrp || "-"}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                        </>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="9"
                          className="px-6 py-4 text-center text-sm text-gray-500"
                        >
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlterProductsPage;
