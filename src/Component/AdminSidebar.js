import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, matchPath } from "react-router-dom";
import {
  Menu,
  X,
  Package,
  BarChart2,
  Users,
  Layers,
  ChevronDown,
  Target,
  Grid,
  Gift,
  Box,
  PlusCircle,
  Edit3,
  SheetIcon,
  ListOrderedIcon,
  Home,
  ShoppingCart,
  Clock,
  FileText,
  DollarSign,
  Settings,
  HelpCircle,
  Sheet,
  Edit,
} from "lucide-react";
import { BiCategoryAlt, BiDetail, BiSolidReport } from "react-icons/bi";
import { BsCash, BsCashCoin, BsShop } from "react-icons/bs";
import { FaTrademark } from "react-icons/fa";

const AdminSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const location = useLocation();

  // Close sidebar on mobile when clicking a link
  const closeSidebar = useCallback(() => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  }, []);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest(".sidebar-container")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close sidebar on window resize if it becomes desktop view
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleDropdown = (dropdownName) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const isActive = (path, exact = true) => {
    return exact
      ? location.pathname === path
      : matchPath({ path: `${path}/*` }, location.pathname);
  };

  const navItems = [
    {
      name: "Manage Stock",
      path: "/admin/manage-stock",
      icon: <Layers size={20} />,
    },
    {
      name: "Promotion Plan",
      path: "/admin/promotion",
      icon: <Gift size={20} />,
    },
    {
      name: "Accounts",
      path: "/admin/money-transaction",
      icon: <DollarSign size={20} />,
    },
    {
      name: "Salary Sheet",
      path: "/admin/salary",
      icon: <FileText size={20} />,
    },
    {
      name: "Order Requests",
      path: "/admin/order-requests",
      icon: <ListOrderedIcon size={20} />,
    },
    {
      name: "Payment Requests",
      path: "/admin/payment-request",
      icon: <BsCash size={20} />,
    },
  ];

  const dropdowns = [
    {
      name: "dashboard",
      title: "Dashboard",
      icon: <Grid size={20} />,
      items: [
        { name: "POS", path: "/admin", icon: <ShoppingCart size={16} /> },
        { name: "Slab Report", path: "/admin/slab-report", icon: <Sheet size={16} /> },  
        {
          name: "Attendance",
          path: "https://rl.luvit.com.bd/admin-panel",
          icon: <Clock size={16} />,
          external: true,
        },
      ],
    },
    {
      name: "target",
      title: "Target",
      icon: <Target size={20} />,
      items: [
        {
          name: "Sale Target",
          path: "/admin/monthly-target",
          icon: <Target size={16} />,
        },
        {
          name: "Category Wise Target",
          path: "/admin/category-target",
          icon: <BiCategoryAlt size={16} />,
        },
        {
          name: "Brand Wise Target",
          path: "/admin/brand-target",
          icon: <Package size={16} />,
        },
      ],
    },
    {
      name: "tada",
      title: "TA/DA Report",
      icon: <BiSolidReport size={20} />,
      items: [
        {
          name: "Single Report",
          path: "/admin/tada",
          icon: <SheetIcon size={16} />,
        },
        {
          name: "Full Report",
          path: "/admin/tada-full-report",
          icon: <SheetIcon size={16} />,
        },
      ],
    },
    {
      name: "create",
      title: "Create",
      icon: <PlusCircle size={20} />,
      items: [
        {
          name: "Product",
          path: "/admin/create-product",
          icon: <Package size={16} />,
        },
        {
          name: "Category",
          path: "/admin/create-category",
          icon: <BiCategoryAlt size={16} />,
        },
        {
          name: "Brand",
          path: "/admin/create-brand",
          icon: <FaTrademark size={16} />,
        },
        { name: "User", path: "/admin/create-user", icon: <Users size={16} /> },
        {
          name: "Outlet",
          path: "/admin/create-outlet",
          icon: <BsShop size={16} />,
        },
        {
          name: "Price Level",
          path: "/admin/create-pricelevel",
          icon: <DollarSign size={16} />,
        },
      ],
    },
    {
      name: "alter",
      title: "Alter",
      icon: <Edit3 size={20} />,
      items: [
        {
          name: "Products",
          path: "/admin/alter-products",
          icon: <Package size={16} />,
        },
        {
          name: "Category",
          path: "/admin/alter-categories",
          icon: <BiCategoryAlt size={16} />,
        },
        {
          name: "Brand",
          path: "/admin/alter-brands",
          icon: <FaTrademark size={16} />,
        },
        {
          name: "Users",
          path: "/admin/alter-users",
          icon: <Users size={16} />,
        },
        {
          name: "Outlets",
          path: "/admin/alter-outlets",
          icon: <BsShop size={16} />,
        },
        {
          name: "Price Levels",
          path: "/admin/alter-pricelevels",
          icon: <DollarSign size={16} />,
        },
      ],
    },
    {
      name: "salesMovement",
      title: "Sales Movement",
      icon: <BarChart2 size={20} />,
      items: [
        {
          name: "User Wise",
          path: "/admin/sales-movement/dealer-wise",
          icon: <Users size={16} />,
        },
        {
          name: "Brand Wise",
          path: "/admin/sales-movement/brand-wise",
          icon: <Package size={16} />,
        },

        {
          name: "Category Wise",
          path: "/admin/sales-movement/category-wise",
          icon: <BiCategoryAlt size={16} />,
        },
        {
          name: "Product Wise",
          path: "/admin/sales-movement/product-wise",
          icon: <Box size={16} />,
        },
        {
          name: "Full Report",
          path: "/admin/full-sales-report",
          icon: <BiCategoryAlt size={16} />,
        },
      ],
    },
    {
      name: "stockMovement",
      title: "Stock Movement",
      icon: <Box size={20} />,
      items: [
        {
          name: "Dealer Wise",
          path: "/stock-movement/dealer",
          icon: <Users size={16} />,
        },
        {
          name: "Group Wise",
          path: "/stock-movement/group",
          icon: <BsShop size={16} />,
        },
        {
          name: "Product Wise",
          path: "/stock-movement/product",
          icon: <Box size={16} />,
        },
        {
          name: "Category Wise",
          path: "/stock-movement/category",
          icon: <BiCategoryAlt size={16} />,
        },
        {
          name: "Brand Wise",
          path: "/stock-movement/brand",
          icon: <FaTrademark size={16} />,
        },
        {
          name: "Update Stock",
          path: "/admin/full-stock-report",
          icon: <Edit size={16} />,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-md shadow-lg hover:bg-gray-700 transition-colors duration-200"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-[100vh] bg-[#3C3F46] text-white w-72 p-5 shadow-xl transform transition-transform duration-300 ease-in-out z-40 sidebar-container
        ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:sticky md:top-0 md:z-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Home size={24} className="text-blue-400" />
              <span>Admin Panel</span>
            </h2>
            <p className="text-gray-400 text-sm mt-1">Management Console</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              {/* Dropdown Menus */}
              {dropdowns.map((dropdown) => (
                <li key={dropdown.name}>
                  <button
                    className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                      activeDropdown === dropdown.name ||
                      dropdown.items.some((item) => isActive(item.path))
                        ? "bg-gray-500 text-white"
                        : "hover:bg-gray-800 hover:text-blue-300"
                    }`}
                    onClick={() => toggleDropdown(dropdown.name)}
                  >
                    <span className="flex items-center gap-3">
                      {dropdown.icon}
                      {dropdown.title}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        activeDropdown === dropdown.name ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {activeDropdown === dropdown.name && (
                    <ul className="ml-8 mt-1 space-y-1 border-l-2 border-gray-700 pl-3 py-1">
                      {dropdown.items.map((item) => (
                        <li key={item.path}>
                          {item.external ? (
                            <a
                              href={item.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 hover:text-blue-300 text-sm transition-colors duration-200"
                            >
                              {item.icon}
                              {item.name}
                            </a>
                          ) : (
                            <Link
                              to={item.path}
                              onClick={closeSidebar}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                                isActive(item.path)
                                  ? "text-blue-400 font-medium"
                                  : "hover:bg-gray-800 hover:text-blue-300"
                              }`}
                            >
                              {item.icon}
                              {item.name}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}

              {/* Static Navigation Items */}
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive(item.path, true)
                        ? "bg-blue-900/30 text-blue-400 border-l-4 border-blue-400"
                        : "hover:bg-gray-800 hover:text-blue-300"
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Bottom Section */}
          <div className="mt-auto pt-4 border-t border-gray-800">
            <Link
              to="/admin"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-200"
            >
              <Settings size={20} />
              <span>Settings</span>
            </Link>
            <Link
              to="/admin"
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-200"
            >
              <HelpCircle size={20} />
              <span>Help & Support</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default AdminSidebar;
