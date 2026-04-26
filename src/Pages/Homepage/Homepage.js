import { useCallback, useEffect, useState } from "react";
import OpeningStock from "../OpeningStock";
import Primary from "../Primary";
import Secondary from "../Secondary";
import OfficeReturn from "../OfficeReturn";
import MarketReturn from "../MarketReturn";
import axios from "axios";
import PaymentVoucher from "../../Component/PaymentVoucher";
import PosVoucher from "../PosVoucher";
import TadaVoucher from "../TadaVoucher";
import AttendanceVoucher from "../CheckInOut";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import PrimaryRequest from "../PrimaryRequest";
import toast from "react-hot-toast";
import { Store, StoreIcon } from "lucide-react";

export default function Home() {
  const [selectedTab, setSelectedTab] = useState("secondary");
  const [stock, setStock] = useState({ dp: 0, tp: 0 }); // Total stock with dp and tp
  const [currentDue, setCurrentDue] = useState(0); // Total due
  const [target, setTarget] = useState(null); // Monthly target
  const [totalTP, setTotalTP] = useState(0); // Total TP for achievement calculation
  const [dataLoading, setDataLoading] = useState(true); // Unified loading state
  const [posUser, setPosUser] = useState(
    JSON.parse(localStorage.getItem("pos-user")),
  );
  const attendanceUser = JSON.parse(localStorage.getItem("attendance-user"));
  const [locationError, setLocationError] = useState("");
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const navigate = useNavigate();
  const [outletOptions, setOutletOptions] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [siblingUsers, setSiblingUsers] = useState([]);

  const fetchPosUser = useCallback(async () => {
    if (!posUser) return;
    try {
      setDataLoading(true);
      const response = await axios.get(
        `http://175.29.181.245:15001/getUser/${posUser._id}`,
      );
      const updatedUser = response.data;
      localStorage.setItem("pos-user", JSON.stringify(updatedUser));
      setPosUser(updatedUser);
    } catch (error) {
      console.error("Error fetching pos user:", error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!posUser) {
      navigate("/login");
      return;
    }
    fetchPosUser();
  }, []);

  useEffect(() => {
    const fetchSiblingUsers = async () => {
      if (!posUser?.name) return;

      try {
        setDataLoading(true);
        const response = await axios.get(
          `http://175.29.181.245:15001/getUserWithMultipleOutlets`,
          {
            params: { name: posUser.name },
          },
        );

        const users = response.data;
        setSiblingUsers(users);

        const uniqueOutlets = [...new Set(users.map((u) => u.outlet))];
        setOutletOptions(uniqueOutlets);

        setSelectedOutlet(posUser.outlet);
      } catch (error) {
        console.error("Error fetching sibling users:", error);
        toast.error("Failed to load multiple outlet options.");
      } finally {
        setDataLoading(false);
      }
    };

    fetchSiblingUsers();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        await Promise.all([
          getStockValue(posUser.outlet),
          fetchUserTargetAndAchievement(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load data. Please try again.");
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleOutletChange = (outlet) => {
    const selectedUser = siblingUsers.find((u) => u.outlet === outlet);
    if (!selectedUser) {
      toast.error("Unable to switch outlet. User data not found.");
      return;
    }

    localStorage.setItem("pos-user", JSON.stringify(selectedUser));
    setPosUser(selectedUser);
    setSelectedOutlet(outlet);

    // Refresh data for new outlet
    getStockValue(outlet);
    fetchUserTargetAndAchievement();
    toast.success(`Switched to outlet: ${outlet}`);
  };

  const fetchUserData = useCallback(async () => {
    if (!attendanceUser) return;

    try {
      setDataLoading(true);
      const response = await axios.get(
        `https://attendance-app-server-blue.vercel.app/getUser/${attendanceUser?._id}`,
      );
      localStorage.setItem("attendance-user", JSON.stringify(response.data));
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!attendanceUser) {
      navigate("/login");
    } else {
      fetchUserData();
    }
  }, []);

  const fetchUserTargetAndAchievement = async () => {
    try {
      const currentMonth = dayjs().format("YYYY-MM");
      const year = currentMonth.split("-")[0];
      const month = currentMonth.split("-")[1];

      // Fetch target
      const targetResponse = await axios.get(
        "http://175.29.181.245:15001/targets",
        {
          params: { year, month, userID: posUser._id },
        },
      );
      const targetEntry = targetResponse.data.find(
        (entry) => entry.userID === posUser._id,
      );
      if (targetEntry) {
        const targetForMonth = targetEntry.targets.find(
          (t) => t.year === parseInt(year) && t.month === parseInt(month),
        );
        if (targetForMonth) {
          setTarget(targetForMonth);
        }
      }

      // Fetch actual secondary (secondary - market return) for the current month
      const actualSecondaryResponse = await axios.get(
        `http://175.29.181.245:15001/api/user-actual-secondary`,
        {
          params: {
            outlet: posUser.outlet,
            month: currentMonth,
          },
        },
      );

      if (actualSecondaryResponse.data.success) {
        const actualSecondaryValueTP = parseFloat(
          actualSecondaryResponse.data.data.actualSecondaryValueTP || 0,
        );
        setTotalTP(actualSecondaryValueTP);
      } else {
        throw new Error(
          actualSecondaryResponse.data.message ||
            "Failed to fetch actual secondary data",
        );
      }
    } catch (error) {
      console.error("Error fetching target or achievement:", error);
      // toast.error("Failed to load target or achievement data.");
    }
  };

  const getStockValue = async (outletName) => {
    try {
      const encodedOutletName = encodeURIComponent(outletName);
      const [stockResponse, dueResponse] = await Promise.all([
        axios.get(
          `http://175.29.181.245:15001/api/stock-value/${encodedOutletName}`,
        ),
        axios.get(
          `http://175.29.181.245:15001/current-due/${encodedOutletName}`,
        ),
      ]);
      setCurrentDue(dueResponse.data.current_due);
      setStock({
        dp: stockResponse.data.totalCurrentDP,
        tp: stockResponse.data.totalCurrentTP,
      });
    } catch (error) {
      console.error("Error fetching stock data:", error);
      // toast.error("Failed to load stock data.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex flex-col space-y-2">
          {/* User Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {posUser?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{posUser?.name}</h1>
            </div>
          </div>

          {/* Outlet Selection */}
          <div className="relative">
            {outletOptions.length > 1 ? (
              <select
                value={selectedOutlet}
                onChange={(e) => handleOutletChange(e.target.value)}
                className="w-full p-3 pr-10 bg-white bg-opacity-90 text-gray-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
              >
                {outletOptions.map((outlet) => (
                  <option
                    key={outlet}
                    value={outlet}
                    className="py-2 flex items-center"
                  >
                    {outlet}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-3 p-3 bg-white bg-opacity-20 rounded-lg">
                {/* <span className="text-blue-100"><Store/></span> */}
                <span className="text-sm font-medium">{posUser?.outlet}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rest of the component remains EXACTLY the same */}
      <div className="p-4 sm:py-4">
        <select
          value={selectedTab}
          onChange={(e) => setSelectedTab(e.target.value)}
          className="p-2 border rounded-lg w-[100%]"
        >
          {/* <option value="opening">Opening Stock</option> */}
          <option value="primary request">Primary Request</option>
          {/* <option value="primary">Primary</option> */}
          <option value="secondary">Secondary</option>
          {/* <option value="pos">POS</option> */}
          {/* <option value="officeReturn">Office Return</option> */}
          <option value="marketReturn">Market Return</option>
          {/* <option value="payment">Payment</option> */}
          {/* <option value="tada">TA/DA</option> */}
          <option value="attendance">Check In/Out</option>
          {/* <option value="slab">Slab Voucher</option> */}
        </select>
      </div>

      {selectedTab === "opening" && (
        <OpeningStock
          user={posUser}
          stock={stock}
          currentDue={currentDue}
          setStock={setStock}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "primary request" && (
        <PrimaryRequest
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "primary" && (
        <Primary
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "secondary" && (
        <Secondary
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "officeReturn" && (
        <OfficeReturn
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "marketReturn" && (
        <MarketReturn
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "payment" && (
        <PaymentVoucher
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "pos" && (
        <PosVoucher
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "tada" && (
        <TadaVoucher
          user={posUser}
          stock={stock}
          setStock={setStock}
          currentDue={currentDue}
          getStockValue={getStockValue}
          target={target}
          totalTP={totalTP}
          dataLoading={dataLoading}
        />
      )}
      {selectedTab === "attendance" && <AttendanceVoucher />}
    </div>
  );
}
