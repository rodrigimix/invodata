import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Download, Pencil, ShieldCheck, CreditCard, Trash2, Share2, Copy } from "lucide-react";
import {
  createInvoiceShare,
  deleteInvoice,
  declineUserShare,
  downloadInvoiceFile,
  downloadSharedInvoiceFileForUser,
  getAuthToken,
  getInvoiceById,
  getSharedInvoiceForUser,
  listInvoiceShares,
  revokeInvoiceShare,
  type Invoice,
  type InvoiceShareResponse,
  type InvoiceShareSnapshotResponse,
} from "@/lib/api";

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [ownerPdfOpen, setOwnerPdfOpen] = useState(false);
  const [ownerPdfUrl, setOwnerPdfUrl] = useState<string | null>(null);
  const [ownerPdfFilename, setOwnerPdfFilename] = useState<string | null>(null);
  const [ownerPdfBlob, setOwnerPdfBlob] = useState<Blob | null>(null);
  const [ownerPdfError, setOwnerPdfError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingShare, setIsRemovingShare] = useState(false);
  const [removeSharedDialogOpen, setRemoveSharedDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePublic, setSharePublic] = useState(false);
  const [shareExpires, setShareExpires] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareAllowImport, setShareAllowImport] = useState(true);
  const [shareAllowPdf, setShareAllowPdf] = useState(true);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shares, setShares] = useState<InvoiceShareResponse[]>([]);
  const [sharedSnapshot, setSharedSnapshot] = useState<InvoiceShareSnapshotResponse | null>(null);
  const [sharedPdfOpen, setSharedPdfOpen] = useState(false);
  const [sharedPdfUrl, setSharedPdfUrl] = useState<string | null>(null);
  const [sharedPdfFilename, setSharedPdfFilename] = useState<string | null>(null);
  const [sharedPdfBlob, setSharedPdfBlob] = useState<Blob | null>(null);
  const [sharedPdfLoading, setSharedPdfLoading] = useState(false);
  const [sharedPdfError, setSharedPdfError] = useState<string | null>(null);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";

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
    return t(`issuerCategories.${normalized}`, { defaultValue: category });
  };

  useEffect(() => {
    if (!id) return;
    const token = getAuthToken();
    if (!token) {
      setError(t("invoiceDetail.errors.sessionExpired"));
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    getInvoiceById(id)
      .then((data) => {
        if (!isMounted) return;
        setInvoice(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("invoiceDetail.errors.load");
        setError(message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!invoice?.publicId || invoice.shared) return;
    let isMounted = true;
    listInvoiceShares(invoice.publicId)
      .then((data) => {
        if (!isMounted) return;
        setShares(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setShares([]);
      });
    return () => {
      isMounted = false;
    };
  }, [invoice?.publicId]);

  useEffect(() => {
    if (!invoice?.shared || !invoice.shareId) return;
    let isMounted = true;
    getSharedInvoiceForUser(invoice.shareId)
      .then((data) => {
        if (!isMounted) return;
        setSharedSnapshot(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setSharedSnapshot(null);
      });
    return () => {
      isMounted = false;
    };
  }, [invoice?.shared, invoice?.shareId]);

  useEffect(() => {
    if (sharedPdfOpen) return;
    if (sharedPdfUrl) {
      URL.revokeObjectURL(sharedPdfUrl);
    }
    setSharedPdfUrl(null);
    setSharedPdfFilename(null);
    setSharedPdfBlob(null);
    setSharedPdfError(null);
  }, [sharedPdfOpen, sharedPdfUrl]);

  useEffect(() => {
    if (ownerPdfOpen) return;
    if (ownerPdfUrl) {
      URL.revokeObjectURL(ownerPdfUrl);
    }
    setOwnerPdfUrl(null);
    setOwnerPdfFilename(null);
    setOwnerPdfBlob(null);
    setOwnerPdfError(null);
  }, [ownerPdfOpen, ownerPdfUrl]);

  const handleDownload = async () => {
    if (!invoice?.publicId || isDownloading || invoice.shared) return;
    setDownloadError(null);
    setOwnerPdfError(null);
    setOwnerPdfOpen(true);
    if (ownerPdfUrl || ownerPdfBlob) return;
    setIsDownloading(true);
    try {
      const { blob, filename } = await downloadInvoiceFile(invoice.publicId);
      const url = URL.createObjectURL(blob);
      setOwnerPdfUrl(url);
      setOwnerPdfFilename(filename);
      setOwnerPdfBlob(blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceDetail.errors.download");
      setDownloadError(message);
      setOwnerPdfError(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadOwnerPdf = () => {
    if (!ownerPdfBlob || !ownerPdfFilename) return;
    const url = URL.createObjectURL(ownerPdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ownerPdfFilename;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeleteInvoice = async () => {
    if (!invoice?.publicId || isDeleting || invoice.shared) return;
    setIsDeleting(true);
    try {
      await deleteInvoice(invoice.publicId);
      navigate("/invoices");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoices.deleteError");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveSharedInvoice = async () => {
    if (!invoice?.shareId || isRemovingShare) return;
    setIsRemovingShare(true);
    try {
      await declineUserShare(invoice.shareId);
      navigate("/invoices");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceDetail.removeSharedError");
      setError(message);
    } finally {
      setIsRemovingShare(false);
    }
  };

  const allowSharedPdf = sharedSnapshot ? sharedSnapshot.allowPdf !== false : false;
  const allowSharedPdfDownload = sharedSnapshot ? sharedSnapshot.allowPdfDownload !== false : false;

  const handleOpenSharedPdf = async () => {
    if (!invoice?.shareId || !allowSharedPdf) return;
    setSharedPdfOpen(true);
    if (sharedPdfUrl || sharedPdfLoading) return;
    setSharedPdfLoading(true);
    setSharedPdfError(null);
    try {
      const result = await downloadSharedInvoiceFileForUser(invoice.shareId);
      const url = URL.createObjectURL(result.blob);
      setSharedPdfUrl(url);
      setSharedPdfFilename(result.filename);
      setSharedPdfBlob(result.blob);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("share.pdfError");
      setSharedPdfError(message);
    } finally {
      setSharedPdfLoading(false);
    }
  };

  const handleDownloadSharedPdf = () => {
    if (!sharedPdfBlob || !sharedPdfFilename) return;
    const url = URL.createObjectURL(sharedPdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = sharedPdfFilename;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildShareLink = (share: InvoiceShareResponse) => {
    const origin = window.location.origin;
    if (share.type === "public" && share.token) {
      return `${origin}/shared/token/${share.token}`;
    }
    return null;
  };

  const handleCreateShare = async () => {
    if (!invoice?.publicId || shareLoading) return;
    setShareError(null);
    setShareLink(null);
    setShareNotice(null);
    setShareLoading(true);
    try {
      const expiresInDays = shareExpires ? Number(shareExpires) : undefined;
      const response = await createInvoiceShare(invoice.publicId, {
        username: sharePublic ? undefined : shareUsername.trim(),
        publicLink: sharePublic,
        expiresInDays: Number.isFinite(expiresInDays) ? expiresInDays : undefined,
        allowImport: shareAllowImport,
        allowPdf: shareAllowPdf,
        allowPdfDownload: shareAllowPdf,
      });
      const link = buildShareLink(response);
      setShareLink(link);
      if (!link) {
        setShareNotice(t("share.userSharedNotice"));
      }
      setShareUsername("");
      setShareExpires("");
      setShareAllowImport(true);
      setShareAllowPdf(true);
      const updated = await listInvoiceShares(invoice.publicId);
      setShares(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("share.createError");
      setShareError(message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (shareId: number) => {
    if (!invoice?.publicId) return;
    try {
      await revokeInvoiceShare(invoice.publicId, shareId);
      const updated = await listInvoiceShares(invoice.publicId);
      setShares(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("share.revokeError");
      setShareError(message);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setShareLink(link);
    } catch {
      setShareError(t("share.copyError"));
    }
  };

  return (
    <DashboardLayout>
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/invoices" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            {t("invoiceDetail.backToInvoices")}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">{t("invoiceDetail.breadcrumb")}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {!invoice?.shared && (
            <>
              <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleDownload} disabled={isDownloading}>
                <Download className="w-4 h-4" />
                {isDownloading ? t("invoiceDetail.downloading") : t("invoiceDetail.download")}
              </Button>
              <Button className="gap-2 w-full sm:w-auto" asChild>
                <Link to={`/invoices/${id}/edit`}>
                  <Pencil className="w-4 h-4" />
                  {t("invoiceDetail.edit")}
                </Link>
              </Button>
              <Button
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => setShareDialogOpen(true)}
              >
                <Share2 className="w-4 h-4" />
                {t("share.action")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2 w-full sm:w-auto" disabled={!invoice}>
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
                    <AlertDialogAction variant="destructive" onClick={handleDeleteInvoice} disabled={isDeleting}>
                      {t("invoices.deleteConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {invoice?.shared && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {allowSharedPdf && (
                <Button
                  variant="outline"
                  className="gap-2 w-full sm:w-auto"
                  onClick={handleOpenSharedPdf}
                  disabled={sharedPdfLoading}
                >
                  {sharedPdfLoading ? t("share.pdfLoading") : t("invoiceDetail.viewSharedPdf")}
                </Button>
              )}
              <AlertDialog open={removeSharedDialogOpen} onOpenChange={setRemoveSharedDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="gap-2 w-full sm:w-auto"
                    disabled={isRemovingShare}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("invoiceDetail.removeShared")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("invoiceDetail.removeSharedTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("invoiceDetail.removeSharedDescription")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isRemovingShare}>{t("invoices.deleteCancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleRemoveSharedInvoice}
                      disabled={isRemovingShare}
                    >
                      {isRemovingShare
                        ? t("invoiceDetail.removeSharedConfirming")
                        : t("invoiceDetail.removeSharedConfirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("share.title")}</DialogTitle>
            <DialogDescription>{t("share.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{t("share.publicLink")}</p>
                <p className="text-xs text-muted-foreground">{t("share.publicHint")}</p>
              </div>
              <Switch checked={sharePublic} onCheckedChange={(value) => setSharePublic(value === true)} />
            </div>

            {!sharePublic && (
              <div className="space-y-2">
                <Label htmlFor="share-username">{t("share.username")}</Label>
                <Input
                  id="share-username"
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                  placeholder={t("share.usernamePlaceholder")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="share-expires">{t("share.expiresIn")}</Label>
              <Input
                id="share-expires"
                type="number"
                value={shareExpires}
                onChange={(e) => setShareExpires(e.target.value)}
                placeholder={t("share.expiresPlaceholder")}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("share.allowImport")}</p>
                  <p className="text-xs text-muted-foreground">{t("share.allowImportHint")}</p>
                </div>
                <Switch
                  checked={shareAllowImport}
                  onCheckedChange={(value) => setShareAllowImport(value === true)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("share.allowPdf")}</p>
                  <p className="text-xs text-muted-foreground">{t("share.allowPdfHint")}</p>
                </div>
                <Switch checked={shareAllowPdf} onCheckedChange={(value) => setShareAllowPdf(value === true)} />
              </div>
            </div>

            {shareError && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {shareError}
              </div>
            )}

            {shareLink && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="text-muted-foreground mb-2">{t("share.linkReady")}</p>
                <div className="flex items-center gap-2">
                  <Input value={shareLink} readOnly className="text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyLink(shareLink)}
                    aria-label={t("share.copy")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {shareNotice && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {shareNotice}
              </div>
            )}

            {shares.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("share.activeShares")}</p>
                <div className="space-y-3">
                  {shares.map((share) => (
                    <div key={share.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm text-foreground">
                          {share.type === "public"
                            ? t("share.publicLink")
                            : t("share.userShare", { user: share.sharedWith || "-" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {share.expiresAt
                            ? t("share.expiresAt", { date: new Date(share.expiresAt).toLocaleDateString() })
                            : t("share.noExpiry")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {share.type === "public" && share.token && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(buildShareLink(share) || "")}
                          >
                            {t("share.copy")}
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeShare(share.id)}
                        >
                          {t("share.revoke")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateShare}
              disabled={shareLoading || (!sharePublic && !shareUsername.trim())}
            >
              {shareLoading ? t("share.creating") : t("share.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={sharedPdfOpen} onOpenChange={setSharedPdfOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("invoiceDetail.sharedPdfTitle")}</DialogTitle>
            <DialogDescription>{t("invoiceDetail.sharedPdfDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/20">
            {sharedPdfError && (
              <div className="p-4 text-sm text-danger">{sharedPdfError}</div>
            )}
            {!sharedPdfError && !sharedPdfUrl && sharedPdfLoading && (
              <div className="p-4 text-sm text-muted-foreground">{t("share.pdfLoading")}</div>
            )}
            {!sharedPdfError && sharedPdfUrl && (
              <iframe
                title={t("invoiceDetail.sharedPdfTitle")}
                src={sharedPdfUrl}
                className="h-[70vh] w-full rounded-lg"
              />
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setSharedPdfOpen(false)}>
              {t("invoices.deleteCancel")}
            </Button>
            {allowSharedPdfDownload && sharedPdfBlob && sharedPdfFilename && (
              <Button variant="default" onClick={handleDownloadSharedPdf}>
                {t("invoiceDetail.sharedPdfDownload")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={ownerPdfOpen} onOpenChange={setOwnerPdfOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("invoiceDetail.pdfTitle")}</DialogTitle>
            <DialogDescription>{t("invoiceDetail.pdfDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/20">
            {ownerPdfError && (
              <div className="p-4 text-sm text-danger">{ownerPdfError}</div>
            )}
            {!ownerPdfError && !ownerPdfUrl && isDownloading && (
              <div className="p-4 text-sm text-muted-foreground">{t("invoiceDetail.downloading")}</div>
            )}
            {!ownerPdfError && ownerPdfUrl && (
              <iframe
                title={t("invoiceDetail.pdfTitle")}
                src={ownerPdfUrl}
                className="h-[70vh] w-full rounded-lg"
              />
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setOwnerPdfOpen(false)}>
              {t("invoices.deleteCancel")}
            </Button>
            {ownerPdfBlob && ownerPdfFilename && (
              <Button variant="default" onClick={handleDownloadOwnerPdf}>
                {t("invoiceDetail.pdfDownload")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">{invoice.issuer?.name || t("invoiceDetail.clientFallback")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("invoiceDetail.documentLabel", { documentNum: invoice.documentNum })}
            </p>
          </div>

          {/* Invoice Meta */}
          <div className="invodata-card p-6 mb-8">
            <div className="grid grid-cols-1 gap-y-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-x-8">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.date")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">{formatDate(invoice.date)}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground uppercase">{t("invoiceDetail.category")}</span>
                <p className="text-lg font-semibold text-foreground mt-1">
                  {getIssuerCategoryLabel(invoice.category)}
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
              <table className="w-full min-w-[760px]">
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
                    <th className="hidden sm:table-cell text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
                      {t("invoiceDetail.table.vatPercent")}
                    </th>
                    <th className="hidden sm:table-cell text-right text-xs font-medium text-muted-foreground uppercase px-6 py-4">
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
                      <td className="hidden sm:table-cell px-6 py-4 text-right text-muted-foreground">
                        {typeof item.taxPercent === "number" ? `${item.taxPercent}%` : "0%"}
                      </td>
                      <td className="hidden sm:table-cell px-6 py-4 text-right text-muted-foreground">
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
                <div className="flex items-center gap-6 sm:gap-12">
                  <span className="text-muted-foreground">{t("invoiceDetail.subtotal")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(invoice.netAmount)}</span>
                </div>
                <div className="flex items-center gap-6 sm:gap-12">
                  <span className="text-muted-foreground">{t("invoiceDetail.vat")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(invoice.taxAmount)}</span>
                </div>
                <div className="flex items-center gap-6 sm:gap-12 pt-2 border-t border-border">
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
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-wrap items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-medium text-primary uppercase text-sm tracking-wide">
              {t("invoiceDetail.verified")}
            </span>
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-border text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("invoiceDetail.footer")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/terms" className="hover:text-foreground">
                {t("auth.termsLink")}
              </Link>
              <Link to="/privacy" className="hover:text-foreground">
                {t("auth.privacyPolicy")}
              </Link>
              <a href={surveyUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
                {surveyLabel}
              </a>
            </div>
          </footer>
        </>
      )}
    </DashboardLayout>
  );
};

export default InvoiceDetail;
