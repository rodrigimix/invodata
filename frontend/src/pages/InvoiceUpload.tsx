import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { FileText, Upload, CheckCircle2, ShieldCheck, Info, X, ChevronDown } from "lucide-react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker?url";
import { cancelUploadJob, createUploadJob, getInvoices, requestRedactedPreview, type RedactionBox } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUploadJobs, type UploadEntry } from "@/context/UploadJobContext";

GlobalWorkerOptions.workerSrc = workerSrc;

const InvoiceUpload = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const { entries: uploadEntries, updateEntries, enablePopupForBatch } = useUploadJobs();
  const [recentUploads, setRecentUploads] = useState<Array<{
    fileName: string;
    count: number;
    latestAt: string;
  }>>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [processingOpen, setProcessingOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [manualName, setManualName] = useState("");
  const [manualTaxId, setManualTaxId] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [extraRedactionTerms, setExtraRedactionTerms] = useState("");
  const [storeRedactedOnly, setStoreRedactedOnly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewContentType, setPreviewContentType] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewRenderError, setPreviewRenderError] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentRectRef = useRef<RedactionBox | null>(null);
  const renderRetryRef = useRef(0);
  const dragCounterRef = useRef(0);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const buildPrivacyPayload = () => {
    const baseTerms = [manualAddress, manualPhone];
    const extraTerms = extraRedactionTerms
      .split(";")
      .map((term) => term.trim())
      .filter(Boolean);
    const allTerms = [...baseTerms, ...extraTerms].map((term) => term.trim()).filter(Boolean);
    return {
      userTaxId: manualTaxId.trim() || undefined,
      redactName: manualName.trim() || undefined,
      redactTerms: allTerms.length > 0 ? allTerms.join(";") : undefined,
      storeRedactedOnly,
    };
  };

  const buildMaskedFilename = (originalName: string, contentType?: string | null) => {
    const hasExtension = /\.[^./\\]+$/.test(originalName);
    const base = hasExtension ? originalName.replace(/\.[^./\\]+$/, "") : originalName;
    if (contentType?.includes("pdf")) {
      return `${base}-mascarada.pdf`;
    }
    if (contentType?.startsWith("image/")) {
      const ext = contentType.split("/")[1] || "png";
      return `${base}-mascarada.${ext}`;
    }
    return `${base}-mascarada`;
  };

  const startServerRedaction = async (entry: UploadEntry) => {
    if (!entry.file) return;
    if (entry.redactedPreviewUrl) {
      URL.revokeObjectURL(entry.redactedPreviewUrl);
    }
    updateEntries((prev) =>
      prev.map((item) =>
        item.fileName === entry.fileName
          ? { ...item, redactionStatus: "masking", redactionError: undefined }
          : item
      )
    );
    try {
      const { userTaxId, redactName, redactTerms } = buildPrivacyPayload();
      const { blob, contentType } = await requestRedactedPreview(entry.file, {
        userTaxId,
        redactName,
        redactTerms,
        redactBoxes: entry.redactionBoxes,
      });
      const previewUrl = URL.createObjectURL(blob);
      const maskedName = buildMaskedFilename(entry.file.name, contentType);
      const redactedFile = new File([blob], maskedName, { type: contentType || entry.file.type });
      updateEntries((prev) =>
        prev.map((item) =>
          item.fileName === entry.fileName
            ? {
              ...item,
              redactedFile,
              redactedPreviewUrl: previewUrl,
              redactedContentType: contentType,
              redactionStatus: "ready",
            }
            : item
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceUpload.errors.maskServer");
      updateEntries((prev) =>
        prev.map((item) =>
          item.fileName === entry.fileName
            ? { ...item, redactionStatus: "error", redactionError: message }
            : item
        )
      );
    }
  };

  const handlePreviewMask = (entry: UploadEntry) => {
    setPreviewOpen(true);
    setPreviewLoading(entry.redactionStatus === "masking");
    setPreviewError(entry.redactionError || null);
    setPreviewFileName(entry.fileName);
    setPreviewUrl(entry.redactedPreviewUrl || null);
    setPreviewContentType(entry.redactedContentType || entry.file?.type || null);
    setPreviewPage(1);
    setPreviewPageCount(1);
    setDrawMode(false);
    setPreviewRenderError(null);
  };

  const handlePreviewOpenChange = (open: boolean) => {
    setPreviewOpen(open);
    if (!open) {
      setPreviewError(null);
      setPreviewFileName(null);
      setPreviewUrl(null);
      setPreviewContentType(null);
      setPreviewLoading(false);
      setDrawMode(false);
      setPreviewPage(1);
      setPreviewPageCount(1);
      setPreviewRenderError(null);
      pdfDocRef.current = null;
      pdfUrlRef.current = null;
      isDrawingRef.current = false;
      drawStartRef.current = null;
      currentRectRef.current = null;
      renderRetryRef.current = 0;
    }
  };

  const previewEntry = useMemo(() => {
    if (!previewFileName) return null;
    return uploadEntries.find((item) => item.fileName === previewFileName) || null;
  }, [previewFileName, uploadEntries]);

  const getBoxesForPage = (entry: UploadEntry | null, page: number) => {
    if (!entry?.redactionBoxes) return [];
    return entry.redactionBoxes.filter((box) => (box.page || 1) === page);
  };

  const syncOverlayCanvas = () => {
    const baseCanvas = previewCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!baseCanvas || !overlayCanvas) return;
    overlayCanvas.width = baseCanvas.width;
    overlayCanvas.height = baseCanvas.height;
  };

  const drawOverlay = (entry: UploadEntry | null, page: number, currentRect?: RedactionBox | null) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const boxes = getBoxesForPage(entry, page);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 2;
    boxes.forEach((box) => {
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });
    if (currentRect) {
      ctx.strokeStyle = "rgba(217, 119, 6, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    }
  };

  const renderPdfPreview = async (sourceUrl: string, entry: UploadEntry | null, pageNumber: number) => {
    if (!sourceUrl) return;
    const baseCanvas = previewCanvasRef.current;
    if (!baseCanvas) return;
    setPreviewRenderError(null);
    try {
      let doc = pdfDocRef.current;
      if (!doc || pdfUrlRef.current !== sourceUrl) {
        const data = await fetch(sourceUrl).then((res) => res.arrayBuffer());
        const loadingTask = getDocument({ data });
        doc = await loadingTask.promise;
        pdfDocRef.current = doc;
        pdfUrlRef.current = sourceUrl;
        setPreviewPageCount(doc.numPages);
      }
      const safePage = Math.min(Math.max(pageNumber, 1), doc.numPages || 1);
      if (safePage !== pageNumber) {
        setPreviewPage(safePage);
        return;
      }
      const page = await doc.getPage(safePage);
      const viewport = page.getViewport({ scale: 1.4 });
      baseCanvas.width = Math.floor(viewport.width);
      baseCanvas.height = Math.floor(viewport.height);
      const ctx = baseCanvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      syncOverlayCanvas();
      drawOverlay(entry, safePage, currentRectRef.current);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceUpload.errors.renderPdf");
      setPreviewRenderError(message);
    }
  };

  const renderImagePreview = (sourceUrl: string, entry: UploadEntry | null) => {
    if (!sourceUrl) return;
    const baseCanvas = previewCanvasRef.current;
    if (!baseCanvas) return;
    setPreviewRenderError(null);
    const img = new Image();
    img.onload = () => {
      baseCanvas.width = img.naturalWidth || img.width;
      baseCanvas.height = img.naturalHeight || img.height;
      const ctx = baseCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, baseCanvas.width, baseCanvas.height);
      syncOverlayCanvas();
      drawOverlay(entry, 1, currentRectRef.current);
    };
    img.onerror = () => {
      setPreviewRenderError(t("invoiceUpload.errors.renderImage"));
    };
    img.src = sourceUrl;
  };

  const addRedactionBox = (entry: UploadEntry, box: RedactionBox) => {
    updateEntries((prev) =>
      prev.map((item) =>
        item.fileName === entry.fileName
          ? { ...item, redactionBoxes: [...(item.redactionBoxes ?? []), box] }
          : item
      )
    );
  };

  const clearPageBoxes = () => {
    if (!previewEntry) return;
    const page = previewContentType?.includes("pdf") ? previewPage : 1;
    updateEntries((prev) =>
      prev.map((item) =>
        item.fileName === previewEntry.fileName
          ? {
            ...item,
            redactionBoxes: (item.redactionBoxes ?? []).filter((box) => (box.page || 1) !== page),
          }
          : item
      )
    );
    currentRectRef.current = null;
    drawOverlay(previewEntry, page, null);
  };

  const applyPreviewBoxes = () => {
    if (!previewEntry) return;
    void startServerRedaction(previewEntry);
  };

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return null;
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(overlayCanvas.width, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(overlayCanvas.height, (event.clientY - rect.top) * scaleY)),
    };
  };

  const handleOverlayPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !previewEntry) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    isDrawingRef.current = true;
    drawStartRef.current = point;
    currentRectRef.current = {
      page: previewContentType?.includes("pdf") ? previewPage : 1,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      pageWidth: overlayCanvasRef.current?.width || 0,
      pageHeight: overlayCanvasRef.current?.height || 0,
    };
    drawOverlay(previewEntry, currentRectRef.current.page, currentRectRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleOverlayPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !previewEntry || !isDrawingRef.current || !drawStartRef.current) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const start = drawStartRef.current;
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.abs(point.x - start.x);
    const height = Math.abs(point.y - start.y);
    const page = previewContentType?.includes("pdf") ? previewPage : 1;
    currentRectRef.current = {
      page,
      x,
      y,
      width,
      height,
      pageWidth: overlayCanvasRef.current?.width || 0,
      pageHeight: overlayCanvasRef.current?.height || 0,
    };
    drawOverlay(previewEntry, page, currentRectRef.current);
  };

  const handleOverlayPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawMode || !previewEntry || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = currentRectRef.current;
    currentRectRef.current = null;
    drawStartRef.current = null;
    if (!rect || rect.width < 6 || rect.height < 6) {
      drawOverlay(previewEntry, rect?.page || 1, null);
      return;
    }
    addRedactionBox(previewEntry, rect);
    drawOverlay(
      { ...previewEntry, redactionBoxes: [...(previewEntry.redactionBoxes ?? []), rect] },
      rect.page,
      null
    );
  };

  const completedCount = useMemo(
    () => uploadEntries.filter((entry) => entry.status !== "uploading" && entry.status !== "idle").length,
    [uploadEntries]
  );
  const hasActiveUploads = useMemo(
    () => uploadEntries.some((entry) => entry.status === "uploading"),
    [uploadEntries]
  );
  const isDuplicateEntry = (entry: UploadEntry) => {
    const errorMessage = entry.error || "";
    return (
      entry.status === "error" &&
      (errorMessage.toLowerCase().includes("ja existe") ||
        errorMessage.toLowerCase().includes("já existe"))
    );
  };
  const eligibleEntries = useMemo(
    () =>
      uploadEntries.filter((entry) => {
        if (!entry.file) return false;
        if (entry.status === "idle") return true;
        if (entry.status === "canceled") return true;
        if (entry.status !== "error") return false;
        if (isDuplicateEntry(entry)) return false;
        return (entry.retryCount ?? 0) < 2;
      }),
    [uploadEntries]
  );

  const fetchRecentUploads = async () => {
    try {
      const page = await getInvoices(0, 200, "createdAt,desc");
      const grouped = new Map<string, { count: number; latestAt: string }>();
      const ordered: Array<{ fileName: string; latestAt: string }> = [];
      page.content.forEach((invoice) => {
        if (!invoice.originalFileName) return;
        const createdAt = invoice.createdAt || invoice.date;
        if (!createdAt) return;
        const current = grouped.get(invoice.originalFileName);
        if (!current) {
          grouped.set(invoice.originalFileName, { count: 1, latestAt: createdAt });
          ordered.push({ fileName: invoice.originalFileName, latestAt: createdAt });
          return;
        }
        const candidate = new Date(createdAt).getTime();
        const existing = new Date(current.latestAt).getTime();
        grouped.set(invoice.originalFileName, {
          count: current.count + 1,
          latestAt: candidate > existing ? createdAt : current.latestAt,
        });
      });
      const list = ordered
        .map((entry) => ({ fileName: entry.fileName, ...grouped.get(entry.fileName)! }))
        .slice(0, 10);
      setRecentUploads(list);
    } catch {
      setRecentUploads([]);
    }
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const appendFiles = (files: File[]) => {
    if (files.length === 0) return;
    setSelectedFiles(files);
    const nextEntries: UploadEntry[] = files.map((file) => ({
      file,
      fileName: file.name,
      status: "idle",
      retryCount: 0,
      redactionStatus: "idle",
    }));
    const activeEntries = uploadEntries.filter((entry) => entry.status !== "success");
    const existingNames = new Set(activeEntries.map((entry) => entry.fileName));
    const deduped = nextEntries.filter((entry) => !existingNames.has(entry.fileName));
    updateEntries(() => [...activeEntries, ...deduped]);
    setUploadError(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    appendFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    const items = Array.from(event.dataTransfer.items || []);
    const files = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    appendFiles(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer?.types?.includes("Files")) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleUpload = async () => {
    if (eligibleEntries.length === 0) return;
    setUploadError(null);
    enablePopupForBatch();
    try {
      updateEntries((prev) =>
        prev.map((entry) => {
          if (!entry.file) return entry;
          if (entry.status === "idle" || entry.status === "canceled") {
            return {
              ...entry,
              status: "uploading",
              error: undefined,
              invoices: undefined,
              existingInvoices: undefined,
              jobId: undefined,
              cancelRequested: false,
              progress: 5,
            };
          }
          if (entry.status === "error" && !isDuplicateEntry(entry) && (entry.retryCount ?? 0) < 2) {
            return {
              ...entry,
              status: "uploading",
              error: undefined,
              invoices: undefined,
              existingInvoices: undefined,
              jobId: undefined,
              retryCount: (entry.retryCount ?? 0) + 1,
              cancelRequested: false,
              progress: 5,
            };
          }
          return entry;
        })
      );
      const tasks = eligibleEntries.map(async (entry) => {
        if (!entry.file) return;
        try {
          const privacyPayload = buildPrivacyPayload();
          const redactedFile = entry.redactedFile;
          if (storeRedactedOnly && !redactedFile) {
            throw new Error(t("invoiceUpload.errors.maskRequired"));
          }
          const fileToUpload = storeRedactedOnly ? redactedFile! : entry.file;
          const response = await createUploadJob(
            fileToUpload,
            privacyPayload,
            storeRedactedOnly ? undefined : redactedFile
          );
          let shouldCancel = false;
          updateEntries((prev) =>
            prev.map((item) => {
              if (item.fileName !== entry.fileName) return item;
              shouldCancel = Boolean(item.cancelRequested);
              return { ...item, jobId: response.jobId };
            })
          );
          if (shouldCancel) {
            await cancelUploadJob(response.jobId);
            updateEntries((prev) =>
              prev.map((item) =>
                item.fileName === entry.fileName
                  ? { ...item, status: "canceled", error: undefined, jobId: undefined, progress: 0 }
                  : item
              )
            );
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : t("invoiceUpload.errors.upload");
          updateEntries((prev) =>
            prev.map((item) =>
              item.fileName === entry.fileName
                ? { ...item, status: "error", error: message }
                : item
            )
          );
        }
      });
      await Promise.allSettled(tasks);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceUpload.errors.upload");
      setUploadError(message);
    }
  };

  const handleUploadEntry = async (entry: UploadEntry) => {
    if (!entry.file) return;
    if (entry.status === "uploading" || entry.status === "success") return;
    if (entry.status === "error" && isDuplicateEntry(entry)) return;
    if (entry.status === "error" && (entry.retryCount ?? 0) >= 2) return;
    setUploadError(null);
    enablePopupForBatch();
    updateEntries((prev) =>
      prev.map((item) => {
        if (item.fileName !== entry.fileName) return item;
        if (item.status === "idle" || item.status === "canceled") {
          return {
            ...item,
            status: "uploading",
            error: undefined,
            invoices: undefined,
            existingInvoices: undefined,
            jobId: undefined,
            cancelRequested: false,
            progress: 5,
          };
        }
        if (item.status === "error" && !isDuplicateEntry(item) && (item.retryCount ?? 0) < 2) {
          return {
            ...item,
            status: "uploading",
            error: undefined,
            invoices: undefined,
            existingInvoices: undefined,
            jobId: undefined,
            retryCount: (item.retryCount ?? 0) + 1,
            cancelRequested: false,
            progress: 5,
          };
        }
        return item;
      })
    );
    try {
      const privacyPayload = buildPrivacyPayload();
      const redactedFile = entry.redactedFile;
      if (storeRedactedOnly && !redactedFile) {
        throw new Error(t("invoiceUpload.errors.maskRequired"));
      }
      const fileToUpload = storeRedactedOnly ? redactedFile! : entry.file;
      const response = await createUploadJob(
        fileToUpload,
        privacyPayload,
        storeRedactedOnly ? undefined : redactedFile
      );
      let shouldCancel = false;
      updateEntries((prev) =>
        prev.map((item) => {
          if (item.fileName !== entry.fileName) return item;
          shouldCancel = Boolean(item.cancelRequested);
          return { ...item, jobId: response.jobId };
        })
      );
      if (shouldCancel) {
        await cancelUploadJob(response.jobId);
        updateEntries((prev) =>
          prev.map((item) =>
            item.fileName === entry.fileName
              ? { ...item, status: "canceled", error: undefined, jobId: undefined, progress: 0 }
              : item
          )
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoiceUpload.errors.upload");
      updateEntries((prev) =>
        prev.map((item) =>
          item.fileName === entry.fileName
            ? { ...item, status: "error", error: message }
            : item
        )
      );
    }
  };

  useEffect(() => {
    fetchRecentUploads();
  }, []);

  useEffect(() => {
    if (uploadEntries.length === 0) return;
    if (completedCount === uploadEntries.length) {
      fetchRecentUploads();
    }
  }, [completedCount, uploadEntries.length]);

  useEffect(() => {
    if (!previewOpen || !previewFileName) return;
    const entry = uploadEntries.find((item) => item.fileName === previewFileName);
    if (!entry) return;
    setPreviewLoading(entry.redactionStatus === "masking");
    setPreviewError(entry.redactionError || null);
    setPreviewUrl(entry.redactedPreviewUrl || null);
    setPreviewContentType(entry.redactedContentType || entry.file?.type || null);
    setPreviewRenderError(null);
  }, [previewOpen, previewFileName, uploadEntries]);

  useEffect(() => {
    if (!previewOpen) return;
    if (previewLoading || previewError) return;
    if (!previewUrl) return;
    let cancelled = false;
    renderRetryRef.current = 0;
    const attemptRender = () => {
      if (cancelled) return;
      if (!previewCanvasRef.current) {
        if (renderRetryRef.current < 8) {
          renderRetryRef.current += 1;
          window.setTimeout(attemptRender, 80);
        }
        return;
      }
      if (previewContentType?.includes("pdf")) {
        void renderPdfPreview(previewUrl, previewEntry, previewPage);
        return;
      }
      renderImagePreview(previewUrl, previewEntry);
    };
    attemptRender();
    return () => {
      cancelled = true;
    };
  }, [
    previewOpen,
    previewEntry,
    previewContentType,
    previewLoading,
    previewError,
    previewPage,
    previewUrl,
  ]);

  useEffect(() => {
    if (!previewOpen || !previewEntry) return;
    const page = previewContentType?.includes("pdf") ? previewPage : 1;
    drawOverlay(previewEntry, page, currentRectRef.current);
  }, [previewOpen, previewEntry, previewContentType, previewPage]);

  return (
    <DashboardLayout>
      <Dialog open={previewOpen} onOpenChange={handlePreviewOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("invoiceUpload.preview.title")}</DialogTitle>
            <DialogDescription>
              {previewFileName
                ? t("invoiceUpload.preview.fileLabel", { name: previewFileName })
                : t("invoiceUpload.preview.noFile")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={drawMode ? "default" : "outline"}
                size="sm"
                className="text-xs"
                disabled={previewLoading || Boolean(previewError) || !previewUrl}
                onClick={() => setDrawMode((prev) => !prev)}
              >
                {drawMode ? t("invoiceUpload.preview.drawing") : t("invoiceUpload.preview.drawBoxes")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={previewLoading || Boolean(previewError) || !previewUrl}
                onClick={clearPageBoxes}
              >
                {t("invoiceUpload.preview.clearPage")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={previewLoading || Boolean(previewError) || !previewUrl}
                onClick={applyPreviewBoxes}
              >
                {t("invoiceUpload.preview.applyBoxes")}
              </Button>
            </div>
            {previewContentType?.includes("pdf") && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                  disabled={previewPage <= 1}
                >
                  {t("invoiceUpload.preview.prev")}
                </Button>
                <span>
                  {t("invoiceUpload.preview.pageCount", {
                    current: previewPage,
                    total: previewPageCount,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                  disabled={previewPage >= previewPageCount}
                >
                  {t("invoiceUpload.preview.next")}
                </Button>
              </div>
            )}
          </div>
          <div className="max-h-[70vh] overflow-auto space-y-4">
            {previewLoading && (
              <div className="text-sm text-muted-foreground">{t("invoiceUpload.preview.loading")}</div>
            )}
            {!previewLoading && previewError && (
              <div className="text-sm text-danger">{previewError}</div>
            )}
            {!previewLoading && !previewError && previewRenderError && (
              <div className="text-sm text-danger">{previewRenderError}</div>
            )}
            {!previewLoading && !previewError && !previewUrl && (
              <div className="text-sm text-muted-foreground">{t("invoiceUpload.preview.noPreview")}</div>
            )}
            {!previewLoading && !previewError && !previewRenderError && previewUrl && (
              <div className="border border-border rounded-lg overflow-hidden relative">
                <canvas ref={previewCanvasRef} className="block w-full h-auto" />
                <canvas
                  ref={overlayCanvasRef}
                  className={cn(
                    "absolute inset-0 w-full h-full",
                    drawMode && !previewLoading ? "cursor-crosshair" : "pointer-events-none"
                  )}
                  style={{ touchAction: "none" }}
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={handleOverlayPointerMove}
                  onPointerUp={handleOverlayPointerUp}
                  onPointerLeave={handleOverlayPointerUp}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/invoices">{t("invoiceUpload.breadcrumb.invoices")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t("invoiceUpload.breadcrumb.current")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-3xl font-bold text-foreground mt-3">{t("invoiceUpload.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("invoiceUpload.subtitle")}
          </p>
        </div>
        <div />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="invodata-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("invoiceUpload.dropzone.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("invoiceUpload.dropzone.subtitle")}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary text-primary-foreground">
                AI POWERED
              </span>
            </div>

            <div
              className={
                isDragActive
                  ? "border-2 border-dashed border-primary rounded-xl p-6 sm:p-8 text-center bg-primary/5"
                  : "border-2 border-dashed border-border rounded-xl p-6 sm:p-8 text-center bg-muted/30"
              }
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{t("invoiceUpload.dropzone.dropTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {t("invoiceUpload.dropzone.hint")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" className="mt-4" onClick={handleFilePick}>
                {t("invoiceUpload.dropzone.browse")}
              </Button>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                {t("invoiceUpload.dropzone.selectedCount", { count: selectedFiles.length })}
              </div>
            )}
          </div>

          <div className="invodata-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("invoiceUpload.privacy.title")}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("invoiceUpload.privacy.subtitle")}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span>{t("invoiceUpload.privacy.instantMasking")}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={privacyEnabled} onCheckedChange={setPrivacyEnabled} />
                  <span>{privacyEnabled ? t("invoiceUpload.privacy.enabled") : t("invoiceUpload.privacy.disabled")}</span>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={() => setPrivacyOpen((prev) => !prev)}
                  aria-label={t("invoiceUpload.privacy.toggle")}
                  aria-expanded={privacyOpen}
                  aria-controls="privacy-section"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      privacyOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>
              </div>
            </div>
            {privacyOpen && (
              <div
                id="privacy-section"
                className={cn(
                  "transition-opacity",
                  !privacyEnabled && "opacity-50 pointer-events-none"
                )}
              >
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground" htmlFor="manualName">
                      {t("invoiceUpload.privacy.manualName")}
                    </label>
                    <Input
                      id="manualName"
                      className="mt-2"
                      placeholder={t("invoiceUpload.privacy.manualNamePlaceholder")}
                      value={manualName}
                      onChange={(event) => setManualName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground" htmlFor="manualTaxId">
                      {t("invoiceUpload.privacy.manualTaxId")}
                    </label>
                    <Input
                      id="manualTaxId"
                      className="mt-2"
                      placeholder={t("invoiceUpload.privacy.taxIdPlaceholder")}
                      value={manualTaxId}
                      onChange={(event) => setManualTaxId(event.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm text-muted-foreground" htmlFor="manualAddress">
                      {t("invoiceUpload.privacy.manualAddress")}
                    </label>
                    <Input
                      id="manualAddress"
                      className="mt-2"
                      placeholder={t("invoiceUpload.privacy.manualAddressPlaceholder")}
                      value={manualAddress}
                      onChange={(event) => setManualAddress(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground" htmlFor="manualPhone">
                      {t("invoiceUpload.privacy.manualPhone")}
                    </label>
                    <Input
                      id="manualPhone"
                      className="mt-2"
                      placeholder={t("invoiceUpload.privacy.manualPhonePlaceholder")}
                      value={manualPhone}
                      onChange={(event) => setManualPhone(event.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm text-muted-foreground" htmlFor="extraRedactionTerms">
                    {t("invoiceUpload.privacy.extraTerms")}
                  </label>
                  <Textarea
                    id="extraRedactionTerms"
                    className="mt-2"
                    placeholder={t("invoiceUpload.privacy.extraTermsPlaceholder")}
                    value={extraRedactionTerms}
                    onChange={(event) => setExtraRedactionTerms(event.target.value)}
                  />
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("invoiceUpload.privacy.storeRedacted")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("invoiceUpload.privacy.storeRedactedHint")}
                    </p>
                  </div>
                  <Switch checked={storeRedactedOnly} onCheckedChange={setStoreRedactedOnly} />
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {t("invoiceUpload.privacy.applyMaskHint")}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      uploadEntries
                        .filter((entry) => entry.file && entry.redactionStatus !== "masking")
                        .forEach((entry) => {
                          void startServerRedaction(entry);
                        });
                    }}
                    disabled={!privacyEnabled || uploadEntries.length === 0}
                  >
                    {t("invoiceUpload.privacy.applyMask")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="invodata-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">{t("invoiceUpload.processing.title")}</h2>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  onClick={() => setProcessingOpen((prev) => !prev)}
                  aria-label={t("invoiceUpload.processing.toggle")}
                  aria-expanded={processingOpen}
                  aria-controls="processing-section"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      processingOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>
              </div>
              {processingOpen && uploadEntries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger border-danger/40 hover:bg-danger/10 hover:border-danger/60 hover:text-danger"
                  disabled={
                    !uploadEntries.some(
                      (entry) =>
                        entry.status === "idle" ||
                        entry.status === "error" ||
                        entry.status === "canceled" ||
                        entry.status === "success"
                    )
                  }
                  onClick={() => {
                    const clearStatuses = new Set(["idle", "error", "canceled", "success"]);
                    const remainingNames = new Set(
                      uploadEntries
                        .filter((entry) => !clearStatuses.has(entry.status))
                        .map((entry) => entry.fileName)
                    );
                    uploadEntries.forEach((entry) => {
                      if (clearStatuses.has(entry.status) && entry.redactedPreviewUrl) {
                        URL.revokeObjectURL(entry.redactedPreviewUrl);
                      }
                    });
                    updateEntries((prev) =>
                      prev.filter((entry) => !clearStatuses.has(entry.status))
                    );
                    setSelectedFiles((prev) =>
                      prev.filter((file) => remainingNames.has(file.name))
                    );
                  }}
                >
                  {t("invoiceUpload.processing.clearList")}
                </Button>
              )}
            </div>
            {processingOpen && (
              <div id="processing-section" className="space-y-4">
                {uploadEntries.length === 0 && (
                  <div className="text-sm text-muted-foreground">{t("invoiceUpload.processing.empty")}</div>
                )}
                {uploadEntries.map((entry) => {
                  const { invoices, status, fileName } = entry;
                  const isComplete = status === "success";
                  const errorMessage = entry.error || "";
                  const isDuplicate = isDuplicateEntry(entry);
                  const invoiceLinks = invoices || [];
                  const duplicateInvoices = entry.existingInvoices || [];
                  const multiInvoiceLink =
                    isComplete && invoiceLinks.length > 1
                      ? `/invoices?fileName=${encodeURIComponent(fileName)}`
                      : null;
                  const duplicateFileName = duplicateInvoices[0]?.originalFileName;
                  const duplicateLink = isDuplicate
                    ? duplicateInvoices.length === 1
                      ? `/invoices/${duplicateInvoices[0].publicId}`
                      : duplicateFileName
                        ? `/invoices?fileName=${encodeURIComponent(duplicateFileName)}`
                        : null
                    : null;
                  const canRemove = status === "idle" || status === "canceled" || status === "error";
                  const canPreview =
                    privacyEnabled &&
                    Boolean(entry.file) &&
                    status !== "uploading" &&
                    entry.redactionStatus === "ready";
                  const canUploadEntry = Boolean(entry.file) && status !== "success";
                  const isUploading = status === "uploading";
                  const progressValue = Math.round(entry.progress ?? 0);
                  return (
                    <div
                      key={entry.jobId || fileName}
                      className={
                        status === "success"
                          ? "border border-success/40 bg-success/5 rounded-lg p-4"
                          : status === "error"
                            ? "border border-danger/40 bg-danger/5 rounded-lg p-4"
                            : status === "canceled"
                              ? "border border-border bg-muted/40 rounded-lg p-4"
                              : "border border-border rounded-lg p-4"
                      }
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              status === "success"
                                ? "w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"
                                : status === "error"
                                  ? "w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center"
                                  : status === "canceled"
                                    ? "w-10 h-10 rounded-lg bg-muted flex items-center justify-center"
                                    : "w-10 h-10 rounded-lg bg-muted flex items-center justify-center"
                            }
                          >
                            <FileText
                              className={
                                status === "success"
                                  ? "w-5 h-5 text-success"
                                  : status === "error"
                                    ? "w-5 h-5 text-danger"
                                    : status === "canceled"
                                      ? "w-5 h-5 text-muted-foreground"
                                      : "w-5 h-5 text-muted-foreground"
                              }
                            />
                          </div>
                          <div>
                            {isComplete && invoiceLinks.length === 1 ? (
                              <Link
                                to={`/invoices/${invoiceLinks[0].publicId}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {fileName}
                              </Link>
                            ) : duplicateLink ? (
                              <Link
                                to={duplicateLink}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {fileName}
                              </Link>
                            ) : isComplete && multiInvoiceLink ? (
                              <Link
                                to={multiInvoiceLink}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {fileName}
                              </Link>
                            ) : (
                              <p className="text-sm font-medium text-foreground">{fileName}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {status === "success"
                                ? t("invoiceUpload.status.success")
                                : status === "error"
                                  ? isDuplicate
                                    ? t("invoiceUpload.status.duplicate")
                                    : t("invoiceUpload.status.error")
                                  : status === "canceled"
                                    ? t("invoiceUpload.status.canceled")
                                    : status === "uploading"
                                      ? t("invoiceUpload.status.processing")
                                      : t("invoiceUpload.status.waiting")}
                            </p>
                            {isComplete && invoiceLinks.length > 1 && (
                              <p className="text-xs text-muted-foreground">
                                {t("invoiceUpload.processing.multiInvoices", {
                                  count: invoiceLinks.length,
                                })}
                              </p>
                            )}
                            {entry.redactionStatus === "masking" && (
                              <p className="text-xs text-muted-foreground">{t("invoiceUpload.processing.masking")}</p>
                            )}
                            {entry.redactionStatus === "error" && entry.redactionError && (
                              <p className="text-xs text-danger">{entry.redactionError}</p>
                            )}
                            {status === "error" && entry.error && (
                              <p className="text-xs text-danger">
                                {isDuplicate ? t("invoiceUpload.processing.duplicateMessage") : entry.error}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          {canUploadEntry && (
                            <Button
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                void handleUploadEntry(entry);
                              }}
                              aria-label={t("invoiceUpload.processing.sendLabel", { name: fileName })}
                              title={t("invoiceUpload.processing.send")}
                              disabled={isUploading}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          {canPreview && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handlePreviewMask(entry)}
                              aria-label={t("invoiceUpload.processing.previewMaskLabel", { name: fileName })}
                            >
                              {t("invoiceUpload.processing.previewMask")}
                            </Button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              aria-label={t("invoiceUpload.processing.remove", { name: fileName })}
                              className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              onClick={() => {
                                if (entry.redactedPreviewUrl) {
                                  URL.revokeObjectURL(entry.redactedPreviewUrl);
                                }
                                updateEntries((prev) =>
                                  prev.filter((item) => item.fileName !== fileName)
                                );
                                setSelectedFiles((prev) =>
                                  prev.filter((item) => item.name !== fileName)
                                );
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          {status === "uploading" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-danger border-danger/40 hover:bg-danger/10 hover:border-danger/60 hover:text-danger"
                                onClick={async () => {
                                  if (!entry.jobId) {
                                    updateEntries((prev) =>
                                      prev.map((item) =>
                                        item.fileName === entry.fileName
                                          ? {
                                            ...item,
                                            status: "canceled",
                                            error: undefined,
                                            cancelRequested: true,
                                            progress: 0,
                                          }
                                          : item
                                      )
                                    );
                                    return;
                                  }
                                  await cancelUploadJob(entry.jobId);
                                  updateEntries((prev) =>
                                    prev.map((item) =>
                                      item.jobId === entry.jobId
                                        ? {
                                          ...item,
                                          status: "canceled",
                                          error: undefined,
                                          jobId: undefined,
                                          cancelRequested: false,
                                          progress: 0,
                                        }
                                        : item
                                    )
                                  );
                                }}
                              >
                                {t("invoiceUpload.processing.cancel")}
                              </Button>
                              <span className="text-sm font-medium text-foreground">{progressValue}%</span>
                            </>
                          ) : (
                            <span className="text-sm font-medium text-foreground">
                              {status === "success" ? t("invoiceUpload.processing.progressComplete") : t("invoiceUpload.processing.progressIdle")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Progress
                        value={status === "success" ? 100 : status === "uploading" ? progressValue : 0}
                        className={
                          status === "success"
                            ? "mt-3 bg-success/15"
                            : status === "error"
                              ? "mt-3 bg-danger/15"
                              : status === "canceled"
                                ? "mt-3 bg-muted"
                                : "mt-3"
                        }
                        indicatorClassName={
                          status === "success"
                            ? "bg-success"
                            : status === "error"
                              ? "bg-danger"
                              : status === "uploading"
                                ? "upload-progress-indicator"
                                : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {uploadError && (
              <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                {uploadError}
              </div>
            )}
          </div>

          <div className="invodata-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("invoiceUpload.recent.title")}</h2>
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                onClick={() => setRecentOpen((prev) => !prev)}
                aria-label={t("invoiceUpload.recent.toggle")}
                aria-expanded={recentOpen}
                aria-controls="recent-uploads-section"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    recentOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
            </div>
            {recentOpen && (
              <div id="recent-uploads-section" className="space-y-3">
                {recentUploads.length === 0 && (
                  <div className="text-sm text-muted-foreground">{t("invoiceUpload.recent.empty")}</div>
                )}
                {recentUploads.map((upload) => (
                  <div key={upload.fileName} className="border border-border rounded-lg p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link
                          to={`/invoices?fileName=${encodeURIComponent(upload.fileName)}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {upload.fileName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t("invoiceUpload.recent.itemCount", { count: upload.count })} •{" "}
                          {new Date(upload.latestAt).toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(upload.latestAt).toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="invodata-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("invoiceUpload.guide.title")}</h2>
            <div className="space-y-4">
              {[
                t("invoiceUpload.guide.steps.upload"),
                t("invoiceUpload.guide.steps.redact"),
                t("invoiceUpload.guide.steps.analyze"),
              ].map((step) => (
                <div key={step} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-success mt-1" />
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-3">
              <Info className="w-4 h-4 text-primary mt-1" />
              <p className="text-sm text-muted-foreground">
                {t("invoiceUpload.guide.note")}
              </p>
            </div>
          </div>

          <div className="invodata-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("invoiceUpload.formats.title")}</h2>
            <div className="flex flex-wrap gap-2">
              {["PDF", "JPG", "PNG", "WEBP", "BMP", "TIFF"].map((format) => (
                <span
                  key={format}
                  className="px-2 py-1 rounded border border-border text-xs font-medium text-muted-foreground"
                >
                  {format}
                </span>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {t("invoiceUpload.formats.security")}
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full gap-2" onClick={handleUpload} disabled={eligibleEntries.length === 0 || hasActiveUploads}>
              <Upload className="w-4 h-4" />
              {hasActiveUploads ? t("invoiceUpload.actions.uploading") : t("invoiceUpload.actions.start")}
            </Button>
            {hasActiveUploads && (
              <Button
                variant="outline"
                className="w-full hover:bg-danger/10 hover:border-danger/40 hover:text-danger"
                onClick={async () => {
                  const targets = uploadEntries.filter((entry) => entry.status === "uploading" && entry.jobId);
                  await Promise.allSettled(targets.map((entry) => cancelUploadJob(entry.jobId!)));
                  updateEntries((prev) =>
                    prev.map((entry) =>
                      entry.status === "uploading"
                        ? {
                          ...entry,
                          status: "canceled",
                          error: undefined,
                          jobId: undefined,
                          cancelRequested: true,
                          progress: 0,
                        }
                        : entry
                    )
                  );
                }}
              >
                {t("invoiceUpload.actions.cancelAll")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-6 border-t border-border">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">{t("app.footer")}</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
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
        </div>
      </footer>
    </DashboardLayout>
  );
};

export default InvoiceUpload;
