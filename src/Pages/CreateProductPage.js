import { useEffect, useState } from "react";
import axios from "axios";
import { PlusCircle, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../Component/AdminSidebar";

// Reusable Input Component
const InputField = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
  step,
  className = "",
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium mb-1">{label}</label>
    <input
      type={type}
      value={value || ""}
      onChange={onChange}
      className={`w-full p-2 border rounded ${className}`}
      placeholder={placeholder}
      required={required}
      min={min}
      step={step}
    />
  </div>
);

// Reusable Select Component
const SelectField = ({
  label,
  value,
  onChange,
  options,
  loading,
  onAddNew,
  required = false,
}) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
      <label className="block text-sm font-medium">{label}</label>
      {onAddNew && (
        <button
          type="button"
          onClick={onAddNew}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <PlusCircle size={14} /> Add New
        </button>
      )}
    </div>
    {loading ? (
      <select className="w-full p-2 border rounded bg-gray-100" disabled>
        <option>Loading...</option>
      </select>
    ) : (
      <select
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded"
        required={required}
      >
        <option value="">Select {label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )}
  </div>
);

// Reusable Modal Component
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const CreateProductPage = () => {
  const [priceLevels, setPriceLevels] = useState([]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    barcode: "",
    dp: 0,
    tp: 0,
    mrp: 0,
    category: "",
    brand: "",
    priceList: {},
  });

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [fetchingData, setFetchingData] = useState({
    categories: false,
    brands: false,
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showNewOutletModal, setShowNewOutletModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newOutletName, setNewOutletName] = useState("");
  const [showPriceList, setShowPriceList] = useState(false);

  const fetchCategories = async () => {
    try {
      setFetchingData((prev) => ({ ...prev, categories: true }));
      const response = await axios.get(
        "http://175.29.181.245:15001/categories",
      );
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setFetchingData((prev) => ({ ...prev, categories: false }));
    }
  };

  const fetchBrands = async () => {
    try {
      setFetchingData((prev) => ({ ...prev, brands: true }));
      const response = await axios.get("http://175.29.181.245:15001/brands");
      setBrands(response.data);
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast.error("Failed to load brands");
    } finally {
      setFetchingData((prev) => ({ ...prev, brands: false }));
    }
  };

  const fetchPriceLevels = async () => {
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/api/pricelevels",
      );
      const namesArray = response.data.map((level) => level.name);
      setPriceLevels(namesArray);

      // Initialize priceList with default outlets
      setNewProduct((prev) => ({
        ...prev,
        priceList: Object.fromEntries(
          namesArray.map((outlet) => [outlet, { tp: 0, dp: 0, mrp: 0 }]),
        ),
      }));
    } catch (error) {
      console.error("Error fetching price levels:", error);
      toast.error("Failed to load price levels");
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchPriceLevels();
    fetchBrands();
  }, []);

  const createProductWithStocks = async () => {
    try {
      setLoading(true);
      const productToSend = {
        ...newProduct,
        dp: Number(newProduct.dp),
        tp: Number(newProduct.tp),
        mrp: Number(newProduct.mrp),
        priceList: Object.fromEntries(
          Object.entries(newProduct.priceList).map(([outlet, prices]) => [
            outlet,
            {
              dp: Number(prices.dp || 0),
              tp: Number(prices.tp || 0),
              mrp: Number(prices.mrp || 0),
            },
          ]),
        ),
      };

      await axios.post(
        "http://175.29.181.245:15001/create-product-with-stocks",
        {
          productData: productToSend,
        },
      );

      toast.success("Product created with outlet stocks initialized!");
      setNewProduct({
        name: "",
        barcode: "",
        dp: 0,
        tp: 0,
        mrp: 0,
        category: "",
        brand: "",
        priceList: Object.fromEntries(
          priceLevels.map((outlet) => [outlet, { tp: 0, dp: 0, mrp: 0 }]),
        ),
      });
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(error.response?.data?.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }
    try {
      setLoading(true);
      await axios.post("http://175.29.181.245:15001/categories", {
        name: newCategory,
      });
      toast.success("Category created successfully!");
      setNewCategory("");
      setShowCategoryModal(false);
      await fetchCategories();
      setNewProduct((prev) => ({ ...prev, category: newCategory }));
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async (e) => {
    e.preventDefault();
    if (!newBrand.trim()) {
      toast.error("Brand name cannot be empty");
      return;
    }
    try {
      setLoading(true);
      await axios.post("http://175.29.181.245:15001/brands", {
        name: newBrand,
      });
      toast.success("Brand created successfully!");
      setNewBrand("");
      setShowBrandModal(false);
      await fetchBrands();
      setNewProduct((prev) => ({ ...prev, brand: newBrand }));
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create brand");
    } finally {
      setLoading(false);
    }
  };

  const handlePriceListChange = (outlet, field, value) => {
    setNewProduct((prev) => ({
      ...prev,
      priceList: {
        ...prev.priceList,
        [outlet]: {
          ...prev.priceList[outlet],
          [field]: Number(value) || 0,
        },
      },
    }));
  };

  const handleAddOutlet = (e) => {
    e.preventDefault();
    if (!newOutletName.trim()) {
      toast.error("Outlet name cannot be empty");
      return;
    }

    const outletKey = newOutletName.toLowerCase().replace(/\s+/g, "_");
    if (outletKey in newProduct.priceList) {
      toast.error("This outlet already exists");
      return;
    }

    setNewProduct((prev) => ({
      ...prev,
      priceList: {
        ...prev.priceList,
        [outletKey]: { tp: 0, dp: 0, mrp: 0 },
      },
    }));

    setNewOutletName("");
    setShowNewOutletModal(false);
    toast.success(`Outlet "${newOutletName}" added`);
  };

  const handleRemoveOutlet = (outlet) => {
    if (priceLevels.includes(outlet)) {
      toast.error("Cannot remove default outlet");
      return;
    }

    const { [outlet]: _, ...rest } = newProduct.priceList;
    setNewProduct((prev) => ({ ...prev, priceList: rest }));
    toast.success(`Outlet removed`);
  };

  const allOutlets = [
    ...priceLevels,
    ...Object.keys(newProduct.priceList).filter(
      (o) => !priceLevels.includes(o),
    ),
  ];

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-6 w-full bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800">
            Create New Product
          </h2>
        </div>

        {/* Modals */}
        {showCategoryModal && (
          <Modal
            title="Create New Category"
            onClose={() => setShowCategoryModal(false)}
          >
            <form onSubmit={handleCreateCategory}>
              <InputField
                label="Category Name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Enter category name"
                required
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusCircle size={18} /> {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {showBrandModal && (
          <Modal
            title="Create New Brand"
            onClose={() => setShowBrandModal(false)}
          >
            <form onSubmit={handleCreateBrand}>
              <InputField
                label="Brand Name"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Enter brand name"
                required
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowBrandModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusCircle size={18} /> {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {showNewOutletModal && (
          <Modal
            title="Add New Outlet / Price Level"
            onClose={() => setShowNewOutletModal(false)}
          >
            <form onSubmit={handleAddOutlet}>
              <InputField
                label="Outlet Name"
                value={newOutletName}
                onChange={(e) => setNewOutletName(e.target.value)}
                placeholder="e.g., Warehouse, Online Store"
                required
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowNewOutletModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusCircle size={18} /> Add Outlet
                </button>
              </div>
            </form>
          </Modal>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField
              label="Product Name"
              value={newProduct.name}
              onChange={(e) =>
                setNewProduct({ ...newProduct, name: e.target.value })
              }
              placeholder="Enter product name"
              required
            />
            <InputField
              label="Barcode"
              value={newProduct.barcode}
              onChange={(e) =>
                setNewProduct({ ...newProduct, barcode: e.target.value })
              }
              placeholder="Enter barcode"
              required
            />
            <SelectField
              label="Category"
              value={newProduct.category}
              onChange={(e) =>
                setNewProduct({ ...newProduct, category: e.target.value })
              }
              options={categories}
              loading={fetchingData.categories}
              onAddNew={() => setShowCategoryModal(true)}
              required
            />
            <SelectField
              label="Brand"
              value={newProduct.brand}
              onChange={(e) =>
                setNewProduct({ ...newProduct, brand: e.target.value })
              }
              options={brands}
              loading={fetchingData.brands}
              onAddNew={() => setShowBrandModal(true)}
              required
            />
            <InputField
              label="Default DP Price"
              type="number"
              value={newProduct.dp || ""}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  dp: Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <InputField
              label="Default TP Price"
              type="number"
              value={newProduct.tp || ""}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  tp: Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <InputField
              label="Default MRP Price"
              type="number"
              value={newProduct.mrp || ""}
              onChange={(e) =>
                setNewProduct({
                  ...newProduct,
                  mrp: Number(e.target.value) || 0,
                })
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          {/* Outlet Specific Prices - Now in Table Format */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={() => setShowPriceList(!showPriceList)}
                className="text-lg font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2"
              >
                {showPriceList ? "Hide" : "Show"} Outlet-Specific Prices
              </button>
              {showPriceList && (
                <button
                  type="button"
                  onClick={() => setShowNewOutletModal(true)}
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-2 font-medium"
                >
                  <PlusCircle size={20} /> Add Custom Outlet
                </button>
              )}
            </div>

            {showPriceList && allOutlets.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full min-w-max table-auto border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      <th className="px-6 py-4">Outlet / Price Level</th>
                      <th className="px-6 py-4 text-center">DP Price</th>
                      <th className="px-6 py-4 text-center">TP Price</th>
                      <th className="px-6 py-4 text-center">MRP Price</th>
                      <th className="px-6 py-4 text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allOutlets.map((outlet) => {
                      const isDefault = priceLevels.includes(outlet);
                      const displayName = outlet
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <tr
                          key={outlet}
                          className="hover:bg-gray-50 transition"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                            {displayName}
                            {isDefault && (
                              <span className="ml-2 text-xs text-gray-500 font-normal">
                                (Default)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={newProduct.priceList[outlet]?.dp || ""}
                              onChange={(e) =>
                                handlePriceListChange(
                                  outlet,
                                  "dp",
                                  e.target.value,
                                )
                              }
                              className="w-full text-center border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={newProduct.priceList[outlet]?.tp || ""}
                              onChange={(e) =>
                                handlePriceListChange(
                                  outlet,
                                  "tp",
                                  e.target.value,
                                )
                              }
                              className="w-full text-center border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={newProduct.priceList[outlet]?.mrp || ""}
                              onChange={(e) =>
                                handlePriceListChange(
                                  outlet,
                                  "mrp",
                                  e.target.value,
                                )
                              }
                              className="w-full text-center border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                              min="0"
                              step="0.01"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {!isDefault ? (
                              <button
                                onClick={() => handleRemoveOutlet(outlet)}
                                className="text-red-600 hover:text-red-800 transition"
                                title="Remove outlet"
                              >
                                <Trash2 size={18} />
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showPriceList && allOutlets.length === 0 && (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                No outlets configured yet. Add a custom outlet to set specific
                prices.
              </div>
            )}
          </div>

          <div className="mt-10 flex justify-end">
            <button
              onClick={createProductWithStocks}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg flex items-center gap-3 shadow-md transition disabled:opacity-70"
            >
              <PlusCircle size={22} />
              {loading ? "Creating Product..." : "Create Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProductPage;
