import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getUploadJob,
  type Invoice,
  type UploadInvoiceReference,
} from "@/lib/api";
import type { RedactionBox } from "@/lib/api";

type UploadEntryStatus = "idle" | "uploading" | "success" | "error" | "canceled";

export type UploadEntry = {
  fileName: string;
  file?: File;
  invoices?: UploadInvoiceReference[];
  existingInvoices?: UploadInvoiceReference[];
  status: UploadEntryStatus;
  retryCount?: number;
  error?: string;
  jobId?: string;
  progress?: number;
  cancelRequested?: boolean;
  redactedFile?: File;
  redactedPreviewUrl?: string;
  redactedContentType?: string;
  redactionStatus?: "idle" | "masking" | "ready" | "error";
  redactionError?: string;
  redactionBoxes?: RedactionBox[];
};

type UploadJobContextValue = {
  entries: UploadEntry[];
  batchId: string | null;
  popupBatchId: string | null;
  replaceEntries: (entries: UploadEntry[]) => void;
  updateEntries: (updater: (entries: UploadEntry[]) => UploadEntry[]) => void;
  setPopupBatchId: (batchId: string | null) => void;
  enablePopupForBatch: () => void;
  clearCompletedEntries: () => void;
};

type StoredState = {
  batchId: string | null;
  popupBatchId?: string | null;
  entries: Omit<UploadEntry, "file">[];
};

const STORAGE_KEY = "invodata_upload_jobs_v1";
const DONE_STATUSES = new Set<UploadEntryStatus>(["success", "error", "canceled"]);

const UploadJobContext = createContext<UploadJobContextValue | undefined>(undefined);

const toReference = (invoice: Invoice): UploadInvoiceReference => ({
  publicId: invoice.publicId,
  originalFileName: invoice.originalFileName,
  documentNum: invoice.documentNum,
});

const readStoredState = (): StoredState => {
  if (typeof window === "undefined") {
    return { batchId: null, popupBatchId: null, entries: [] };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { batchId: null, popupBatchId: null, entries: [] };
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!Array.isArray(parsed.entries)) {
      return { batchId: null, entries: [] };
    }
    return {
      batchId: parsed.batchId ?? null,
      popupBatchId: parsed.popupBatchId ?? null,
      entries: parsed.entries,
    };
  } catch {
    return { batchId: null, popupBatchId: null, entries: [] };
  }
};

export const UploadJobProvider = ({ children }: { children: ReactNode }) => {
  const stored = readStoredState();
  const [entries, setEntries] = useState<UploadEntry[]>(
    (stored.entries || []).map((entry) => ({ retryCount: 0, ...entry }))
  );
  const [batchId, setBatchId] = useState<string | null>(stored.batchId ?? null);
  const [popupBatchId, setPopupBatchId] = useState<string | null>(
    stored.popupBatchId ?? null
  );
  const entriesRef = useRef(entries);
  const pollerRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const hasActiveUploads = useMemo(
    () => entries.some((entry) => entry.status === "uploading" && entry.jobId),
    [entries]
  );
  const hasUploadingEntries = useMemo(
    () => entries.some((entry) => entry.status === "uploading"),
    [entries]
  );

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    if (entries.length > 0 && !batchId) {
      setBatchId(String(Date.now()));
    }
  }, [entries.length, batchId]);

  useEffect(() => {
    if (entries.length === 0 && batchId) {
      setBatchId(null);
      setPopupBatchId(null);
    }
  }, [entries.length, batchId]);

  useEffect(() => {
    if (!batchId && popupBatchId) {
      setPopupBatchId(null);
      return;
    }
    if (batchId && popupBatchId && popupBatchId !== batchId) {
      setPopupBatchId(null);
    }
  }, [batchId, popupBatchId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: StoredState = {
      batchId,
      popupBatchId,
      entries: entries.map(({ file, redactedFile, redactedPreviewUrl, redactionError, ...rest }) => rest),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [entries, batchId, popupBatchId]);

  useEffect(() => {
    if (!hasActiveUploads) {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }
    if (pollerRef.current) return;

    pollerRef.current = window.setInterval(async () => {
      const active = entriesRef.current.filter(
        (entry) => entry.status === "uploading" && entry.jobId
      );
      if (active.length === 0) {
        if (pollerRef.current) {
          window.clearInterval(pollerRef.current);
          pollerRef.current = null;
        }
        return;
      }
      const results = await Promise.all(
        active.map(async (entry) => {
          try {
            const response = await getUploadJob(entry.jobId!);
            return { jobId: entry.jobId!, response };
          } catch (err) {
            const message = err instanceof Error ? err.message : "Falha ao verificar o estado.";
            return { jobId: entry.jobId!, error: message };
          }
        })
      );

      setEntries((prev) =>
        prev.map((entry) => {
          const result = results.find((item) => item.jobId === entry.jobId);
          if (!result) return entry;
          if ("error" in result) {
            return {
              ...entry,
              status: "error",
              error: result.error,
              progress: 0,
            };
          }
          const { response } = result;
          if (response.status === "SUCCESS") {
            return {
              ...entry,
              status: "success",
              invoices: (response.invoices || []).map(toReference),
              progress: 100,
            };
          }
          if (response.status === "ERROR") {
            return {
              ...entry,
              status: "error",
              error: response.error || "Falha ao enviar as faturas.",
              existingInvoices: response.existingInvoices || [],
              progress: 0,
            };
          }
          if (response.status === "CANCELED") {
            return {
              ...entry,
              status: "canceled",
              progress: 0,
            };
          }
          return entry;
        })
      );
    }, 2000);

    return () => {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, [hasActiveUploads]);

  useEffect(() => {
    if (!hasUploadingEntries) {
      if (progressRef.current) {
        window.clearInterval(progressRef.current);
        progressRef.current = null;
      }
      return;
    }
    if (progressRef.current) return;

    progressRef.current = window.setInterval(() => {
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.status !== "uploading") return entry;
          const current = entry.progress ?? 5;
          const increment = 2 + Math.random() * 6;
          const next = Math.min(current + increment, 92);
          return { ...entry, progress: next };
        })
      );
    }, 700);

    return () => {
      if (progressRef.current) {
        window.clearInterval(progressRef.current);
        progressRef.current = null;
      }
    };
  }, [hasUploadingEntries]);

  const updateEntries = (updater: (entries: UploadEntry[]) => UploadEntry[]) => {
    setEntries((prev) => updater(prev));
  };

  const enablePopupForBatch = () => {
    const nextBatchId = batchId ?? String(Date.now());
    if (!batchId) {
      setBatchId(nextBatchId);
    }
    setPopupBatchId(nextBatchId);
  };

  const replaceEntries = (nextEntries: UploadEntry[]) => {
    setEntries(nextEntries);
    setBatchId(String(Date.now()));
  };

  const clearCompletedEntries = () => {
    setEntries((prev) => prev.filter((entry) => !DONE_STATUSES.has(entry.status)));
  };

  const value = useMemo(
    () => ({
      entries,
      batchId,
      popupBatchId,
      replaceEntries,
      updateEntries,
      setPopupBatchId,
      enablePopupForBatch,
      clearCompletedEntries,
    }),
    [entries, batchId, popupBatchId]
  );

  return <UploadJobContext.Provider value={value}>{children}</UploadJobContext.Provider>;
};

export const useUploadJobs = () => {
  const ctx = useContext(UploadJobContext);
  if (!ctx) {
    throw new Error("useUploadJobs must be used within UploadJobProvider");
  }
  return ctx;
};
