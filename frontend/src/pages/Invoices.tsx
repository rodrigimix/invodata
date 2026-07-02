import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AddInvoiceModal } from "@/components/invoices/AddInvoiceModal";
import {
  Plus,
  Download,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Search,
  Pencil,
  Trash2,
  Calendar as CalendarIcon
} from "lucide-react";
import { format, parse, parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSearchParams } from "react-router-dom";
import {
  declineUserShare,
  deleteInvoice,
  getInvoiceCategories,
  getInvoiceById,
  getInvoiceSummary,
  getInvoices,
  Invoice,
  InvoiceCategory,
  getAuthToken,
  InvoiceTotalsResponse
} from "@/lib/api";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const getInitials = (name?: string) => {
  if (!name) return "--";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const Invoices = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState("month");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [customStartInput, setCustomStartInput] = useState("");
  const [customEndInput, setCustomEndInput] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [totalsScope, setTotalsScope] = useState<"page" | "all">("page");
  const [totalsAll, setTotalsAll] = useState<InvoiceTotalsResponse | null>(null);
  const [isTotalsLoading, setIsTotalsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);
  const [pendingSharedRemove, setPendingSharedRemove] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingShare, setIsRemovingShare] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [categories, setCategories] = useState<InvoiceCategory[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const filterStorageKey = "invodata_invoice_filters";
  const restoreRef = useRef(false);
  const fileNameFilter = searchParams.get("fileName") || undefined;
  const searchParam = searchParams.get("search") || "";
  const periodParam = searchParams.get("period") || "";
  const categoryParam = searchParams.get("category") || "";
  const paymentMethodParam = searchParams.get("paymentMethod") || "";
  const startDateParam = searchParams.get("startDate") || "";
  const endDateParam = searchParams.get("endDate") || "";

  const handleRemoveSharedInvoice = async () => {
    if (!pendingSharedRemove?.shareId || isRemovingShare) return;
    setIsRemovingShare(true);
    try {
      await declineUserShare(pendingSharedRemove.shareId);
      setPendingSharedRemove(null);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoices.sharedRemoveError");
      setError(message);
    } finally {
      setIsRemovingShare(false);
    }
  };

  const updateUrlParams = (updates: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  useEffect(() => {
    if (restoreRef.current) return;
    const hasUrlFilters = Boolean(
      searchParam || periodParam || categoryParam || paymentMethodParam || startDateParam || endDateParam
    );
    if (hasUrlFilters) {
      restoreRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(filterStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string>;
      const next = new URLSearchParams(searchParams);
      let hasAny = false;
      ["search", "period", "category", "paymentMethod", "startDate", "endDate"].forEach((key) => {
        const value = saved[key];
        if (value) {
          next.set(key, value);
          hasAny = true;
        }
      });
      if (hasAny) {
        setSearchParams(next);
      }
    } catch {
      // Ignore storage errors.
    } finally {
      restoreRef.current = true;
    }
  }, [searchParam, periodParam, categoryParam, paymentMethodParam, startDateParam, endDateParam, searchParams, setSearchParams]);

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

  useEffect(() => {
    const filters = {
      search: searchParam,
      period: periodParam,
      category: categoryParam,
      paymentMethod: paymentMethodParam,
      startDate: startDateParam,
      endDate: endDateParam,
    };
    const hasAny = Object.values(filters).some((value) => value);
    try {
      if (hasAny) {
        window.localStorage.setItem(filterStorageKey, JSON.stringify(filters));
      } else {
        window.localStorage.removeItem(filterStorageKey);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [searchParam, periodParam, categoryParam, paymentMethodParam, startDateParam, endDateParam]);

  useEffect(() => {
    if (searchParam !== searchQuery) {
      setSearchQuery(searchParam);
    }
    if (periodParam && periodParam !== periodFilter) {
      setPeriodFilter(periodParam);
    }
    if (categoryParam && categoryParam !== categoryFilter) {
      setCategoryFilter(categoryParam);
    }
    if (paymentMethodParam && paymentMethodParam !== paymentMethodFilter) {
      setPaymentMethodFilter(paymentMethodParam);
    }
    if (startDateParam || endDateParam) {
      if (periodFilter !== "custom") {
        setPeriodFilter("custom");
      }
      if (startDateParam) {
        const parsedStart = parseISO(startDateParam);
        setCustomStartDate(parsedStart);
        setCustomStartInput(formatDateDisplay(parsedStart));
      }
      if (endDateParam) {
        const parsedEnd = parseISO(endDateParam);
        setCustomEndDate(parsedEnd);
        setCustomEndInput(formatDateDisplay(parsedEnd));
      }
    }
  }, [searchParam, periodParam, categoryParam, paymentMethodParam, startDateParam, endDateParam]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set("search", value.trim());
    } else {
      nextParams.delete("search");
    }
    setSearchParams(nextParams);
  };

  useEffect(() => {
    setPage(0);
  }, [fileNameFilter, searchQuery, periodFilter, categoryFilter, paymentMethodFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (periodFilter !== "custom" && !startDateParam && !endDateParam) {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
      setCustomStartInput("");
      setCustomEndInput("");
    }
  }, [periodFilter, startDateParam, endDateParam]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError(t("auth.sessionExpired"));
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const isRevenueCategory = categoryFilter === "REVENUE";
    const normalizedCategory = categoryFilter === "all" || isRevenueCategory ? undefined : categoryFilter;
    const normalizedPaymentMethod = paymentMethodFilter === "all" ? undefined : paymentMethodFilter;
    const revenueFilter = isRevenueCategory ? true : undefined;
    const normalizedPeriod = periodFilter === "custom" ? undefined : periodFilter;
    const customRange = periodFilter === "custom";
    const startDate = customRange ? formatDateToIso(customStartDate) : undefined;
    const endDate = customRange ? formatDateToIso(customEndDate) : undefined;
    getInvoices(
      page,
      pageSize,
      undefined,
      undefined,
      fileNameFilter,
      undefined,
      searchQuery || undefined,
      normalizedPeriod,
      normalizedCategory,
      normalizedPaymentMethod,
      revenueFilter,
      startDate,
      endDate,
    )
      .then((page) => {
        if (!isMounted) return;
        setInvoices(page.content || []);
        setTotalCount(page.totalElements ?? page.content?.length ?? 0);
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("invoices.loadError");
        setError(message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fileNameFilter, searchQuery, periodFilter, categoryFilter, paymentMethodFilter, customStartDate, customEndDate, page, pageSize, refreshKey]);

  useEffect(() => {
    if (totalsScope !== "all") {
      setTotalsAll(null);
      return;
    }
    let isMounted = true;
    setIsTotalsLoading(true);
    const isRevenueCategory = categoryFilter === "REVENUE";
    const normalizedCategory = categoryFilter === "all" || isRevenueCategory ? undefined : categoryFilter;
    const normalizedPaymentMethod = paymentMethodFilter === "all" ? undefined : paymentMethodFilter;
    const revenueFilter = isRevenueCategory ? true : undefined;
    const normalizedPeriod = periodFilter === "custom" ? undefined : periodFilter;
    const customRange = periodFilter === "custom";
    const startDate = customRange ? formatDateToIso(customStartDate) : undefined;
    const endDate = customRange ? formatDateToIso(customEndDate) : undefined;
    getInvoiceSummary(
      searchQuery || undefined,
      normalizedPeriod,
      normalizedCategory,
      normalizedPaymentMethod,
      revenueFilter,
      undefined,
      fileNameFilter,
      undefined,
      startDate,
      endDate,
    )
      .then((summary) => {
        if (!isMounted) return;
        setTotalsAll(summary);
      })
      .catch(() => {
        if (!isMounted) return;
        setTotalsAll(null);
      })
      .finally(() => {
        if (isMounted) setIsTotalsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [totalsScope, searchQuery, periodFilter, categoryFilter, paymentMethodFilter, fileNameFilter, customStartDate, customEndDate]);

  const visibleCount = useMemo(() => invoices.length, [invoices.length]);
  const totalPages = useMemo(
    () => (totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1),
    [totalCount, pageSize],
  );
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number") return "-";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  };

  const formatNumber = (value?: number, fractionDigits = 2) => {
    if (typeof value !== "number") return "";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  };

  const invoiceTotals = useMemo(
    () =>
      invoices.reduce(
        (acc, invoice) => {
          acc.net += invoice.netAmount ?? 0;
          acc.tax += invoice.taxAmount ?? 0;
          acc.total += invoice.totalAmount ?? 0;
          return acc;
        },
        { net: 0, tax: 0, total: 0 },
      ),
    [invoices],
  );
  const activeTotals =
    totalsScope === "all" && totalsAll
      ? {
        net: totalsAll.netTotal,
        tax: totalsAll.taxTotal,
        total: totalsAll.totalAmount,
      }
      : invoiceTotals;
  const displayTotals =
    totalsScope === "all" && !totalsAll
      ? { net: undefined, tax: undefined, total: undefined }
      : activeTotals;

  const handleDeleteInvoice = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteInvoice(pendingDelete.publicId);
      setPendingDelete(null);
      setPage((current) => (current > 0 && invoices.length === 1 ? current - 1 : current));
      setRefreshKey((current) => current + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoices.deleteError");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatDateToIso = (value?: Date) => {
    if (!value) return undefined;
    return format(value, "yyyy-MM-dd");
  };

  const formatDateDisplay = (value?: Date) => {
    if (!value) return "";
    return format(value, "dd/MM/yyyy");
  };

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const parseDisplayDateInput = (value: string) => {
    const trimmed = value.trim();
    const fullMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!fullMatch) return undefined;
    const parsed = parse(trimmed, "dd/MM/yyyy", new Date());
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    if (value === "custom") {
      updateUrlParams({ period: "custom" });
      return;
    }
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    if (value === "alltime") {
      updateUrlParams({ period: "alltime", startDate: null, endDate: null });
      return;
    }
    updateUrlParams({ period: value, startDate: null, endDate: null });
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    updateUrlParams({ category: value === "all" ? null : value });
  };

  const handlePaymentChange = (value: string) => {
    setPaymentMethodFilter(value);
    updateUrlParams({ paymentMethod: value === "all" ? null : value });
  };

  const handleCustomStartDate = (date?: Date) => {
    const nextDate = date ?? undefined;
    setCustomStartDate(nextDate);
    setCustomStartInput(nextDate ? formatDateDisplay(nextDate) : "");
    updateUrlParams({
      period: "custom",
      startDate: formatDateToIso(nextDate) ?? null,
    });
  };

  const handleCustomEndDate = (date?: Date) => {
    const nextDate = date ?? undefined;
    setCustomEndDate(nextDate);
    setCustomEndInput(nextDate ? formatDateDisplay(nextDate) : "");
    updateUrlParams({
      period: "custom",
      endDate: formatDateToIso(nextDate) ?? null,
    });
  };

  const handleExport = async () => {
    if (isExporting) return;
    setError(null);
    setIsExporting(true);
    try {
      const normalizedPeriod = periodFilter === "custom" ? undefined : periodFilter;
      const isRevenueCategory = categoryFilter === "REVENUE";
      const normalizedCategory = categoryFilter === "all" || isRevenueCategory ? undefined : categoryFilter;
      const normalizedPaymentMethod = paymentMethodFilter === "all" ? undefined : paymentMethodFilter;
      const revenueFilter = isRevenueCategory ? true : undefined;
      const customRange = periodFilter === "custom";
      const startDate = customRange ? formatDateToIso(customStartDate) : undefined;
      const endDate = customRange ? formatDateToIso(customEndDate) : undefined;
      const exportSize = 100;
      let allInvoices: Invoice[] = [];
      let pageIndex = 0;
      let total = 0;
      while (true) {
        const response = await getInvoices(
          pageIndex,
          exportSize,
          undefined,
          undefined,
          fileNameFilter,
          undefined,
          searchQuery || undefined,
          normalizedPeriod,
          normalizedCategory,
          normalizedPaymentMethod,
          revenueFilter,
          startDate,
          endDate,
        );
        const content = response.content || [];
        if (pageIndex === 0) {
          total = response.totalElements ?? content.length;
        }
        allInvoices = allInvoices.concat(content);
        if (allInvoices.length >= total || content.length === 0) {
          break;
        }
        pageIndex += 1;
      }

      if (allInvoices.length === 0) {
        setError(t("invoices.exportEmpty"));
        return;
      }

      const detailedInvoices = await Promise.all(
        allInvoices.map(async (invoice) => {
          try {
            return await getInvoiceById(invoice.publicId);
          } catch {
            return invoice;
          }
        }),
      );

      const rows = [
        [
          t("invoices.exportHeaders.documentNumber"),
          t("invoices.exportHeaders.issuer"),
          t("invoices.exportHeaders.category"),
          t("invoices.exportHeaders.date"),
          t("invoices.exportHeaders.amount"),
          t("invoices.exportHeaders.netAmount"),
          t("invoices.exportHeaders.taxAmount"),
          t("invoices.exportHeaders.paymentMethod"),
          t("invoices.exportHeaders.licensePlate"),
          t("invoices.exportHeaders.itemDescription"),
          t("invoices.exportHeaders.itemQuantity"),
          t("invoices.exportHeaders.itemUnitPrice"),
          t("invoices.exportHeaders.itemTaxPercent"),
          t("invoices.exportHeaders.itemTaxAmount"),
          t("invoices.exportHeaders.itemTotal"),
        ],
      ];

      detailedInvoices.forEach((invoice) => {
        const baseRow = [
          invoice.documentNum || "",
          invoice.issuer?.name || "",
          invoice.category
            ? t(`issuerCategories.${invoice.category.toUpperCase()}`, {
              defaultValue: invoice.category,
            })
            : "",
          formatDate(invoice.date),
          formatNumber(invoice.totalAmount),
          formatNumber(invoice.netAmount),
          formatNumber(invoice.taxAmount),
          invoice.paymentMethod || "",
          invoice.licensePlate || "",
        ];
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item) => {
            rows.push([
              ...baseRow,
              item.description || "",
              item.quantity !== undefined ? String(item.quantity) : "",
              typeof item.unitPrice === "number" ? formatNumber(item.unitPrice) : "",
              item.taxPercent !== undefined ? String(item.taxPercent) : "",
              typeof item.taxPrice === "number" ? formatNumber(item.taxPrice) : "",
              typeof item.totalPrice === "number" ? formatNumber(item.totalPrice) : "",
            ]);
          });
        } else {
          rows.push([...baseRow, "", "", "", "", "", ""]);
        }
      });

      const csv = rows
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      link.download = `invoices-all-${stamp}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("invoices.exportError");
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

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
      FUEL: "bg-warning text-warning-foreground border border-transparent",
      RESTAURANT: "bg-danger text-danger-foreground border border-transparent",
      SUPERMARKET: "bg-success text-success-foreground border border-transparent",
      TRANSPORT: "bg-primary text-primary-foreground border border-transparent",
      HEALTH: "bg-chart-5 text-white border border-transparent",
      UTILITIES: "bg-chart-1 text-white border border-transparent",
      TELECOM: "bg-chart-3 text-white border border-transparent",
      CLOTHING: "bg-chart-4 text-white border border-transparent",
      EDUCATION: "bg-chart-2 text-white border border-transparent",
      ENTERTAINMENT: "bg-invodata-700 text-white border border-transparent",
      SERVICES: "bg-invodata-600 text-white border border-transparent",
      REVENUE: "bg-invodata-500 text-white border border-transparent",
    };
    return { className: styles[normalized] || "bg-muted text-muted-foreground border border-border" };
  };

  const categoryFilterOptions = useMemo(() => {
    const base = [
      { value: "REVENUE", label: t("issuerCategories.REVENUE", { defaultValue: "Revenue" }) },
      { value: "FUEL", label: t("issuerCategories.FUEL", { defaultValue: "Fuel" }) },
      { value: "RESTAURANT", label: t("issuerCategories.RESTAURANT", { defaultValue: "Restaurant" }) },
      { value: "SUPERMARKET", label: t("issuerCategories.SUPERMARKET", { defaultValue: "Supermarket" }) },
      { value: "TRANSPORT", label: t("issuerCategories.TRANSPORT", { defaultValue: "Transport" }) },
      { value: "HEALTH", label: t("issuerCategories.HEALTH", { defaultValue: "Health" }) },
      { value: "UTILITIES", label: t("issuerCategories.UTILITIES", { defaultValue: "Utilities" }) },
      { value: "TELECOM", label: t("issuerCategories.TELECOM", { defaultValue: "Telecom" }) },
      { value: "CLOTHING", label: t("issuerCategories.CLOTHING", { defaultValue: "Clothing" }) },
      { value: "EDUCATION", label: t("issuerCategories.EDUCATION", { defaultValue: "Education" }) },
      { value: "ENTERTAINMENT", label: t("issuerCategories.ENTERTAINMENT", { defaultValue: "Entertainment" }) },
      { value: "SERVICES", label: t("issuerCategories.SERVICES", { defaultValue: "Services" }) },
    ];
    const seen = new Set(base.map((entry) => entry.value.toUpperCase()));
    const custom = categories
      .filter((category) => !seen.has(category.name.toUpperCase()))
      .map((category) => ({
        value: category.name,
        label: category.name,
        color: category.color,
      }));
    return [...base, ...custom];
  }, [categories, t]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t("invoices.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("invoices.subtitle")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => setShowAddInvoice(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            {t("invoices.createNew")}
          </Button>
          <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleExport} disabled={isExporting}>
            <Download className="w-4 h-4" />
            {isExporting ? t("invoices.exporting") : t("invoices.export")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="invodata-card p-6 mb-6">
        <div className="flex flex-col gap-6">
          <div>
            <Label htmlFor="invoice-search">{t("invoices.searchLabel")}</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invoice-search"
                placeholder={t("invoices.searchPlaceholder")}
                className="pl-9"
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("invoices.searchHint")}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filter-period">{t("invoices.periodFilterLabel")}</Label>
              <Select value={periodFilter} onValueChange={handlePeriodChange}>
                <SelectTrigger id="filter-period">
                  <SelectValue placeholder={t("invoices.period")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alltime">{t("invoices.periodAllTime")}</SelectItem>
                  <SelectItem value="month">{t("invoices.periodThisMonth")}</SelectItem>
                  <SelectItem value="quarter">{t("invoices.periodThisQuarter")}</SelectItem>
                  <SelectItem value="year">{t("invoices.periodThisYear")}</SelectItem>
                  <SelectItem value="custom">{t("invoices.periodCustom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-category">{t("invoices.categoryFilterLabel")}</Label>
              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger id="filter-category">
                  <SelectValue placeholder={t("invoices.categoryAll")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("invoices.categoryAll")}</SelectItem>
                  {categoryFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        {option.color ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-border"
                            style={{ backgroundColor: option.color }}
                          />
                        ) : null}
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-payment">{t("invoices.paymentMethodLabel")}</Label>
              <Select value={paymentMethodFilter} onValueChange={handlePaymentChange}>
                <SelectTrigger id="filter-payment">
                  <SelectValue placeholder={t("invoices.paymentMethodAll")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("invoices.paymentMethodAll")}</SelectItem>
                  <SelectItem value="card">{t("invoices.paymentMethod.card")}</SelectItem>
                  <SelectItem value="transfer">{t("invoices.paymentMethod.transfer")}</SelectItem>
                  <SelectItem value="cash">{t("invoices.paymentMethod.cash")}</SelectItem>
                  <SelectItem value="mbway">{t("invoices.paymentMethod.mbway")}</SelectItem>
                  <SelectItem value="other">{t("invoices.paymentMethod.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {periodFilter === "custom" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filter-start-date">{t("invoices.periodStartDate")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="filter-start-date"
                    placeholder={t("invoices.periodDatePlaceholder")}
                    value={customStartInput}
                    onChange={(event) => {
                      const value = formatDateInput(event.target.value);
                      setCustomStartInput(value);
                      const parsed = parseDisplayDateInput(value);
                      if (parsed) {
                        handleCustomStartDate(parsed);
                      } else if (!value.trim()) {
                        handleCustomStartDate(undefined);
                      }
                    }}
                    onBlur={() => {
                      setCustomStartInput(customStartDate ? formatDateDisplay(customStartDate) : "");
                    }}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("invoices.periodStartDate")}
                        className="w-full sm:w-auto"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={(date) => handleCustomStartDate(date ?? undefined)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-end-date">{t("invoices.periodEndDate")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="filter-end-date"
                    placeholder={t("invoices.periodDatePlaceholder")}
                    value={customEndInput}
                    onChange={(event) => {
                      const value = formatDateInput(event.target.value);
                      setCustomEndInput(value);
                      const parsed = parseDisplayDateInput(value);
                      if (parsed) {
                        handleCustomEndDate(parsed);
                      } else if (!value.trim()) {
                        handleCustomEndDate(undefined);
                      }
                    }}
                    onBlur={() => {
                      setCustomEndInput(customEndDate ? formatDateDisplay(customEndDate) : "");
                    }}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("invoices.periodEndDate")}
                        className="w-full sm:w-auto"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={(date) => handleCustomEndDate(date ?? undefined)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <Button
              variant="link"
              className="text-primary"
              onClick={() => {
                setSearchQuery("");
                setPeriodFilter("month");
                setCategoryFilter("all");
                setPaymentMethodFilter("all");
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
                setCustomStartInput("");
                setCustomEndInput("");
                updateUrlParams({
                  search: null,
                  period: "month",
                  category: null,
                  paymentMethod: null,
                  startDate: null,
                  endDate: null,
                });
              }}
            >
              {t("invoices.clearFilters")}
            </Button>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="invodata-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("invoices.invoiceNumber")}</th>
                <th className="hidden md:table-cell text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("invoices.client")}</th>
                <th className="hidden md:table-cell text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("common.category")}</th>
                <th className="hidden sm:table-cell text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("invoices.date")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("invoices.amount")}</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-4">{t("invoices.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {t("invoices.loading")}
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-danger">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {t("invoices.empty")}
                  </td>
                </tr>
              )}
              {!isLoading && !error && invoices.map((invoice) => (
                <tr key={invoice.publicId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/invoices/${invoice.publicId}`} className="text-primary font-medium hover:underline">
                        #{invoice.documentNum}
                      </Link>
                      {invoice.shared && (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {t("invoices.sharedBadge")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                        {getInitials(invoice.issuer?.name)}
                      </div>
                      <span className="font-medium text-foreground">{invoice.issuer?.name || t("invoices.noName")}</span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-muted-foreground">
                    {(() => {
                      const badge = getIssuerCategoryStyles(invoice.category);
                      return (
                        <Badge
                          variant="outline"
                          className={cn("capitalize", badge.className)}
                          style={badge.style}
                        >
                          {getIssuerCategoryLabel(invoice.category)}
                        </Badge>
                      );
                    })()}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-muted-foreground">{formatDate(invoice.date)}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{formatCurrency(invoice.totalAmount)}</td>
                  <td className="px-6 py-4">
                    {invoice.shared ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-2"
                        onClick={() => setPendingSharedRemove(invoice)}
                        disabled={isRemovingShare}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("invoices.sharedRemove")}
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/invoices/${invoice.publicId}/edit`} className="flex items-center gap-2">
                              <Pencil className="h-4 w-4" />
                              {t("invoices.edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="flex items-center gap-2 text-danger focus:text-danger"
                            onSelect={(event) => {
                              event.preventDefault();
                              setPendingDelete(invoice);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("invoices.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 px-6 py-4 border-t border-border md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("invoices.pagination", { visibleCount, totalCount })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" className="h-8 w-8">
              {page + 1}
            </Button>
            <span className="px-2 text-muted-foreground">/ {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="invodata-card p-6 mt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <p className="text-sm font-medium text-foreground">{t("invoices.totalsScope")}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className={totalsScope === "page" ? "text-foreground font-medium" : undefined}>
              {t("invoices.totalsScopePage")}
            </span>
            <Switch
              checked={totalsScope === "all"}
              onCheckedChange={(checked) => setTotalsScope(checked ? "all" : "page")}
              aria-label={t("invoices.totalsScope")}
            />
            <span className={totalsScope === "all" ? "text-foreground font-medium" : undefined}>
              {t("invoices.totalsScopeAll")}
            </span>
          </div>
          {isTotalsLoading && totalsScope === "all" && (
            <p className="text-xs text-muted-foreground">{t("invoices.totalsLoading")}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t("invoices.totalNet")}</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(displayTotals.net)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t("invoices.totalVat")}</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(displayTotals.tax)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t("invoices.totalGross")}</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(displayTotals.total)}
            </p>
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

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
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

      <AlertDialog
        open={Boolean(pendingSharedRemove)}
        onOpenChange={(open) => !open && setPendingSharedRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("invoices.sharedRemoveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("invoices.sharedRemoveDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingShare}>{t("invoices.deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRemoveSharedInvoice}
              disabled={isRemovingShare}
            >
              {isRemovingShare
                ? t("invoices.sharedRemoveConfirming")
                : t("invoices.sharedRemoveConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddInvoiceModal open={showAddInvoice} onOpenChange={setShowAddInvoice} />
    </DashboardLayout>
  );
};

export default Invoices;
