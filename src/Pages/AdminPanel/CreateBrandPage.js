import { useState } from "react";
import axios from "axios";
import { PlusCircle } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../../Component/AdminSidebar";

const CreateBrandPage = () => {
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!brandName.trim()) {
      toast.error("Brand name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      await axios.post("http://175.29.181.245:15001/brands", {
        name: brandName,
      });
      toast.success("Brand created successfully!");
      setBrandName("");
    } catch (error) {
      console.error("Error creating brand:", error);
      toast.error(error.response?.data?.error || "Failed to create brand");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-4 w-full">
        <h2 className="text-2xl font-bold mb-6">Create New Brand</h2>

        <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Enter brand name"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              <PlusCircle size={18} />
              {loading ? "Creating..." : "Create Brand"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateBrandPage;
