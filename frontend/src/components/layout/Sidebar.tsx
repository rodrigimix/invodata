import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Target,
  PiggyBank,
  MessageSquare,
  Wallet,
  Settings,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth } from "@/lib/api";
import { useTranslation } from "react-i18next";

export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: t("sidebar.dashboard"), path: "/dashboard" },
    { icon: FileText, label: t("sidebar.invoices"), path: "/invoices" },
    { icon: MessageSquare, label: t("sidebar.aiChat"), path: "/chat" },
    { icon: Wallet, label: t("sidebar.accounts"), path: "/accounts" },
    { icon: Target, label: t("sidebar.goals"), path: "/goals" },
    { icon: PiggyBank, label: t("sidebar.budget"), path: "/budget" },
  ];

  const bottomItems = [
    { icon: Settings, label: t("sidebar.settings"), path: "/settings" },
  ];

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">I</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">{t("app.brand")}</h1>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "sidebar-item",
                isActive && "sidebar-item-active"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-sidebar-border space-y-1">
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "sidebar-item",
                isActive && "sidebar-item-active"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button className="sidebar-item w-full text-left" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
          <span>{t("sidebar.logout")}</span>
        </button>
      </div>
    </aside>
  );
};
