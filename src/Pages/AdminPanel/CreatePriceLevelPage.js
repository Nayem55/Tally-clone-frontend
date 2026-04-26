import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { PlusCircle, X } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../../Component/AdminSidebar";

const CreatePriceLevelPage = () => {
  const [newPriceLevel, setNewPriceLevel] = useState({
    name: "",
    displayName: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPriceLevel((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPriceLevel.name || !newPriceLevel.displayName) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Create the new price level
      await axios.post(
        "http://175.29.181.245:15001/api/pricelevels",
        newPriceLevel,
      );

      toast.success("Price level created successfully");

      // Step 2: Update all products with the new price level
      try {
        toast.loading("Adding price level to all products...");
        await axios.put(
          "http://175.29.181.245:15001/update-products-with-new-pricelevel",
          {
            priceLevelName: newPriceLevel.name,
          },
        );
        toast.dismiss();
        toast.success(`Added ${newPriceLevel.displayName} to all products`);
      } catch (updateError) {
        console.error("Error updating products:", updateError);
        toast.error("Price level created but failed to update all products");
      }

      navigate("/admin/alter-pricelevels");
    } catch (error) {
      console.error("Error creating price level:", error);
      toast.error(
        error.response?.data?.error || "Failed to create price level",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Create New Price Level</h2>
            <button
              onClick={() => navigate("/admin/alter-pricelevels")}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Level Code (e.g., "mt")
              </label>
              <input
                type="text"
                name="name"
                value={newPriceLevel.name}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter code (e.g., mt)"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name (e.g., "Modern Trade")
              </label>
              <input
                type="text"
                name="displayName"
                value={newPriceLevel.displayName}
                onChange={handleInputChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter display name"
                required
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? (
                  <span className="animate-pulse">Creating...</span>
                ) : (
                  <>
                    <PlusCircle size={18} />
                    Create Price Level
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePriceLevelPage;
