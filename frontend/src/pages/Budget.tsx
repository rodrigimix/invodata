import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Home,
  Utensils,
  Clapperboard,
  Car,
  Calendar,
  FileDown,
  Settings2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import {
  createBudget,
  deleteBudget,
  getBudgets,
  getBudgetStatus,
  updateBudget,
  type Budget,
  type BudgetStatus,
} from "@/lib/api";

const Budget = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [selectedMonth, setSelectedMonth] = useState("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formCategory, setFormCategory] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get("month") || "";

  const parseMonthValue = (value: string) => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const [, yearStr, monthStr] = match;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null;
    const date = new Date(year, month - 1, 1);
    const label = date.toLocaleDateString(locale, { month: "long", year: "numeric" });
    return { value: `${yearStr}-${monthStr}`, label, month, year };
  };

  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; month: number; year: number }> = [];
    const now = new Date();
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = date.toLocaleDateString(locale, { month: "long", year: "numeric" });
      options.push({ value, label, month, year });
    }
    if (selectedMonth && !options.some((option) => option.value === selectedMonth)) {
      const parsed = parseMonthValue(selectedMonth);
      if (parsed) {
        options.push(parsed);
      }
    }
    return options;
  }, [locale, selectedMonth]);

  useEffect(() => {
    if (monthParam && monthOptions.some((option) => option.value === monthParam)) {
      setSelectedMonth(monthParam);
      return;
    }
    if (!selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth, monthParam]);

  const selectedMonthMeta = useMemo(
    () => monthOptions.find((option) => option.value === selectedMonth) || null,
    [monthOptions, selectedMonth],
  );

  const categoryOptions = useMemo(
    () => [
      "UTILITIES",
      "SUPERMARKET",
      "RESTAURANT",
      "ENTERTAINMENT",
      "TRANSPORT",
      "FUEL",
      "HEALTH",
      "TELECOM",
      "SERVICES",
      "EDUCATION",
      "CLOTHING",
    ],
    [],
  );

  const availableCategories = useMemo(() => {
    const existing = new Set(budgets.map((budget) => budget.category.toUpperCase()));
    if (editTarget) {
      existing.delete(editTarget.toUpperCase());
    }
    return categoryOptions.filter((category) => !existing.has(category.toUpperCase()));
  }, [budgets, categoryOptions, editTarget]);

  const categoryLabel = (category: string) =>
    t(`issuerCategories.${category}`, { defaultValue: category });

  const getCategoryIcon = (category: string) => {
    const normalized = category.toUpperCase();
    if (["SUPERMARKET", "RESTAURANT"].includes(normalized)) return Utensils;
    if (["ENTERTAINMENT"].includes(normalized)) return Clapperboard;
    if (["TRANSPORT", "FUEL"].includes(normalized)) return Car;
    return Home;
  };

  const getCategoryStyles = (category: string) => {
    const normalized = category.toUpperCase();
    const styles: Record<string, { chip: string; bar: string }> = {
      UTILITIES: { chip: "bg-primary/10 text-primary", bar: "bg-primary" },
      SUPERMARKET: { chip: "bg-success/10 text-success", bar: "bg-success" },
      RESTAURANT: { chip: "bg-warning/10 text-warning", bar: "bg-warning" },
      ENTERTAINMENT: { chip: "bg-danger/10 text-danger", bar: "bg-danger" },
      TRANSPORT: { chip: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
      FUEL: { chip: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
      HEALTH: { chip: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
      TELECOM: { chip: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
      SERVICES: { chip: "bg-slate-100 text-slate-700", bar: "bg-slate-500" },
      EDUCATION: { chip: "bg-teal-100 text-teal-700", bar: "bg-teal-500" },
      CLOTHING: { chip: "bg-pink-100 text-pink-700", bar: "bg-pink-500" },
    };
    return styles[normalized] || { chip: "bg-muted text-muted-foreground", bar: "bg-muted" };
  };

  const parseAmount = (value: string) => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  useEffect(() => {
    if (!selectedMonthMeta) return;
    let isMounted = true;
    const loadBudgets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const allBudgets = await getBudgets();
        if (!isMounted) return;
        const filtered = allBudgets.filter(
          (budget) => budget.month === selectedMonthMeta.month && budget.year === selectedMonthMeta.year,
        );
        setBudgets(filtered);
        const statusEntries = await Promise.all(
          filtered.map((budget) =>
            getBudgetStatus(budget.category, budget.month, budget.year).then((status) => [
              budget.category.toUpperCase(),
              status,
            ]),
          ),
        );
        if (!isMounted) return;
        setStatuses(Object.fromEntries(statusEntries));
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("budget.errors.load");
        setError(message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadBudgets();
    return () => {
      isMounted = false;
    };
  }, [selectedMonthMeta, t]);

  const budgetRows = useMemo(() => {
    return budgets.map((budget) => {
      const status = statuses[budget.category.toUpperCase()];
      const spent = status?.currentSpending ?? 0;
      const remaining = budget.monthlyLimit - spent;
      const percent = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
      return {
        key: budget.category,
        name: categoryLabel(budget.category),
        subtitle: t("budget.categorySubtitle"),
        icon: getCategoryIcon(budget.category),
        budget: budget.monthlyLimit,
        spent,
        remaining,
        percent,
      };
    });
  }, [budgets, statuses, t]);

  const totalBudget = budgetRows.reduce((acc, cat) => acc + cat.budget, 0);
  const totalSpent = budgetRows.reduce((acc, cat) => acc + cat.spent, 0);
  const remaining = totalBudget - totalSpent;
  const progressPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const isOnTrack = totalSpent <= totalBudget * 0.8;

  const handleOpenDialog = () => {
    setEditTarget(null);
    setFormCategory(availableCategories[0] || "");
    setFormLimit("");
    setIsDialogOpen(true);
  };

  const handleCategoryChange = (value: string) => {
    setFormCategory(value);
    const existing = budgets.find((budget) => budget.category.toUpperCase() === value);
    if (existing) {
      setFormLimit(String(existing.monthlyLimit));
    }
  };

  const handleSaveBudget = async () => {
    if (!selectedMonthMeta || !formCategory) return;
    const limit = parseAmount(formLimit);
    if (limit === null) return;
    setIsSaving(true);
    try {
      const payload = {
        category: formCategory,
        monthlyLimit: limit,
        month: selectedMonthMeta.month,
        year: selectedMonthMeta.year,
      };
      const existing = budgets.find(
        (budget) =>
          budget.category.toUpperCase() === formCategory.toUpperCase() &&
          budget.month === selectedMonthMeta.month &&
          budget.year === selectedMonthMeta.year,
      );
      const editCategory = editTarget || existing?.category || null;
      const saved = editCategory
        ? await updateBudget(editCategory, selectedMonthMeta.month, selectedMonthMeta.year, {
          category: formCategory,
          monthlyLimit: limit,
        })
        : await createBudget(payload);
      setBudgets((prev) => {
        const existingIndex = prev.findIndex(
          (budget) => budget.category.toUpperCase() === (editCategory || saved.category).toUpperCase(),
        );
        if (existingIndex === -1) {
          return [...prev, saved];
        }
        const next = [...prev];
        next[existingIndex] = saved;
        return next;
      });
      const status = await getBudgetStatus(saved.category, saved.month, saved.year);
      setStatuses((prev) => {
        const next = { ...prev };
        if (editCategory && editCategory.toUpperCase() !== saved.category.toUpperCase()) {
          delete next[editCategory.toUpperCase()];
        }
        next[saved.category.toUpperCase()] = status;
        return next;
      });
      setIsDialogOpen(false);
      setEditTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("budget.errors.save");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!selectedMonthMeta || !formCategory) return;
    setIsSaving(true);
    try {
      await deleteBudget(formCategory, selectedMonthMeta.month, selectedMonthMeta.year);
      setBudgets((prev) =>
        prev.filter((budget) => budget.category.toUpperCase() !== formCategory.toUpperCase()),
      );
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[formCategory.toUpperCase()];
        return next;
      });
      setIsDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("budget.errors.delete");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedMonthMeta || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBudget(deleteTarget, selectedMonthMeta.month, selectedMonthMeta.year);
      setBudgets((prev) =>
        prev.filter((budget) => budget.category.toUpperCase() !== deleteTarget.toUpperCase()),
      );
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.toUpperCase()];
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("budget.errors.delete");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    if (budgetRows.length === 0) return;
    const rows = [
      ["Category", "Monthly Limit", "Spent", "Remaining", "Percent Used"],
      ...budgetRows.map((row) => [
        row.name,
        row.budget.toFixed(2),
        row.spent.toFixed(2),
        row.remaining.toFixed(2),
        row.percent.toFixed(0),
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("budget.title")}</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full md:w-auto">
          <Input
            type="month"
            className="w-full sm:w-40"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            aria-label={t("budget.selectMonth")}
          />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-44 gap-2">
              <Calendar className="w-4 h-4" />
              <SelectValue placeholder={t("budget.selectMonth")} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2 w-full sm:w-auto" onClick={handleOpenDialog}>
            <Settings2 className="w-4 h-4" />
            {t("budget.adjustLimits")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="invodata-card p-4 mb-6 text-sm text-danger">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="invodata-card p-6 mb-6 text-center text-sm text-muted-foreground">
          {t("budget.loading")}
        </div>
      )}

      {/* Total Budget Status */}
      <div className="invodata-card p-6 mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t("budget.totalStatus")}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                €{totalSpent.toLocaleString(locale, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground">
                {t("budget.spentOf", {
                  amount: totalBudget.toLocaleString(locale, { minimumFractionDigits: 2 }),
                })}
              </span>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
            isOnTrack ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
          )}>
            <span className={cn("w-2 h-2 rounded-full", isOnTrack ? "bg-primary" : "bg-danger")} />
            {isOnTrack ? t("budget.statusOnTrack") : t("budget.statusOver")}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase">{t("budget.overallProgress")}</span>
          <span className="text-sm font-medium text-primary">
            {t("budget.remaining", {
              amount: remaining.toLocaleString(locale, { minimumFractionDigits: 2 }),
            })}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {t("budget.usedPercent", { percent: progressPercentage.toFixed(0) })}
        </p>
      </div>

      {/* Budget Categories */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">{t("budget.categoriesTitle")}</h2>
      </div>

      <div className="space-y-4 mb-8">
        {!isLoading && budgetRows.length === 0 && (
          <div className="invodata-card p-6 text-sm text-muted-foreground">
            {t("budget.empty")}
          </div>
        )}
        {budgetRows.map((category) => {
          const percentage = category.percent;
          const isOver = category.remaining < 0;

          const styles = getCategoryStyles(category.key);
          return (
            <div key={category.key} className="invodata-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  styles.chip
                )}>
                  <category.icon className="w-6 h-6" />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-1">
                    <div>
                      <h3 className="font-semibold text-foreground">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {t("budget.categoryBudget", {
                          amount: category.budget.toLocaleString(locale, { minimumFractionDigits: 0 }),
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-start sm:justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormCategory(category.key.toUpperCase());
                            setFormLimit(String(category.budget));
                            setEditTarget(category.key.toUpperCase());
                            setIsDialogOpen(true);
                          }}
                        >
                          {t("budget.actions.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => setDeleteTarget(category.key.toUpperCase())}
                        >
                          {t("budget.actions.delete")}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          percentage > 100 ? "bg-danger" : percentage > 80 ? "bg-warning" : styles.bar
                        )}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6 w-full sm:w-auto sm:min-w-[180px]">
                      <span className="text-sm text-muted-foreground">
                        {t("budget.spentLabel", {
                          amount: category.spent.toLocaleString(locale, { minimumFractionDigits: 0 }),
                        })}
                      </span>
                      <span className={cn(
                        "text-sm font-semibold",
                        isOver ? "text-danger" : "text-primary"
                      )}>
                        {isOver ? "-" : ""}€{Math.abs(category.remaining).toLocaleString(locale, { minimumFractionDigits: 0 })}
                        <span className="text-xs font-normal ml-1">
                          {isOver ? t("budget.overLabel") : t("budget.remainingLabel")}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Budgeting Tip & Actions */}
      <div className="invodata-card p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground mb-1">{t("budget.tip.title")}</h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            {t("budget.tip.body")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full sm:w-auto">
          <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleExport}>
            <FileDown className="w-4 h-4" />
            {t("budget.export")}
          </Button>
          <Button className="gap-2 w-full sm:w-auto" onClick={handleOpenDialog}>
            {t("budget.setNewLimits")}
          </Button>
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && setIsDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("budget.form.title")}</DialogTitle>
            <DialogDescription>{t("budget.form.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="budget-category">{t("budget.form.category")}</Label>
              <Select value={formCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger id="budget-category">
                  <SelectValue placeholder={t("budget.form.categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryLabel(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="budget-limit">{t("budget.form.limit")}</Label>
              <Input
                id="budget-limit"
                value={formLimit}
                onChange={(event) => setFormLimit(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={handleDeleteBudget}
              disabled={
                isSaving ||
                !budgets.find((budget) => budget.category.toUpperCase() === formCategory.toUpperCase())
              }
            >
              {t("budget.form.delete")}
            </Button>
            <Button onClick={handleSaveBudget} disabled={isSaving}>
              {isSaving ? t("budget.form.saving") : t("budget.form.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("budget.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("budget.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("budget.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? t("budget.delete.deleting") : t("budget.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Budget;
