import { useState, useEffect } from "react";
import axios from "axios";
import { PlusCircle, X, Upload, ChevronDown, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../Component/AdminSidebar";

const CreateUserPage = () => {
  // Static mapping of zones to RSMs and SOMs
  const zoneMappings = {
    "ZONE-01": {
      rsm: "MD. AL-AMIN ",
      som: "MD. NAZMUS SAKIB",
    },
    "ZONE-03": {
      rsm: "MD JANANGIR ALAM",
      som: "ASADUL HOQUE RIPON",
    },
  };

  const [newUser, setNewUser] = useState({
    name: "",
    number: "",
    password: "",
    role: "",
    group: "",
    zone: "",
    outlet: "",
    pricelabel: "",
    asm: "",
    rsm: "",
    som: "",
    nidType: "NID",
    nidNumber: "",
    dateOfBirth: "",
    bloodGroup: "",
    maritalStatus: "",
    spouseName: "",
    marriageDate: "",
    presentAddress: "",
    educationalQualification: "",
    joiningDate: "",
    presentSalary: "",
    personalMobileNumber: "",
    familyContactNumber: "",
    relationWithContactPerson: "",
  });

  const [loading, setLoading] = useState(false);
  const [dropdownData, setDropdownData] = useState({
    roles: ["BP", "ASM", "RSM", "SOM", "super admin"],
    pricelabel: [], // Changed from hardcoded to empty array
    groups: ["MT", "AMD"],
    zones: ["ZONE-01", "ZONE-03"],
    outlets: [],
    asms: [],
    rsms: ["MD. AL-AMIN", "MD JANANGIR ALAM"],
    soms: ["MD. NAZMUS SAKIB", "ASADUL HOQUE RIPON"],
    nidTypes: ["NID", "BC"],
    bloodGroups: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    maritalStatuses: ["Single", "Married", "Divorced", "Widowed"],
    educationalQualifications: [
      "SSC",
      "HSC",
      "Diploma",
      "Bachelor",
      "Master",
      "PhD",
    ],
  });
  const [fetchingData, setFetchingData] = useState({
    groups: false,
    zones: false,
    outlets: false,
    asms: false,
  });

  const [showOutletModal, setShowOutletModal] = useState(false);
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

  const [creatingOutlet, setCreatingOutlet] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Update RSM and SOM when zone changes
  useEffect(() => {
    if (newUser.zone && zoneMappings[newUser.zone]) {
      setNewUser((prev) => ({
        ...prev,
        rsm: zoneMappings[newUser.zone].rsm,
        som: zoneMappings[newUser.zone].som,
      }));
    } else {
      setNewUser((prev) => ({
        ...prev,
        rsm: "",
        som: "",
      }));
    }
  }, [newUser.zone]);

  // Fetch dropdown data when component mounts
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setFetchingData((prev) => ({ ...prev, groups: true }));
        // const groups = await axios.get(
        //   "http://175.29.181.245:15001/get-user-field-values?field=group"
        // );
        // setDropdownData((prev) => ({ ...prev, groups: groups.data }));

        setFetchingData((prev) => ({ ...prev, asms: true }));
        const asms = await axios.get(
          "http://175.29.181.245:15001/get-user-field-values?field=asm",
        );
        setDropdownData((prev) => ({ ...prev, asms: asms.data }));

        await fetchOutlets();
        await fetchPriceLevels(); // Add this line
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        toast.error("Failed to load dropdown options");
      } finally {
        setFetchingData((prev) => ({
          ...prev,
          groups: false,
          asms: false,
        }));
      }
    };

    fetchDropdownData();
  }, []);

  const fetchPriceLevels = async () => {
    try {
      setFetchingData((prev) => ({ ...prev, pricelabel: true }));
      const response = await axios.get(
        "http://175.29.181.245:15001/api/pricelevels",
      );
      const priceLevels = response.data.map((level) => level.name);
      setDropdownData((prev) => ({ ...prev, pricelabel: priceLevels }));
    } catch (error) {
      console.error("Error fetching price levels:", error);
      toast.error("Failed to load price levels");
    } finally {
      setFetchingData((prev) => ({ ...prev, pricelabel: false }));
    }
  };

  const fetchOutlets = async () => {
    try {
      setFetchingData((prev) => ({ ...prev, outlets: true }));
      const outlets = await axios.get(
        "http://175.29.181.245:15001/get-outlets",
      );
      setDropdownData((prev) => ({ ...prev, outlets: outlets.data }));
    } catch (error) {
      console.error("Error fetching outlets:", error);
      toast.error("Failed to load outlets");
    } finally {
      setFetchingData((prev) => ({ ...prev, outlets: false }));
    }
  };

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("http://175.29.181.245:15001/api/users", newUser);
      toast.success("User created successfully!");
      setNewUser({
        name: "",
        number: "",
        password: "",
        role: "",
        group: "",
        zone: "",
        outlet: "",
        pricelabel: "",
        asm: "",
        rsm: "",
        som: "",
        nidType: "NID",
        nidNumber: "",
        dateOfBirth: "",
        bloodGroup: "",
        maritalStatus: "",
        spouseName: "",
        marriageDate: "",
        presentAddress: "",
        educationalQualification: "",
        joiningDate: "",
        presentSalary: "",
        personalMobileNumber: "",
        familyContactNumber: "",
        relationWithContactPerson: "",
      });
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error.response?.data?.message || "Failed to create user.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOutlet = async (e) => {
    e.preventDefault();
    if (!newOutlet.name.trim()) {
      toast.error("Outlet name cannot be empty");
      return;
    }

    try {
      setCreatingOutlet(true);
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
      setShowOutletModal(false);
      await fetchOutlets();
      setNewUser((prev) => ({ ...prev, outlet: newOutlet.name }));
    } catch (error) {
      console.error("Error creating outlet:", error);
      toast.error(error.response?.data?.message || "Failed to create outlet");
    } finally {
      setCreatingOutlet(false);
    }
  };

  const DropdownField = ({
    label,
    field,
    options,
    isLoading,
    showAddButton = false,
    disabled = false,
  }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        {showAddButton && (
          <button
            type="button"
            onClick={() => setShowOutletModal(true)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <PlusCircle size={14} /> Add New
          </button>
        )}
      </div>
      <div className="relative">
        {isLoading ? (
          <select
            className="w-full p-2 border rounded-md bg-gray-100 text-gray-500"
            disabled
          >
            <option>Loading {label}...</option>
          </select>
        ) : (
          <select
            value={newUser[field]}
            onChange={(e) =>
              setNewUser({ ...newUser, [field]: e.target.value })
            }
            className={`w-full p-2 border rounded-md ${
              disabled ? "bg-gray-100" : "bg-white"
            } text-gray-700 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            required={field === "role"}
            disabled={disabled}
          >
            <option value="">Select {label}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );

  const DateField = ({ label, field }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="date"
          value={newUser[field]}
          onChange={(e) => setNewUser({ ...newUser, [field]: e.target.value })}
          className="w-full p-2 border rounded-md bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );

  const TabButton = ({ tabName, label }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
        activeTab === tabName
          ? "bg-white text-blue-600 border-b-2 border-blue-600"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Create New User
            </h2>
          </div>

          {showOutletModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Create New Outlet
                  </h3>
                  <button
                    onClick={() => setShowOutletModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleCreateOutlet}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Outlet Name *
                      </label>
                      <input
                        type="text"
                        value={newOutlet.name}
                        onChange={(e) =>
                          setNewOutlet({ ...newOutlet, name: e.target.value })
                        }
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter outlet name"
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter proprietor name"
                        required
                      />
                    </div>

                    <div className="mb-4 col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Address *
                      </label>
                      <textarea
                        value={newOutlet.address}
                        onChange={(e) =>
                          setNewOutlet({
                            ...newOutlet,
                            address: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter full address"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter contact number"
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        NID Number *
                      </label>
                      <input
                        type="text"
                        value={newOutlet.nidNumber}
                        onChange={(e) =>
                          setNewOutlet({
                            ...newOutlet,
                            nidNumber: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter NID number"
                        required
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        BIN Number
                      </label>
                      <input
                        type="text"
                        value={newOutlet.binNumber}
                        onChange={(e) =>
                          setNewOutlet({
                            ...newOutlet,
                            binNumber: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter BIN number"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        TIN Number
                      </label>
                      <input
                        type="text"
                        value={newOutlet.tinNumber}
                        onChange={(e) =>
                          setNewOutlet({
                            ...newOutlet,
                            tinNumber: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter TIN number"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attachment
                      </label>
                      <input
                        type="file"
                        onChange={(e) =>
                          handleImageUpload(e.target.files[0], "attachment")
                        }
                        className="w-full p-2 border rounded-md hidden"
                        id="attachment"
                      />
                      <label
                        htmlFor="attachment"
                        className="w-full p-2 border rounded-md flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-700"
                      >
                        <Upload size={16} className="mr-2" />
                        {newOutlet.attachment
                          ? "Change Image"
                          : "Upload Attachment"}
                      </label>
                      {newOutlet.attachment && (
                        <div className="mt-2">
                          <img
                            src={newOutlet.attachment}
                            alt="Attachment"
                            className="h-20 border rounded-md"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowOutletModal(false)}
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingOutlet}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                    >
                      <PlusCircle size={18} />
                      {creatingOutlet ? "Creating..." : "Create Outlet"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <TabButton tabName="basic" label="Basic Information" />
                <TabButton tabName="personal" label="Personal Details" />
                <TabButton tabName="employment" label="Employment Info" />
                <TabButton tabName="contact" label="Contact Details" />
              </nav>
            </div>

            <form onSubmit={handleCreateUser} className="p-6">
              {activeTab === "basic" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={newUser.name}
                      onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                      }
                      required
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={newUser.number}
                      onChange={(e) =>
                        setNewUser({ ...newUser, number: e.target.value })
                      }
                      required
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      required
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter password"
                    />
                  </div>

                  <DropdownField
                    label="Role *"
                    field="role"
                    options={dropdownData.roles}
                    isLoading={false}
                  />

                  <DropdownField
                    label="Group"
                    field="group"
                    options={dropdownData.groups}
                    isLoading={fetchingData.groups}
                  />

                  <DropdownField
                    label="Zone"
                    field="zone"
                    options={dropdownData.zones}
                    isLoading={false}
                  />

                  <DropdownField
                    label="Outlet"
                    field="outlet"
                    options={dropdownData.outlets}
                    isLoading={fetchingData.outlets}
                    showAddButton={true}
                  />
                  <DropdownField
                    label="Price Level"
                    field="pricelabel"
                    options={dropdownData.pricelabel}
                    isLoading={fetchingData.pricelabel}
                  />

                  <DropdownField
                    label="ASM"
                    field="asm"
                    options={dropdownData.asms}
                    isLoading={fetchingData.asms}
                  />

                  <DropdownField
                    label="RSM"
                    field="rsm"
                    options={dropdownData.rsms}
                    isLoading={false}
                    disabled={true}
                  />

                  <DropdownField
                    label="SOM"
                    field="som"
                    options={dropdownData.soms}
                    isLoading={false}
                    disabled={true}
                  />
                </div>
              )}

              {activeTab === "personal" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DropdownField
                    label="NID/BC Type"
                    field="nidType"
                    options={dropdownData.nidTypes}
                    isLoading={false}
                  />

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      NID Number
                    </label>
                    <input
                      type="text"
                      value={newUser.nidNumber}
                      onChange={(e) =>
                        setNewUser({ ...newUser, nidNumber: e.target.value })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter NID number"
                    />
                  </div>

                  <DateField label="Date of Birth" field="dateOfBirth" />

                  <DropdownField
                    label="Blood Group"
                    field="bloodGroup"
                    options={dropdownData.bloodGroups}
                    isLoading={false}
                  />

                  <DropdownField
                    label="Marital Status"
                    field="maritalStatus"
                    options={dropdownData.maritalStatuses}
                    isLoading={false}
                  />

                  {newUser.maritalStatus === "Married" && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Spouse Name
                        </label>
                        <input
                          type="text"
                          value={newUser.spouseName}
                          onChange={(e) =>
                            setNewUser({
                              ...newUser,
                              spouseName: e.target.value,
                            })
                          }
                          className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter spouse name"
                        />
                      </div>

                      <DateField label="Marriage Date" field="marriageDate" />
                    </>
                  )}

                  <div className="mb-4 col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Present Address
                    </label>
                    <textarea
                      value={newUser.presentAddress}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          presentAddress: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter present address"
                      rows={3}
                    />
                  </div>

                  <DropdownField
                    label="Educational Qualification"
                    field="educationalQualification"
                    options={dropdownData.educationalQualifications}
                    isLoading={false}
                  />
                </div>
              )}

              {activeTab === "employment" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DateField label="Joining Date" field="joiningDate" />

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Present Salary
                    </label>
                    <input
                      type="number"
                      value={newUser.presentSalary}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          presentSalary: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter salary amount"
                    />
                  </div>
                </div>
              )}

              {activeTab === "contact" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={newUser.personalMobileNumber}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          personalMobileNumber: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter mobile number"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Family Contact Number
                    </label>
                    <input
                      type="tel"
                      value={newUser.familyContactNumber}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          familyContactNumber: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter contact number"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Relation With Contact Person
                    </label>
                    <input
                      type="text"
                      value={newUser.relationWithContactPerson}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          relationWithContactPerson: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter relationship"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-8 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  {activeTab !== "basic" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          activeTab === "personal"
                            ? "basic"
                            : activeTab === "employment"
                              ? "personal"
                              : "employment",
                        )
                      }
                      className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  {activeTab !== "contact" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          activeTab === "basic"
                            ? "personal"
                            : activeTab === "personal"
                              ? "employment"
                              : "contact",
                        )
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Next
                    </button>
                  )}
                </div>

                {activeTab === "contact" && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-md flex items-center gap-2 hover:bg-green-700 disabled:bg-green-400 transition-colors"
                  >
                    <PlusCircle size={18} />
                    {loading ? "Creating User..." : "Create User"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUserPage;
