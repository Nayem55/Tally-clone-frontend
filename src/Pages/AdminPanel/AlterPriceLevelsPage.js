import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Edit3, Trash2, PlusCircle, X, Save } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../../Component/AdminSidebar";

const AlterPriceLevelsPage = () => {
  const [priceLevels, setPriceLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    displayName: "",
    originalName: "", // Store original name for reference
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const fetchPriceLevels = async () => {
      try {
        const response = await axios.get(
          "http://175.29.181.245:15001/api/pricelevels",
        );
        setPriceLevels(response.data);
      } catch (error) {
        console.error("Error fetching price levels:", error);
        toast.error("Failed to load price levels");
      } finally {
        setLoading(false);
      }
    };

    fetchPriceLevels();
  }, []);

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${name}"? This will remove it from all products.`,
      )
    )
      return;

    try {
      setDeletingId(id);

      // First delete from price levels
      await axios.delete(`http://175.29.181.245:15001/api/pricelevels/${name}`);

      // Then remove from all products
      toast.loading(`Removing ${name} from all products...`);
      await axios.put(
        "http://175.29.181.245:15001/remove-pricelevel-from-products",
        {
          priceLevelName: name,
        },
      );
      toast.dismiss();

      setPriceLevels((prev) => prev.filter((pl) => pl._id !== id));
      toast.success("Price level deleted from all products successfully");
    } catch (error) {
      console.error("Error deleting price level:", error);
      toast.error(
        error.response?.data?.error || "Failed to delete price level",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (priceLevel) => {
    setEditingId(priceLevel._id);
    setEditForm({
      name: priceLevel.name,
      displayName: priceLevel.displayName,
      originalName: priceLevel.name, // Store original name
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveEdit = async (id) => {
    if (!editForm.displayName) {
      toast.error("Display name cannot be empty");
      return;
    }

    try {
      setEditLoading(true);

      // First update the price level itself
      await axios.put(
        `http://175.29.181.245:15001/api/pricelevels/${editForm.originalName}`,
        {
          name: editForm.name,
          displayName: editForm.displayName,
        },
      );

      // If the name changed, update all products
      if (editForm.name !== editForm.originalName) {
        toast.loading(`Updating price level name in all products...`);
        await axios.put(
          "http://175.29.181.245:15001/update-pricelevel-in-products",
          {
            oldName: editForm.originalName,
            newName: editForm.name,
            newDisplayName: editForm.displayName,
          },
        );
        toast.dismiss();
      }

      setPriceLevels((prev) =>
        prev.map((pl) =>
          pl._id === id
            ? {
                ...pl,
                name: editForm.name,
                displayName: editForm.displayName,
              }
            : pl,
        ),
      );

      toast.success("Price level updated in all products successfully");
      setEditingId(null);
    } catch (error) {
      console.error("Error updating price level:", error);
      toast.error(
        error.response?.data?.error || "Failed to update price level",
      );
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Manage Price Levels</h2>
          <Link
            to="/admin/create-pricelevel"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusCircle size={18} />
            Add New
          </Link>
        </div>

        {loading && priceLevels.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {priceLevels.length > 0 ? (
                  priceLevels.map((level) => (
                    <tr key={level._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === level._id ? (
                          <input
                            type="text"
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                            disabled={editLoading}
                          />
                        ) : (
                          <div className="text-sm font-medium text-gray-900">
                            {level.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingId === level._id ? (
                          <input
                            type="text"
                            name="displayName"
                            value={editForm.displayName}
                            onChange={handleEditChange}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                            disabled={editLoading}
                          />
                        ) : (
                          <div className="text-sm text-gray-500">
                            {level.displayName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingId === level._id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditing}
                              className="text-gray-500 hover:text-gray-700 p-1"
                              title="Cancel"
                              disabled={editLoading}
                            >
                              <X size={18} />
                            </button>
                            <button
                              onClick={() => saveEdit(level._id)}
                              disabled={editLoading}
                              className="text-green-600 hover:text-green-800 disabled:text-gray-400 p-1"
                              title="Save"
                            >
                              {editLoading ? (
                                <span className="animate-pulse">Saving...</span>
                              ) : (
                                <Save size={18} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEditing(level)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="Edit"
                              disabled={deletingId === level._id}
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(level._id, level.name)
                              }
                              disabled={deletingId === level._id}
                              className="text-red-600 hover:text-red-900 disabled:text-gray-400 p-1"
                              title="Delete"
                            >
                              {deletingId === level._id ? (
                                <span className="animate-pulse">
                                  Deleting...
                                </span>
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No price levels found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlterPriceLevelsPage;
