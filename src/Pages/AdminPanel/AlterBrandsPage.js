import { useState, useEffect } from "react";
import axios from "axios";
import { Edit3 } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../../Component/AdminSidebar";

const AlterBrandsPage = () => {
  const [brands, setBrands] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingProducts, setUpdatingProducts] = useState(false);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/all-brands",
      );
      setBrands(response.data);
    } catch (error) {
      console.error("Error fetching brands:", error);
      toast.error("Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id, oldName) => {
    if (!editedName.trim()) {
      toast.error("Brand name cannot be empty");
      return;
    }

    if (editedName === oldName) {
      setEditingId(null);
      return;
    }

    try {
      setLoading(true);
      setUpdatingProducts(true);

      // 1. First update the brand name
      await axios.put(`http://175.29.181.245:15001/brands/${id}`, {
        name: editedName,
      });

      // 2. Then update all products with this brand
      await axios.put("http://175.29.181.245:15001/update-products-brand", {
        oldBrand: oldName,
        newBrand: editedName,
      });

      toast.success("Brand and related products updated successfully!");
      setEditingId(null);
      fetchBrands();
    } catch (error) {
      console.error("Error updating brand:", error);
      toast.error(error.response?.data?.error || "Failed to update brand");
    } finally {
      setLoading(false);
      setUpdatingProducts(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-4 w-full">
        <h2 className="text-2xl font-bold mb-6">Manage Brands</h2>

        <div className="bg-white p-6 rounded-lg shadow-md">
          {loading && !updatingProducts ? (
            <p>Loading brands...</p>
          ) : brands.length === 0 ? (
            <p>No brands found</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Brand Name</th>
                  <th className="border p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand._id} className="hover:bg-gray-50">
                    <td className="border p-2">
                      {editingId === brand._id ? (
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full p-2 border rounded"
                          disabled={updatingProducts}
                        />
                      ) : (
                        brand.name
                      )}
                    </td>
                    <td className="border p-2">
                      {editingId === brand._id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(brand._id, brand.name)}
                            disabled={updatingProducts}
                            className={`px-3 py-1 rounded ${
                              updatingProducts
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-green-600 text-white"
                            }`}
                          >
                            {updatingProducts ? "Updating..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditedName("");
                            }}
                            disabled={updatingProducts}
                            className="bg-gray-300 px-3 py-1 rounded disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(brand._id);
                            setEditedName(brand.name);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                          disabled={updatingProducts}
                        >
                          <Edit3 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {updatingProducts && (
            <div className="mt-4 text-sm text-gray-600">
              Updating products with new brand name...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlterBrandsPage;
