import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  getAuthToken,
  importSharedInvoiceByToken,
  downloadSharedInvoiceFileByToken,
  downloadSharedInvoiceFileForUser,
  getSharedInvoiceByToken,
  getSharedInvoiceForUser,
  type InvoiceShareSnapshotResponse,
  type Invoice,
} from "@/lib/api";

const SharedInvoice = () => {
  const { token, shareId } = useParams();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<InvoiceShareSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedInvoice, setImportedInvoice] = useState<Invoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";

  const isLoggedIn = Boolean(getAuthToken());
  const allowPdf = data?.allowPdf !== false;
  const allowImport = data?.allowImport !== false;

  const invoice = data?.invoice;

  const shareLabel = useMemo(() => {
    if (data?.type === "public") return t("share.publicLink");
    return t("share.userLink");
  }, [data?.type, t]);

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatCurrency = (value?: number | null) => {
    if (typeof value !== "number") return "-";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  };

  const shouldShowEncryptionHint = (message?: string | null) => {
    if (!message) return false;
    return /encryption|encript/i.test(message);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (token) {
          const response = await getSharedInvoiceByToken(token);
          if (isMounted) setData(response);
          return;
        }
        if (shareId) {
          const auth = getAuthToken();
          if (!auth) {
            throw new Error(t("share.loginRequired"));
          }
          const response = await getSharedInvoiceForUser(Number(shareId));
          if (isMounted) setData(response);
          return;
        }
        throw new Error(t("share.invalidLink"));
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("share.loadError");
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [shareId, token, t]);

  const handleViewPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const result = token
        ? await downloadSharedInvoiceFileByToken(token)
        : shareId
          ? await downloadSharedInvoiceFileForUser(Number(shareId))
          : null;
      if (!result) {
        throw new Error(t("share.pdfError"));
      }
      triggerDownload(result.blob, result.filename);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("share.pdfError");
      setPdfError(message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleImport = async () => {
    if (!token) {
      return;
    }
    const auth = getAuthToken();
    if (!auth) {
      setImportError(t("share.loginRequired"));
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const invoice = await importSharedInvoiceByToken(token);
      setImportedInvoice(invoice);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("share.importError");
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{shareLabel}</p>
            <h1 className="text-3xl font-bold text-foreground">{t("share.title")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowPdf && invoice && (
              <Button variant="outline" onClick={handleViewPdf} disabled={pdfLoading}>
                {pdfLoading ? t("share.pdfLoading") : t("share.viewPdf")}
              </Button>
            )}
            {token && allowImport && invoice && isLoggedIn && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? t("share.importing") : t("share.import")}
              </Button>
            )}
            {importedInvoice?.publicId && (
              <Button variant="outline" asChild>
                <Link to={`/invoices/${importedInvoice.publicId}`}>
                  {t("share.openImported")}
                </Link>
              </Button>
            )}
            <Link to="/login" className="text-sm text-primary hover:underline">
              {t("share.backToLogin")}
            </Link>
          </div>
        </div>

        {loading && (
          <div className="invodata-card mt-6 p-6 text-sm text-muted-foreground">
            {t("share.loading")}
          </div>
        )}

        {!loading && error && (
          <div className="invodata-card mt-6 p-6 text-sm text-danger">{error}</div>
        )}

        {!loading && importError && (
          <div className="invodata-card mt-4 p-4 text-sm text-danger">{importError}</div>
        )}

        {!loading && pdfError && (
          <div className="invodata-card mt-4 p-4 text-sm text-danger">{pdfError}</div>
        )}
        {!loading && importedInvoice && (
          <div className="invodata-card mt-4 p-4 text-sm text-foreground">
            {t("share.importSuccess")}
          </div>
        )}

        {!loading && pdfError && shouldShowEncryptionHint(pdfError) && (
          <div className="invodata-card mt-4 p-4 text-sm text-muted-foreground">
            {t("share.pdfEncryptionHint")}
          </div>
        )}


        {!loading && !error && invoice && (
          <>
            <div className="invodata-card mt-6 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    {invoice.issuerName || t("invoiceDetail.clientFallback")}
                  </h2>
                  <p className="text-muted-foreground">
                    {t("invoiceDetail.documentLabel", { documentNum: invoice.documentNum || "-" })}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("share.sharedAt")}: {formatDate(data?.createdAt)}
                </div>
              </div>
            </div>

            <div className="invodata-card mt-6 p-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.date")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">{formatDate(invoice.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.category")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {invoice.category || t("invoices.noCategory")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.paymentMethod")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {invoice.paymentMethod || t("invoiceDetail.na")}
                  </p>
                </div>
              </div>
            </div>

            <div className="invodata-card mt-6 p-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.total")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(invoice.totalAmount ?? undefined)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.vat")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(invoice.taxAmount ?? undefined)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.subtotal")}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(invoice.netAmount ?? undefined)}
                  </p>
                </div>
              </div>
            </div>

            {invoice.items && invoice.items.length > 0 && (
              <div className="invodata-card mt-6 p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t("invoiceDetail.itemsTitle")}</h3>
                <div className="space-y-3">
                  {invoice.items.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="border border-border rounded-lg p-4">
                      <p className="text-sm font-medium text-foreground">
                        {item.description || t("invoiceDetail.na")}
                      </p>
                      <div className="mt-2 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                        <span>{t("invoiceDetail.table.quantity")}: {item.quantity ?? "-"}</span>
                        <span>{t("invoiceDetail.table.unitPrice")}: {formatCurrency(item.unitPrice ?? undefined)}</span>
                        <span>{t("invoiceDetail.table.total")}: {formatCurrency(item.totalPrice ?? undefined)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="invodata-card mt-6 p-6 text-sm text-muted-foreground">
              {t("share.filesNotice")}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SharedInvoice;
