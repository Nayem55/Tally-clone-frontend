import { useEffect, useState } from "react";
import axios from "axios";
import {
  Pencil,
  Trash2,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import AdminSidebar from "../../Component/AdminSidebar";
import toast from "react-hot-toast";

const API_URL = "http://175.29.181.245:15001/products";

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    barcode: "",
    dp: "",
    tp: "",
    mrp: "",
    category: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [bulkUpdateFields, setBulkUpdateFields] = useState({
    dp: "",
    tp: "",
    mrp: "",
  });
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Fetch Products and Categories
  useEffect(() => {
    fetchProducts(currentPage);
    fetchCategories();
  }, [currentPage]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/product-categories",
      );
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const handleSearch = async () => {
    setProducts([]);
    setLoading(true);
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/search-product",
        {
          params: {
            search: searchQuery,
            type: "name",
          },
        },
      );
      setProducts(response.data);
    } catch (error) {
      console.error("Error searching products:", error);
    }
    setLoading(false);
  };

  const fetchProducts = async (page) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}?page=${page}`);
      setProducts(res.data.products);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e, id, field) => {
    const updatedProducts = products.map((product) =>
      product._id === id ? { ...product, [field]: e.target.value } : product,
    );
    setProducts(updatedProducts);
  };

  const saveUpdate = async (product) => {
    setUpdating(true);
    try {
      await axios.put(`${API_URL}/${product._id}`, product);
      if (editingProduct && editingProduct.barcode !== product.barcode) {
        await axios.put(`http://175.29.181.245:15001/update-outlet-barcode`, {
          oldBarcode: editingProduct.barcode,
          newBarcode: product.barcode,
        });
      }
      setEditingProduct(null);
      toast.success("Product updated successfully");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Product update failed");
    } finally {
      setUpdating(false);
    }
  };

  const deleteProduct = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      setProducts(products.filter((product) => product._id !== id));
      toast.success("Product deleted successfully");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
    }
  };

  const addProduct = async () => {
    try {
      const res = await axios.post(API_URL, newProduct);
      setProducts([...products, res.data]);
      setShowModal(false);
      setNewProduct({
        name: "",
        barcode: "",
        dp: "",
        tp: "",
        mrp: "",
        category: "",
      });
      toast.success("Product added successfully");
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Failed to add product");
    }
  };

  const handleBulkCategoryUpdate = async () => {
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    try {
      setIsBulkUpdating(true);
      const response = await axios.put(
        "http://175.29.181.245:15001/category-bulk-update",
        {
          category: selectedCategory,
          updateFields: {
            dp: bulkUpdateFields.dp,
            tp: bulkUpdateFields.tp,
            mrp: bulkUpdateFields.mrp,
          },
        },
      );

      toast.success(response.data.message);
      fetchProducts(currentPage);
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error("Failed to update category products");
    } finally {
      setIsBulkUpdating(false);
      setBulkUpdateFields({ dp: "", tp: "", mrp: "" });
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-4 w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Manage Products</h2>
          <div className="mb-4">
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded p-2 w-[400px] border-r-0"
              placeholder="Search products..."
            />
            <button
              onClick={handleSearch}
              className="bg-black text-white p-2 border border-black rounded border-l-0"
            >
              Search
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <PlusCircle size={18} /> Add Product
          </button>
        </div>

        {/* Category Bulk Update Section */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-3">
            Bulk Update by Category
          </h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1">
              <label className="font-medium">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border rounded p-2 w-full mt-4"
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
              <label className="font-medium">DP:</label>
              <input
                type="number"
                value={bulkUpdateFields.dp}
                onChange={(e) =>
                  setBulkUpdateFields({
                    ...bulkUpdateFields,
                    dp: e.target.value,
                  })
                }
                className="border rounded p-2 w-full"
                placeholder="DP Price"
              />
            </div>

            <div>
              <label className="font-medium">TP:</label>
              <input
                type="number"
                value={bulkUpdateFields.tp}
                onChange={(e) =>
                  setBulkUpdateFields({
                    ...bulkUpdateFields,
                    tp: e.target.value,
                  })
                }
                className="border rounded p-2 w-full"
                placeholder="TP Price"
              />
            </div>

            <div>
              <label className="font-medium">MRP:</label>
              <input
                type="number"
                value={bulkUpdateFields.mrp}
                onChange={(e) =>
                  setBulkUpdateFields({
                    ...bulkUpdateFields,
                    mrp: e.target.value,
                  })
                }
                className="border rounded p-2 w-full"
                placeholder="MRP Price"
              />
            </div>

            <button
              onClick={handleBulkCategoryUpdate}
              disabled={isBulkUpdating || !selectedCategory}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {isBulkUpdating ? "Updating..." : "Update Category"}
            </button>
          </div>
        </div>

        {/* Product Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg shadow-md">
            <thead className="bg-gray-200 text-left">
              <tr>
                <th className="border p-2">Name</th>
                <th className="border p-2">Barcode</th>
                <th className="border p-2">Category</th>
                <th className="border p-2">Price (DP)</th>
                <th className="border p-2">Price (TP)</th>
                <th className="border p-2">Price (MRP)</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id} className="hover:bg-gray-100">
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "name")
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      product.name
                    )}
                  </td>
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <input
                        type="text"
                        value={product.barcode}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "barcode")
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      product.barcode
                    )}
                  </td>
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <select
                        value={product.category}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "category")
                        }
                        className="border p-1 w-full"
                      >
                        <option value="">Select Category</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    ) : (
                      product.category || "-"
                    )}
                  </td>
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <input
                        type="number"
                        value={product.dp}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "dp")
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      `${product.dp} BDT`
                    )}
                  </td>
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <input
                        type="number"
                        value={product.tp}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "tp")
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      `${product.tp} BDT`
                    )}
                  </td>
                  <td className="border p-2">
                    {editingProduct?._id === product._id ? (
                      <input
                        type="number"
                        value={product.mrp}
                        onChange={(e) =>
                          handleInputChange(e, product._id, "mrp")
                        }
                        className="border p-1 w-full"
                      />
                    ) : (
                      `${product.mrp} BDT`
                    )}
                  </td>

                  <td className="border p-2 flex gap-2">
                    {editingProduct?._id === product._id ? (
                      <button
                        onClick={() => saveUpdate(product)}
                        disabled={updating}
                        className="bg-green-500 text-white px-3 py-1 rounded-md"
                      >
                        {updating ? (
                          <svg
                            className="animate-spin h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            ></path>
                          </svg>
                        ) : (
                          "Save"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="text-blue-500"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteProduct(product._id)}
                      className="text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-center items-center gap-4 mt-4">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-md ${
              currentPage === 1
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-md ${
              currentPage === totalPages
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white"
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Add Product Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Add New Product</h3>
              <input
                type="text"
                placeholder="Product Name"
                className="w-full border p-2 mb-2"
                value={newProduct.name}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, name: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Product barcode"
                className="w-full border p-2 mb-2"
                value={newProduct.barcode}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, barcode: e.target.value })
                }
              />
              <select
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category: e.target.value })
                }
                className="w-full border p-2 mb-2"
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Price (DP)"
                className="w-full border p-2 mb-2"
                value={newProduct.dp}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, dp: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Price (TP)"
                className="w-full border p-2 mb-2"
                value={newProduct.tp}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, tp: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Price (MRP)"
                className="w-full border p-2 mb-2"
                value={newProduct.mrp}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, mrp: e.target.value })
                }
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={addProduct}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProducts;
