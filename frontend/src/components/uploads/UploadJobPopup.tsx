import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadJobs } from "@/context/UploadJobContext";
import { useTranslation } from "react-i18next";

const DONE_STATUSES = new Set(["success", "error", "canceled"]);

const UploadJobPopup = () => {
  const { t } = useTranslation();
  const { entries, batchId, popupBatchId, setPopupBatchId } = useUploadJobs();
  const location = useLocation();
  const [dismissedBatchId, setDismissedBatchId] = useState<string | null>(null);
  const hasActiveUploads = entries.some((entry) => entry.status === "uploading");
  const hasStarted = entries.some((entry) => entry.status !== "idle");

  useEffect(() => {
    setDismissedBatchId(null);
  }, [batchId]);

  useEffect(() => {
    if (popupBatchId && popupBatchId === batchId) {
      setDismissedBatchId(null);
    }
  }, [popupBatchId, batchId]);

  useEffect(() => {
    if (!batchId) return;
    if (location.pathname === "/invoices/new/upload") return;
    if (dismissedBatchId === batchId) return;
    if (hasStarted && popupBatchId !== batchId) {
      setPopupBatchId(batchId);
    }
  }, [batchId, popupBatchId, dismissedBatchId, hasStarted, location.pathname, setPopupBatchId]);

  const { total, completed, percent, allDone } = useMemo(() => {
    const totalCount = entries.length;
    const completedCount = entries.filter((entry) => DONE_STATUSES.has(entry.status)).length;
    const ratio = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
    return {
      total: totalCount,
      completed: completedCount,
      percent: ratio,
      allDone: totalCount > 0 && completedCount === totalCount,
    };
  }, [entries]);
  const shouldShow =
    entries.length > 0 &&
    hasStarted &&
    (popupBatchId === batchId || hasActiveUploads) &&
    location.pathname !== "/invoices/new/upload" &&
    dismissedBatchId !== batchId;

  if (!shouldShow) return null;

  const statusLabel = allDone
    ? t("invoiceUpload.status.success")
    : t("invoiceUpload.status.processing");
  const statusClassName = allDone ? "text-success" : "text-muted-foreground";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[280px]">
      <div className="invodata-card upload-popup-breathing p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("invoiceUpload.processing.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("invoiceUpload.processing.popupProgress", { completed, total })}
            </p>
          </div>
          <div className="relative h-12 w-12">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${percent}%, hsl(var(--muted)) 0)`,
              }}
            />
            <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center text-[10px] font-semibold text-foreground">
              {percent}%
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className={`text-xs ${statusClassName}`}>{statusLabel}</p>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link
                to="/invoices/new/upload"
                onClick={() => {
                  setPopupBatchId(null);
                }}
              >
                {t("invoiceUpload.processing.openUpload")}
              </Link>
            </Button>
            <button
              type="button"
              aria-label={t("invoiceUpload.processing.closeLabel")}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              onClick={() => {
                if (batchId) {
                  setDismissedBatchId(batchId);
                }
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadJobPopup;
