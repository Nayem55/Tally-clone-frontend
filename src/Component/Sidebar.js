import { Link, useLocation } from "react-router-dom";
import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  FolderOpen,
  Users,
  FileText,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Home,
  Layers,
  Tag,
  DollarSign,
} from "lucide-react";

// Helper to safely check if any child link is active
const hasActiveChild = (children, location) => {
  return React.Children.toArray(children).some((child) => {
    if (React.isValidElement(child) && child.props && child.props.to) {
      return location.pathname.startsWith(child.props.to);
    }
    return false;
  });
};

function MenuSection({ title, icon: Icon, children }) {
  const location = useLocation();
  const [manuallyOpen, setManuallyOpen] = useState(false);

  const isChildActive = hasActiveChild(children, location);
  const isOpen = manuallyOpen || isChildActive;

  return (
    <div className="text-slate-700">
      <button
        onClick={() => setManuallyOpen(!manuallyOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all
          ${isChildActive 
            ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-200" 
            : "hover:bg-slate-100/80"
          }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className={isChildActive ? "text-blue-600" : "text-slate-500"} />
          <span>{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown size={18} className="text-slate-500" />
        ) : (
          <ChevronRight size={18} className="text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="ml-9 mt-2 space-y-1 border-l-2 border-slate-200 pl-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const linkClass = (path) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
      isActive(path)
        ? "bg-blue-600 text-white shadow-lg"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const subLinkClass = (path) =>
    `block px-4 py-2.5 rounded-lg text-sm transition ${
      isActive(path)
        ? "text-blue-600 font-medium bg-blue-50"
        : "hover:bg-slate-100 text-slate-600"
    }`;

  return (
    // Key Fix: sticky + top-0 + h-screen → perfect sticky sidebar
    <div className="w-72 h-screen bg-white border-r border-slate-200 shadow-xl flex flex-col sticky top-0 z-50">
      
      {/* Header - Always visible */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AccuBooks</h1>
            <p className="text-xs text-slate-500">Accounting System</p>
          </div>
        </div>
      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
        <nav className="space-y-1">

          <Link to="/" className={linkClass("/")}>
            <Home size={20} />
            <span>Dashboard</span>
          </Link>

          <Link to="/companies" className={linkClass("/companies")}>
            <Building2 size={20} />
            <span>Companies</span>
          </Link>

          <div className="pt-4 pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4">
              Masters
            </h3>
          </div>

          <Link to="/groups" className={linkClass("/groups")}>
            <FolderOpen size={20} />
            <span>Groups</span>
          </Link>

          <Link to="/ledgers" className={linkClass("/ledgers")}>
            <Users size={20} />
            <span>Ledgers</span>
          </Link>

          <MenuSection title="Chart of Accounts" icon={Layers}>
            <Link to="/coa/groups" className={subLinkClass("/coa/groups")}>Groups</Link>
            <Link to="/coa/ledgers" className={subLinkClass("/coa/ledgers")}>Ledgers</Link>
            <Link to="/coa/stock-items" className={subLinkClass("/coa/stock-items")}>Stock Items</Link>
            <Link to="/coa/stock-groups" className={subLinkClass("/coa/stock-groups")}>Stock Groups</Link>
          </MenuSection>

          <MenuSection title="Inventory" icon={Package}>
            <Link to="/items" className={subLinkClass("/items")}>Create Item</Link>
            <Link to="/alter-item" className={subLinkClass("/alter-item")}>Alter Item Prices</Link>
            <Link to="/stock-summary" className={subLinkClass("/stock-summary")}>Stock Summary</Link>
          </MenuSection>

          <div className="pt-6 pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4">
              Transactions
            </h3>
          </div>

          <Link to="/vouchers" className={linkClass("/vouchers")}>
            <FileText size={20} />
            <span>Vouchers</span>
          </Link>

          <Link to="/purchase" className={linkClass("/purchase")}>
            <ShoppingCart size={20} />
            <span>Purchase Entry</span>
          </Link>

          <Link to="/sales" className={linkClass("/sales")}>
            <DollarSign size={20} />
            <span>Sales Entry</span>
          </Link>

          <div className="pt-6 pb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-4">
              Reports
            </h3>
          </div>

          <Link to="/trial-balance" className={linkClass("/trial-balance")}>
            <BarChart3 size={20} />
            <span>Trial Balance</span>
          </Link>

          <Link to="/pricelevel" className={linkClass("/pricelevel")}>
            <Tag size={20} />
            <span>Price Levels</span>
          </Link>

        </nav>
      </div>

      {/* Optional: Footer (pinned at bottom) */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <p>© 2025 AccuBooks</p>
        <p className="mt-1">Version 2.1.0</p>
      </div>
    </div>
  );
}