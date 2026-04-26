import { useEffect, useState } from "react";
import axios from "axios";
import { Pencil, X, Check, ChevronDown, Calendar, Loader } from "lucide-react";
import toast from "react-hot-toast";
import AdminSidebar from "../Component/AdminSidebar";

const AlterUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [dropdownData, setDropdownData] = useState({
    roles: ["MR", "ASM", "RSM", "SOM"],
    pricelabel: [],
    groups: [],
    zones: [],
    outlets: [],
    asms: [],
    rsms: [],
    soms: [],
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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/getAllUser",
      );
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };
  const fetchPriceLevels = async () => {
    try {
      const response = await axios.get(
        "http://175.29.181.245:15001/api/pricelevels",
      );
      const priceLevels = response.data.map((level) => level.name);
      setDropdownData((prev) => ({ ...prev, pricelabel: priceLevels }));
    } catch (error) {
      console.error("Error fetching price levels:", error);
      toast.error("Failed to load price levels");
    }
  };

  const fetchDropdownData = async () => {
    try {
      const groups = await axios.get(
        "http://175.29.181.245:15001/get-user-field-values?field=group",
      );
      const zones = await axios.get(
        "http://175.29.181.245:15001/get-user-field-values?field=zone",
      );
      const outlets = await axios.get(
        "http://175.29.181.245:15001/get-outlets",
      );
      const asms = await axios.get(
        "http://175.29.181.245:15001/get-user-field-values?field=asm",
      );
      const rsms = await axios.get(
        "http://175.29.181.245:15001/get-user-field-values?field=rsm",
      );
      const soms = await axios.get(
        "http://175.29.181.245:15001/get-user-field-values?field=som",
      );
      await fetchPriceLevels(); // Add this line

      setDropdownData((prev) => ({
        ...prev,
        groups: groups.data,
        zones: zones.data,
        outlets: outlets.data,
        asms: asms.data,
        rsms: rsms.data,
        soms: soms.data,
      }));
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDropdownData();
  }, []);

  const handleInputChange = (e, field) => {
    setEditingUser({ ...editingUser, [field]: e.target.value });
  };

  const handleUpdateUser = async () => {
    try {
      setLoading(true);
      await axios.put(
        `http://175.29.181.245:15001/updateUser/${editingUser._id}`,
        editingUser,
      );
      toast.success("User updated successfully!");
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.response?.data?.message || "Failed to update user.");
    } finally {
      setLoading(false);
    }
  };

  // Helper component for dropdown fields
  const DropdownField = ({ label, field, options }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <select
          value={editingUser[field] || ""}
          onChange={(e) => handleInputChange(e, field)}
          className="w-full p-2 border rounded-md bg-white text-gray-700 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select {label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );

  // Helper component for date fields
  const DateField = ({ label, field }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="date"
          value={editingUser[field] || ""}
          onChange={(e) => handleInputChange(e, field)}
          className="w-full p-2 border rounded-md bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Manage Users</h2>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            {loading && !editingUser ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No users found</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 border-b font-medium">Name</th>
                    <th className="p-3 border-b font-medium">Phone</th>
                    <th className="p-3 border-b font-medium">Password</th>
                    <th className="p-3 border-b font-medium">Role</th>
                    <th className="p-3 border-b font-medium">Outlet</th>
                    <th className="p-3 border-b font-medium">Zone</th>
                    <th className="p-3 border-b font-medium">AttendanceID</th>
                    <th className="p-3 border-b font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="p-3 border-b">{user.name}</td>
                      <td className="p-3 border-b">{user.number}</td>
                      <td className="p-3 border-b">{user.password}</td>
                      <td className="p-3 border-b">{user.role}</td>
                      <td className="p-3 border-b">{user.outlet || "-"}</td>
                      <td className="p-3 border-b">{user.zone || "-"}</td>
                      <td className="p-3 border-b">
                        {user.attendance_id || "-"}
                      </td>
                      <td className="p-3 border-b">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Pencil size={20} /> Edit User
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 border-b pb-2">
                  Basic Information
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) => handleInputChange(e, "name")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={editingUser.number}
                    onChange={(e) => handleInputChange(e, "number")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AttendanceID
                  </label>
                  <input
                    type="text"
                    value={editingUser.attendance_id}
                    onChange={(e) => handleInputChange(e, "attendance_id")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    value={editingUser.password}
                    onChange={(e) => handleInputChange(e, "password")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <DropdownField
                  label="Role *"
                  field="role"
                  options={dropdownData.roles}
                />

                <DropdownField
                  label="Group"
                  field="group"
                  options={dropdownData.groups}
                />

                <DropdownField
                  label="Zone"
                  field="zone"
                  options={dropdownData.zones}
                />

                <DropdownField
                  label="Outlet"
                  field="outlet"
                  options={dropdownData.outlets}
                />

                <DropdownField
                  label="Pricelabel"
                  field="pricelabel"
                  options={dropdownData.pricelabel}
                />

                <DropdownField
                  label="ASM"
                  field="asm"
                  options={dropdownData.asms}
                />

                <DropdownField
                  label="RSM"
                  field="rsm"
                  options={dropdownData.rsms}
                />

                <DropdownField
                  label="SOM"
                  field="som"
                  options={dropdownData.soms}
                />
              </div>

              {/* Personal & Other Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 border-b pb-2">
                  Personal Details
                </h4>

                <DropdownField
                  label="NID/BC Type"
                  field="nidType"
                  options={dropdownData.nidTypes}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NID Number
                  </label>
                  <input
                    type="text"
                    value={editingUser.nidNumber || ""}
                    onChange={(e) => handleInputChange(e, "nidNumber")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <DateField label="Date of Birth" field="dateOfBirth" />

                <DropdownField
                  label="Blood Group"
                  field="bloodGroup"
                  options={dropdownData.bloodGroups}
                />

                <DropdownField
                  label="Marital Status"
                  field="maritalStatus"
                  options={dropdownData.maritalStatuses}
                />

                {editingUser.maritalStatus === "Married" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Spouse Name
                      </label>
                      <input
                        type="text"
                        value={editingUser.spouseName || ""}
                        onChange={(e) => handleInputChange(e, "spouseName")}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <DateField label="Marriage Date" field="marriageDate" />
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Present Address
                  </label>
                  <textarea
                    value={editingUser.presentAddress || ""}
                    onChange={(e) => handleInputChange(e, "presentAddress")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <DropdownField
                  label="Educational Qualification"
                  field="educationalQualification"
                  options={dropdownData.educationalQualifications}
                />

                <h4 className="font-medium text-gray-800 border-b pb-2 mt-4">
                  Employment Details
                </h4>

                <DateField label="Joining Date" field="joiningDate" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Present Salary
                  </label>
                  <input
                    type="number"
                    value={editingUser.presentSalary || ""}
                    onChange={(e) => handleInputChange(e, "presentSalary")}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <h4 className="font-medium text-gray-800 border-b pb-2 mt-4">
                  Contact Details
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Personal Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={editingUser.personalMobileNumber || ""}
                    onChange={(e) =>
                      handleInputChange(e, "personalMobileNumber")
                    }
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Family Contact Number
                  </label>
                  <input
                    type="tel"
                    value={editingUser.familyContactNumber || ""}
                    onChange={(e) =>
                      handleInputChange(e, "familyContactNumber")
                    }
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Relation With Contact Person
                  </label>
                  <input
                    type="text"
                    value={editingUser.relationWithContactPerson || ""}
                    onChange={(e) =>
                      handleInputChange(e, "relationWithContactPerson")
                    }
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  "Update User"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlterUsersPage;
