import { useState, useEffect } from "react";
import axios from "axios";
import {
  Edit,
  Trash2,
  ArrowRight,
  X,
  Check,
  Loader,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../Component/AdminSidebar";

const AlterOutletsPage = () => {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentOutlet, setCurrentOutlet] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://175.29.181.245:15001/get-outlets-full",
      );
      setOutlets(response.data);
    } catch (error) {
      console.error("Error fetching outlets:", error);
      toast.error("Failed to load outlets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const handleTransfer = async () => {
    if (!selectedSource || !selectedTarget) {
      toast.error("Please select both source and target outlets");
      return;
    }

    if (selectedSource === selectedTarget) {
      toast.error("Source and target outlets cannot be the same");
      return;
    }

    try {
      setIsTransferring(true);
      const response = await axios.post(
        "http://175.29.181.245:15001/transfer-outlet-stock",
        {
          sourceOutlet: selectedSource,
          targetOutlet: selectedTarget,
        },
      );

      toast.success(response.data.message);
      setTransferMode(false);
      setSelectedSource("");
      setSelectedTarget("");
      fetchOutlets();
    } catch (error) {
      console.error("Transfer failed:", error);
      toast.error(error.response?.data?.message || "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };

  const handleEdit = (outlet) => {
    setEditMode(true);
    setCurrentOutlet({
      ...outlet,
      originalOutletName: outlet.outlet_name,
    });
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      await axios.put(
        `http://175.29.181.245:15001/update-outlet/${currentOutlet.originalOutletName}`,
        {
          name: currentOutlet.outlet_name,
          proprietorName: currentOutlet.proprietor_name,
          address: currentOutlet.address,
          contactNumber: currentOutlet.contact_number,
          nidNumber: currentOutlet.nid_number,
          binNumber: currentOutlet.bin_number,
          tinNumber: currentOutlet.tin_number,
          attachment: currentOutlet.attachment,
        },
      );
      toast.success("Outlet updated successfully");
      setEditMode(false);
      setCurrentOutlet(null);
      fetchOutlets();
    } catch (error) {
      console.error("Update failed:", error);
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (outletName) => {
    try {
      setLoading(true);
      const response = await axios.delete(
        `http://175.29.181.245:15001/delete-outlet/${outletName}`,
      );
      toast.success(response.data.message);
      setDeleteConfirm(null);
      fetchOutlets();
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error(error.response?.data?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (outletName) => {
    if (window.confirm(`Are you sure you want to delete ${outletName}?`)) {
      handleDelete(outletName);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Manage Outlets</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTransferMode(!transferMode)}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  transferMode
                    ? "bg-gray-500 hover:bg-gray-600"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white`}
              >
                {transferMode ? (
                  <>
                    <X size={18} /> Cancel Transfer
                  </>
                ) : (
                  <>
                    <ArrowRight size={18} /> Transfer Stock
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Outlet Table */}
          <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
            {loading && !editMode ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : outlets?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No outlets found</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 border-b font-medium">Outlet Name</th>
                    <th className="p-3 border-b font-medium">Proprietor</th>
                    <th className="p-3 border-b font-medium">Contact</th>
                    <th className="p-3 border-b font-medium">Address</th>
                    <th className="p-3 border-b font-medium">NID</th>
                    <th className="p-3 border-b font-medium">Status</th>
                    <th className="p-3 border-b font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outlets.map((outlet) => (
                    <tr key={outlet._id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{outlet.outlet_name}</td>
                      <td className="p-3 border-b">{outlet.proprietor_name}</td>
                      <td className="p-3 border-b">{outlet.contact_number}</td>
                      <td className="p-3 border-b text-sm">
                        {outlet?.address?.length > 30
                          ? `${outlet.address.substring(0, 30)}...`
                          : outlet.address}
                      </td>
                      <td className="p-3 border-b">{outlet.nid_number}</td>
                      <td className="p-3 border-b">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Active
                        </span>
                      </td>
                      <td className="p-3 border-b">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(outlet)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => confirmDelete(outlet.outlet_name)}
                            disabled={loading}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            {loading ? (
                              <Loader className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal - Centered on screen */}
      {editMode && currentOutlet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Edit size={20} /> Edit Outlet
              </h3>
              <button
                onClick={() => setEditMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outlet Name *
                </label>
                <input
                  type="text"
                  value={currentOutlet.outlet_name}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      outlet_name: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proprietor Name *
                </label>
                <input
                  type="text"
                  value={currentOutlet.proprietor_name}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      proprietor_name: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4 col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  value={currentOutlet.address}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      address: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  value={currentOutlet.contact_number}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      contact_number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NID Number *
                </label>
                <input
                  type="text"
                  value={currentOutlet.nid_number}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      nid_number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BIN Number
                </label>
                <input
                  type="text"
                  value={currentOutlet.bin_number || ""}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      bin_number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TIN Number
                </label>
                <input
                  type="text"
                  value={currentOutlet.tin_number || ""}
                  onChange={(e) =>
                    setCurrentOutlet({
                      ...currentOutlet,
                      tin_number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mb-4 col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attachment
                </label>
                <div className="flex items-center gap-4">
                  {currentOutlet.attachment && (
                    <div className="relative">
                      <img
                        src={currentOutlet.attachment}
                        alt="Outlet attachment"
                        className="h-20 w-20 object-cover rounded-md border"
                      />
                      <button
                        onClick={() =>
                          setCurrentOutlet({
                            ...currentOutlet,
                            attachment: null,
                          })
                        }
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <label className="flex-1">
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setCurrentOutlet({
                              ...currentOutlet,
                              attachment: event.target.result,
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      accept="image/*"
                    />
                    <div className="w-full p-2 border rounded-md flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-700">
                      <Upload size={16} className="mr-2" />
                      {currentOutlet.attachment
                        ? "Change Image"
                        : "Upload Image"}
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:bg-blue-400 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  "Update Outlet"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Transfer Modal - Centered on screen */}
      {transferMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ArrowRight size={20} /> Transfer Outlet Stock
              </h3>
              <button
                onClick={() => setTransferMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Outlet (Source)
                </label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source outlet</option>
                  {outlets.map((outlet) => (
                    <option
                      key={`source-${outlet._id}`}
                      value={outlet.outlet_name}
                    >
                      {outlet.outlet_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Outlet (Target)
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select target outlet</option>
                  {outlets
                    .filter((outlet) => outlet.outlet_name !== selectedSource)
                    .map((outlet) => (
                      <option
                        key={`target-${outlet._id}`}
                        value={outlet.outlet_name}
                      >
                        {outlet.outlet_name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleTransfer}
              disabled={isTransferring || !selectedSource || !selectedTarget}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:bg-gray-400 flex items-center gap-2"
            >
              {isTransferring ? "Transferring..." : "Confirm Transfer"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlterOutletsPage;
