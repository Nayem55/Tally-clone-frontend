import { BrowserRouter, Routes, Route } from "react-router-dom";
import CompanyList from "./Pages/CompanyList";
import Groups from "./Pages/Groups";
import Ledgers from "./Pages/Ledgers";
import VoucherList from "./Pages/VoucherList";
import VoucherCreate from "./Pages/VoucherCreate";
import TrialBalance from "./Pages/TrialBalance";
import DashboardPage from "./Pages/DashboardPage";
import Sidebar from "./Component/Sidebar";
import Navbar from "./Component/Navbar";
import Items from "./Pages/Items";
import CoaGroups from "./Pages/CoaGroups";
import CoaLedgers from "./Pages/CoaLedgers";
import CoaStockItems from "./Pages/CoaStockItems";
import CoaStockGroups from "./Pages/CoaStockGroups";
import PriceLevels from "./Pages/PriceLevels";
import AlterItemPrices from "./Pages/AlterItemPrices";
import StockSummary from "./Pages/StockSummary";


export default function App() {
  return (
    <BrowserRouter>
      <Navbar/>
      <div className="flex">
        <Sidebar />
        <div className="flex-1 bg-gray-50 min-h-screen">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/companies" element={<CompanyList />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/items" element={<Items />} />
            <Route path="/alter-item" element={<AlterItemPrices />} />
            <Route path="/stock-summary" element={<StockSummary />} />
            <Route path="/ledgers" element={<Ledgers />} />
            <Route path="/vouchers" element={<VoucherList />} />
            <Route path="/voucher-create" element={<VoucherCreate />} />
            <Route path="/purchase" element={<VoucherList initialVoucherName="Purchase" />} />
            <Route path="/sales" element={<VoucherList initialVoucherName="Sales" />} />
            <Route path="/trial-balance" element={<TrialBalance />} />
            <Route path="/coa/groups" element={<CoaGroups />} />
            <Route path="/coa/ledgers" element={<CoaLedgers />} />
            <Route path="/coa/stock-items" element={<CoaStockItems />} />
            <Route path="/coa/stock-groups" element={<CoaStockGroups />} />
            <Route path="/pricelevel" element={<PriceLevels />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
