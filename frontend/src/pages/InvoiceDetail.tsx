import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Download, Pencil, ShieldCheck, CreditCard, Trash2 } from "lucide-react";
import { deleteInvoice, downloadInvoiceFile, getAuthToken, getInvoiceById, getCustomCategories, Invoice, CustomCategory } from "@/lib/api";

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number") return "-";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };

   const getIssuerCategoryLabel = (category?: string | null) => {
     if (!category) return t("invoices.noCategory");
     const normalized = category.trim().toUpperCase();

     // Check if it's a custom category reference
     if (normalized.startsWith("CUSTOM_")) {
       const idStr = normalized.split("_")[1];
       const customCatId = Number.parseInt(idStr, 10);

       // Try to find by numeric ID
       const customCat = customCategories.find((cat) => cat.id === customCatId);

       if (customCat) {
         return customCat.name;
       }

       // If custom category not found, return the raw value (debugging)
       console.warn(`Custom category ${normalized} not found in:`, customCategories);
       return category;
     }

     // For predefined categories, use translation with fallback to the category name itself
     return t(`issuerCategories.${normalized}`, { defaultValue: category });
   };

   useEffect(() => {
     if (!id) return;
     const invoiceId = Number(id);
     if (Number.isNaN(invoiceId)) {
       setError(t("invoiceDetail.errors.invalidId"));
       setIsLoading(false);
       return;
     }
     const token = getAuthToken();
     if (!token) {
       setError(t("invoiceDetail.errors.sessionExpired"));
       setIsLoading(false);
       return;
     }

     let isMounted = true;

     // Load both custom categories and invoice in parallel
     Promise.all([
       getCustomCategories()
         .then((categories) => {
           if (!isMounted) return;
           console.log("Loaded custom categories:", categories);
           setCustomCategories(categories || []);
         })
         .catch((err) => {
           if (!isMounted) return;
           console.error("Failed to load custom categories:", err);
           setCustomCategories([]);
         }),
       getInvoiceById(invoiceId)
         .then((data) => {
           if (!isMounted) return;
           console.log("Loaded invoice:", data);
           setInvoice(data);
         })
         .catch((err) => {
           if (!isMounted) return;
           const message = err instanceof Error ? err.message : t("invoiceDetail.errors.load");
           setError(message);
         })
     ])
       .finally(() => {
         if (isMounted) setIsLoading(false);
       });

     return () => {
       isMounted = false;
     };
   }, [id, t]);

  const handleDownload = async () => {
    if (!invoice?.id || isDownloading) return;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadInvoiceFile(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceDetail.errors.download");
      setDownloadError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoice?.id || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteInvoice(invoice.id);
      navigate("/invoices");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoices.deleteError");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/invoices" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            {t("invoiceDetail.backToInvoices")}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">{t("invoiceDetail.breadcrumb")}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={handleDownload} disabled={isDownloading}>
            <Download className="w-4 h-4" />
            {isDownloading ? t("invoiceDetail.downloading") : t("invoiceDetail.download")}
          </Button>
          <Button className="gap-2" asChild>
            <Link to={`/invoices/${id}/edit`}>
              <Pencil className="w-4 h-4" />
              {t("invoiceDetail.edit")}
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2" disabled={!invoice}>
                <Trash2 className="w-4 h-4" />
                {t("invoices.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("invoices.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("invoices.deleteDescription")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("invoices.deleteCancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteInvoice} disabled={isDeleting}>
                  {t("invoices.deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {downloadError && (
        <div className="invodata-card p-4 mb-6 text-sm text-danger">
          {downloadError}
        </div>
      )}

      {isLoading && (
        <div className="invodata-card p-6 text-center text-sm text-muted-foreground">
          {t("invoiceDetail.loading")}
        </div>
      )}
      {!isLoading && error && (
        <div className="invodata-card p-6 text-center text-sm text-danger">
          {error}
        </div>
      )}
      {!isLoading && !error && invoice && (
        <>
          {/* Invoice Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground">{invoice.issuer?.name || t("invoiceDetail.clientFallback")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("invoiceDetail.documentLabel", { documentNum: invoice.documentNum })}
            </p>
          </div>

          {/* Invoice Meta */}
          <div className="invodata-card p-6 mb-8">
            <div className="grid grid-cols-1 gap-y-6 md:grid-cols-5 md:gap-x-8">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.date")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">{formatDate(invoice.date)}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.category")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {getIssuerCategoryLabel(invoice.issuer?.category)}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.paymentMethod")}</span>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <p className="text-lg font-semibold text-foreground">
                    {invoice.paymentMethod || t("invoiceDetail.na")}
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.taxIdLabel")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {invoice.issuer?.taxId || t("invoiceDetail.na")}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.licensePlate")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {invoice.licensePlate || t("invoiceDetail.na")}
                </p>
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="invodata-card mb-8">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{t("invoiceDetail.itemsTitle")}</h2>
              <span className="px-3 py-1 rounded-full border border-border text-sm font-medium">
                {t("invoiceDetail.itemsCount", { count: invoice.items?.length || 0 })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.description")}
                    </th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.quantity")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.unitPrice")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.vatPercent")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.vat")}
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((item, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="px-6 py-4 font-medium text-foreground">{item.description || "-"}</td>
                      <td className="px-6 py-4 text-center text-muted-foreground">{item.quantity ?? "-"}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {typeof item.taxPercent === "number" ? `${item.taxPercent}%` : "0%"}
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">
                        {formatCurrency(item.taxPrice ?? 0)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-foreground">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="p-6 border-t border-border">
              <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center gap-12">
                  <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(invoice.netAmount)}</span>
                </div>
                <div className="flex items-center gap-12">
                  <span className="text-muted-foreground">{t("invoiceDetail.vat")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex items-center gap-12 pt-2 border-t border-border">
                  <span className="text-lg font-semibold text-foreground">{t("invoiceDetail.total")}</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="invodata-card p-6 mb-8">
            <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.notes")}</span>
            <p className="text-lg font-semibold text-foreground mt-1">
              {invoice.notes || t("invoiceDetail.na")}
            </p>
          </div>

          {/* Verification Badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-medium text-primary uppercase text-sm tracking-wide">
              {t("invoiceDetail.verified")}
            </span>
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              {t("invoiceDetail.footer")}
            </p>
          </footer>
        </>
      )}
    </DashboardLayout>
  );
};

export default InvoiceDetail;
