import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Target,
  PiggyBank,
  MessageSquare,
  Wallet,
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUploadJobs } from "@/context/UploadJobContext";

export const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { clearCompletedEntries } = useUploadJobs();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    clearCompletedEntries();
    clearAuth();
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const renderNavItems = (items: typeof navItems) => (
    <nav className="flex-1 p-4 space-y-1">
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
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
  );

  const renderBottomItems = () => (
    <div className="p-4 border-t border-sidebar-border space-y-1">
      {bottomItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
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
      <button
        className="sidebar-item w-full text-left"
        onClick={() => {
          handleNavClick();
          handleLogout();
        }}
      >
        <LogOut className="w-5 h-5" />
        <span>{t("sidebar.logout")}</span>
      </button>
    </div>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 h-10 w-10 rounded-full border border-border bg-background shadow md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label={t("sidebar.openMenu")}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <aside className="h-full w-full bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="p-6 border-b border-sidebar-border">
              <Link to="/dashboard" onClick={handleNavClick} className="flex items-center justify-center">
                <div className="w-full max-w-[200px] rounded-lg border border-border bg-background/80 p-2 shadow-sm">
                  <img
                    src="/logo.png"
                    alt={t("app.brand")}
                    className="h-16 w-full object-contain"
                  />
                </div>
              </Link>
            </div>
            {renderNavItems(navItems)}
            {renderBottomItems()}
          </aside>
        </SheetContent>
      </Sheet>

      <aside className="fixed left-0 top-0 hidden h-screen w-64 bg-sidebar border-r border-sidebar-border md:flex md:flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/dashboard" className="flex items-center justify-center">
            <div className="w-full max-w-[200px] rounded-lg border border-border bg-background/80 p-2 shadow-sm">
              <img
                src="/logo.png"
                alt={t("app.brand")}
                className="h-16 w-full object-contain"
              />
            </div>
          </Link>
        </div>
        {renderNavItems(navItems)}
        {renderBottomItems()}
      </aside>
    </>
  );
};
