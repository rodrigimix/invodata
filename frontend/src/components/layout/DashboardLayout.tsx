import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { t } = useTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const hasNotifications = false;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <div className="ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>

      {hasNotifications && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-6 right-6 z-60 h-12 w-12 rounded-full bg-background shadow-lg border border-border"
          onClick={() => setNotificationsOpen(true)}
          aria-label={t("layout.notifications")}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("layout.notifications")}</DialogTitle>
            <DialogDescription>{t("layout.notificationsEmpty")}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};
