import { useState } from "react";
import axios from "axios";
import { PlusCircle, Upload } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../Component/AdminSidebar";

const CreateOutletPage = () => {
  const [newOutlet, setNewOutlet] = useState({
    name: "",
    proprietorName: "",
    address: "",
    contactNumber: "",
    nidNumber: "",
    binNumber: "",
    tinNumber: "",
    attachment: "",
  });
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (file, fieldName) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "ebay-memo");

      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/dodxop7lz/image/upload",
        formData,
      );

      setNewOutlet((prev) => ({
        ...prev,
        [fieldName]: response.data.secure_url,
      }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newOutlet.name.trim()) {
      toast.error("Outlet name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        "http://175.29.181.245:15001/add-new-outlet",
        newOutlet,
      );

      toast.success(response.data.message || "Outlet created successfully!");
      setNewOutlet({
        name: "",
        proprietorName: "",
        address: "",
        contactNumber: "",
        nidNumber: "",
        binNumber: "",
        tinNumber: "",
        attachment: "",
      });
    } catch (error) {
      console.error("Error creating outlet:", error);
      toast.error(error.response?.data?.message || "Failed to create outlet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="p-4 w-full">
        <h2 className="text-2xl font-bold mb-6">Create New Outlet</h2>

        <div className="bg-white p-6 rounded-lg shadow-md max-w-3xl">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Outlet Name *
                </label>
                <input
                  type="text"
                  value={newOutlet.name}
                  onChange={(e) =>
                    setNewOutlet({ ...newOutlet, name: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter outlet name"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Proprietor Name *
                </label>
                <input
                  type="text"
                  value={newOutlet.proprietorName}
                  onChange={(e) =>
                    setNewOutlet({
                      ...newOutlet,
                      proprietorName: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter proprietor name"
                  required
                />
              </div>

              <div className="mb-4 col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Address *
                </label>
                <textarea
                  value={newOutlet.address}
                  onChange={(e) =>
                    setNewOutlet({ ...newOutlet, address: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter full address"
                  rows={3}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  value={newOutlet.contactNumber}
                  onChange={(e) =>
                    setNewOutlet({
                      ...newOutlet,
                      contactNumber: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter contact number"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  NID Number *
                </label>
                <input
                  type="text"
                  value={newOutlet.nidNumber}
                  onChange={(e) =>
                    setNewOutlet({ ...newOutlet, nidNumber: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter NID number"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  BIN Number
                </label>
                <input
                  type="text"
                  value={newOutlet.binNumber}
                  onChange={(e) =>
                    setNewOutlet({ ...newOutlet, binNumber: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter BIN number"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  TIN Number
                </label>
                <input
                  type="text"
                  value={newOutlet.tinNumber}
                  onChange={(e) =>
                    setNewOutlet({ ...newOutlet, tinNumber: e.target.value })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter TIN number"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Attachment
                </label>
                <input
                  type="file"
                  onChange={(e) =>
                    handleImageUpload(e.target.files[0], "attachment")
                  }
                  className="w-full p-2 border rounded hidden"
                  id="attachment"
                />
                <label
                  htmlFor="attachment"
                  className="w-full p-2 border rounded flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100"
                >
                  <Upload size={16} className="mr-2" />
                  {newOutlet.attachment ? "Change Image" : "Upload Attachment"}
                </label>
                {newOutlet.attachment && (
                  <div className="mt-2">
                    <img
                      src={newOutlet.attachment}
                      alt="Attachment "
                      className="h-20 border rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 disabled:bg-blue-400"
            >
              <PlusCircle size={18} />
              {loading ? "Creating..." : "Create Outlet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateOutletPage;
