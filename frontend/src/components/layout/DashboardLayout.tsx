import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  acceptUserShare,
  type NotificationItem,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadNotificationsCount();
      setUnreadCount(count);
    } catch {
      // Ignore
    }
  };

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const items = await getNotifications();
      setNotifications(items);
      const unread = items.filter((item) => !item.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      toast({
        title: t("layout.notifications"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    loadUnreadCount();
  }, []);

  useEffect(() => {
    if (notificationsOpen) {
      loadNotifications();
    }
  }, [notificationsOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast({
        title: t("layout.notifications"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    }
  };

  const handleAcceptShare = async (item: NotificationItem) => {
    if (!item.shareId) return;
    try {
      const response = await acceptUserShare(item.shareId);
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((current) =>
          current.id === item.id ? { ...current, isRead: true } : current
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - (item.isRead ? 0 : 1)));
      const publicId = response.invoice?.publicId;
      if (publicId) {
        navigate(`/invoices/${publicId}`);
        setNotificationsOpen(false);
      }
    } catch (err) {
      toast({
        title: t("layout.notifications"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteNotification = async (item: NotificationItem) => {
    try {
      await deleteNotification(item.id);
      setNotifications((prev) => prev.filter((current) => current.id !== item.id));
      if (!item.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      toast({
        title: t("layout.notifications"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    }
  };

  const handleClearNotifications = async () => {
    try {
      await clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      toast({
        title: t("layout.notifications"),
        description: err instanceof Error ? err.message : t("common.error"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <div className="ml-0 md:ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        </header>

        {/* Page content */}
        <main className="p-6 pt-16 md:pt-6">
          {children}
        </main>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-6 right-6 z-60 h-12 w-12 rounded-full bg-background shadow-lg border border-border"
        onClick={() => setNotificationsOpen(true)}
        aria-label={t("layout.notifications")}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-danger text-[10px] text-danger-foreground flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Button>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("layout.notifications")}</DialogTitle>
            <DialogDescription>
              {loadingNotifications
                ? t("common.loading")
                : notifications.length === 0
                  ? t("layout.notificationsEmpty")
                  : t("layout.notificationsHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-auto">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border border-border/60 p-3 text-sm ${item.isRead ? "bg-background" : "bg-muted/40"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium text-foreground">{item.message}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDeleteNotification(item)}
                    aria-label={t("layout.notificationsRemove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {item.createdAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                )}
                {item.actionUrl && (
                  <div className="mt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={item.actionUrl}>{t("layout.viewInvoice")}</Link>
                    </Button>
                  </div>
                )}
                {item.type === "SHARE" && item.shareId && (
                  <div className="mt-2">
                    <Button variant="default" size="sm" onClick={() => handleAcceptShare(item)}>
                      {t("layout.acceptShare")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={handleMarkAllRead}>
              {t("layout.notificationsMarkAll")}
            </Button>
            <Button variant="ghost" onClick={handleClearNotifications}>
              {t("layout.notificationsClearAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
