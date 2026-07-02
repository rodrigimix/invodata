import { useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Invoice, InvoiceCategory, getInvoiceCategories } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface RecentInvoicesProps {
  invoices: Invoice[];
  isLoading?: boolean;
  error?: string | null;
}

export const RecentInvoices = ({ invoices, isLoading, error }: RecentInvoicesProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const [categories, setCategories] = useState<InvoiceCategory[]>([]);
  const formatCurrency = (value?: number) => {
    if (typeof value !== "number") return "-";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  };
  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  };
  useEffect(() => {
    let isMounted = true;
    getInvoiceCategories()
      .then((data) => {
        if (!isMounted) return;
        setCategories(data || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);
  const getIssuerCategoryLabel = (category?: string | null) => {
    if (!category) return t("invoices.noCategory");
    const normalized = category.trim().toUpperCase();
    return t(`issuerCategories.${normalized}`, { defaultValue: category });
  };
  const getCategoryColor = (category?: string | null) => {
    if (!category) return null;
    const normalized = category.trim().toUpperCase();
    const match = categories.find((entry) => entry.name.toUpperCase() === normalized);
    return match?.color || null;
  };
  const getReadableTextColor = (hex: string) => {
    const value = hex.replace("#", "");
    if (value.length !== 6) return "#FFFFFF";
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
  };
  const getIssuerCategoryStyles = (category?: string | null) => {
    if (!category) {
      return { className: "bg-muted text-muted-foreground border border-border" };
    }
    const normalized = category.trim().toUpperCase();
    const customColor = getCategoryColor(normalized);
    if (customColor) {
      return {
        className: "border border-transparent",
        style: { backgroundColor: customColor, color: getReadableTextColor(customColor) },
      };
    }
    const styles: Record<string, string> = {
      FUEL: "bg-warning/10 text-warning border border-warning/30",
      RESTAURANT: "bg-danger/10 text-danger border border-danger/30",
      SUPERMARKET: "bg-success/10 text-success border border-success/30",
      TRANSPORT: "bg-primary/10 text-primary border border-primary/30",
      HEALTH: "bg-success/10 text-success border border-success/30",
      UTILITIES: "bg-muted text-muted-foreground border border-border",
      TELECOM: "bg-warning/10 text-warning border border-warning/30",
      CLOTHING: "bg-primary/10 text-primary border border-primary/30",
      EDUCATION: "bg-primary/10 text-primary border border-primary/30",
      ENTERTAINMENT: "bg-warning/10 text-warning border border-warning/30",
      SERVICES: "bg-muted text-muted-foreground border border-border",
    };
    return { className: styles[normalized] || "bg-muted text-muted-foreground border border-border" };
  };
  return (
    <div className="invodata-card">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h3 className="font-semibold text-lg text-foreground">{t("dashboard.recentInvoices")}</h3>
        <Link to="/invoices" className="text-sm text-primary font-medium hover:underline">
          {t("dashboard.seeAll")}
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("dashboard.issuer")}
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("dashboard.invoiceNumber")}
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("common.date")}
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("common.category")}
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("dashboard.value")}
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-3">
                {t("dashboard.action")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.loadingInvoices")}
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-danger">
                  {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.noRecentInvoices")}
                </td>
              </tr>
            )}
            {!isLoading && !error && invoices.map((invoice) => (
              <tr key={invoice.publicId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                      {invoice.issuer?.name?.slice(0, 2)?.toUpperCase() || "--"}
                    </div>
                    {invoice.publicId ? (
                      <Link to={`/invoices/${invoice.publicId}`} className="font-medium text-foreground hover:underline">
                        {invoice.issuer?.name || t("dashboard.noIssuer")}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{invoice.issuer?.name || t("dashboard.noIssuer")}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                    {invoice.documentNum || t("dashboard.na")}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {formatDate(invoice.date)}
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {(() => {
                    const badge = getIssuerCategoryStyles(invoice.category);
                    return (
                      <Badge
                        variant="secondary"
                        className={cn("capitalize", badge.className)}
                        style={badge.style}
                      >
                        {getIssuerCategoryLabel(invoice.category)}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="px-6 py-4 font-medium text-foreground">
                  {formatCurrency(invoice.totalAmount)}
                </td>
                <td className="px-6 py-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
