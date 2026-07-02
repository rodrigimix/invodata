import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { RecentInvoices } from "@/components/dashboard/RecentInvoices";
import { EmergencyFundCard } from "@/components/dashboard/EmergencyFundCard";
import { AddInvoiceModal } from "@/components/invoices/AddInvoiceModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, TrendingUp, BarChart3, Landmark, Car, Home, Plane } from "lucide-react";
import {
  CategorySpending,
  getAuthToken,
  getCategorySpending,
  getGoals,
  getInvoices,
  getMonthlyEvolutionDetailed,
  getSavingsRateStats,
  getAuthUser,
  Goal,
  Invoice,
  MonthlyEvolutionEntry,
  SavingsRateStats,
} from "@/lib/api";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [savingsRate, setSavingsRate] = useState<SavingsRateStats | null>(null);
  const [summaryStats, setSummaryStats] = useState<SavingsRateStats | null>(null);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [evolutionData, setEvolutionData] = useState<MonthlyEvolutionEntry[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true);
  const [recentInvoicesError, setRecentInvoicesError] = useState<string | null>(null);
  const [savingsPeriod, setSavingsPeriod] = useState<"month" | "year">("month");
  const [includeVatSummary, setIncludeVatSummary] = useState(true);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const now = new Date();
  const currentYear = now.getFullYear();
  const [categoryMonthInput, setCategoryMonthInput] = useState("");
  const [categoryYearInput, setCategoryYearInput] = useState(String(currentYear));
  const [summaryMonthInput, setSummaryMonthInput] = useState("");
  const [summaryYearInput, setSummaryYearInput] = useState(String(currentYear));
  const authUser = getAuthUser();
  const firstName = (() => {
    if (!authUser || (typeof authUser !== "object" && typeof authUser !== "function")) return "";
    const rawName =
      (typeof authUser.name === "string" && authUser.name.trim()) ||
      (typeof authUser.username === "string" && authUser.username.trim()) ||
      "";
    if (!rawName) return "";
    const [first] = rawName.split(/\s+/);
    return first || "";
  })();
  const parsedCategoryYear = Number.parseInt(categoryYearInput, 10);
  const effectiveCategoryYear = Number.isNaN(parsedCategoryYear) ? currentYear : parsedCategoryYear;
  const parsedCategoryMonth = Number.parseInt(categoryMonthInput, 10);
  const effectiveCategoryMonth =
    !Number.isNaN(parsedCategoryMonth) && parsedCategoryMonth >= 1 && parsedCategoryMonth <= 12
      ? parsedCategoryMonth
      : undefined;
  const parsedSummaryYear = Number.parseInt(summaryYearInput, 10);
  const effectiveSummaryYear = Number.isNaN(parsedSummaryYear) ? currentYear : parsedSummaryYear;
  const parsedSummaryMonth = Number.parseInt(summaryMonthInput, 10);
  const effectiveSummaryMonth =
    !Number.isNaN(parsedSummaryMonth) && parsedSummaryMonth >= 1 && parsedSummaryMonth <= 12
      ? parsedSummaryMonth
      : undefined;
  const categoryPeriodLabel = effectiveCategoryMonth
    ? new Date(effectiveCategoryYear, effectiveCategoryMonth - 1, 1).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    })
    : t("dashboard.categoryPeriodYear", { year: effectiveCategoryYear });

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number") return "€0";
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  };

  const formatMonthLabel = (value: string) => {
    if (!value.includes("-")) return value.toUpperCase();
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return value.toUpperCase();
    return date.toLocaleDateString(locale, { month: "short" }).toUpperCase();
  };

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsDashboardLoading(true);
      try {
        const results = await Promise.allSettled([
          getSavingsRateStats(),
          getMonthlyEvolutionDetailed(),
          getGoals(),
        ]);

        if (!isMounted) return;
        const [savingsResult, evolutionResult, goalsResult] = results;

        if (savingsResult.status === "fulfilled") {
          setSavingsRate(savingsResult.value);
        }
        if (evolutionResult.status === "fulfilled") {
          setEvolutionData(evolutionResult.value);
        }
        if (goalsResult.status === "fulfilled") {
          setGoals(goalsResult.value || []);
        }
      } finally {
        if (isMounted) setIsDashboardLoading(false);
      }
    };

    const loadRecentInvoices = async () => {
      setIsInvoicesLoading(true);
      setRecentInvoicesError(null);
      const token = getAuthToken();
      if (!token) {
        if (!isMounted) return;
        setRecentInvoicesError(t("auth.sessionExpired"));
        setIsInvoicesLoading(false);
        return;
      }
      try {
        let invoicesResponse;
        try {
          invoicesResponse = await getInvoices(0, 5, "date,desc");
        } catch {
          invoicesResponse = await getInvoices(0, 5);
        }
        if (!isMounted) return;
        setRecentInvoices(invoicesResponse.content || []);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("dashboard.loadInvoicesError");
        setRecentInvoicesError(message);
      } finally {
        if (isMounted) setIsInvoicesLoading(false);
      }
    };

    loadDashboard();
    loadRecentInvoices();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        if (effectiveCategoryMonth) {
          const data = await getCategorySpending(effectiveCategoryMonth, effectiveCategoryYear);
          if (isMounted) setCategoryData(data);
        } else {
          const data = await getCategorySpending(undefined, effectiveCategoryYear);
          if (isMounted) setCategoryData(data);
        }
      } catch {
        if (isMounted) setCategoryData([]);
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, [effectiveCategoryMonth, effectiveCategoryYear]);

  useEffect(() => {
    let isMounted = true;
    const loadSummaryStats = async () => {
      try {
        const data = await getSavingsRateStats(effectiveSummaryMonth, effectiveSummaryYear);
        if (isMounted) setSummaryStats(data);
      } catch {
        if (isMounted) setSummaryStats(null);
      }
    };
    loadSummaryStats();
    return () => {
      isMounted = false;
    };
  }, [effectiveSummaryMonth, effectiveSummaryYear]);

  const revenueChartData = useMemo(
    () =>
      evolutionData.map((entry) => ({
        month: formatMonthLabel(entry.month),
        receita: entry.revenue ?? 0,
        despesa: entry.expense ?? 0,
      })),
    [evolutionData],
  );
  const yearTotals = useMemo(() => {
    if (evolutionData.length === 0) return null;
    const totals = evolutionData.reduce(
      (acc, entry) => {
        const [yearStr] = entry.month.split("-");
        if (!yearStr || Number(yearStr) !== currentYear) return acc;
        acc.revenue += entry.revenue ?? 0;
        acc.expense += entry.expense ?? 0;
        return acc;
      },
      { revenue: 0, expense: 0 }
    );
    if (totals.revenue === 0 && totals.expense === 0) return null;
    return totals;
  }, [evolutionData, currentYear]);
  const activeSavingsTotals =
    savingsPeriod === "month"
      ? savingsRate
        ? { revenue: savingsRate.totalRevenue, expense: savingsRate.totalExpense }
        : null
      : yearTotals;
  const activeSavingsRate = activeSavingsTotals
    ? activeSavingsTotals.revenue > 0
      ? ((activeSavingsTotals.revenue - activeSavingsTotals.expense) / activeSavingsTotals.revenue) * 100
      : 0
    : null;
  const isSavingsPositive = activeSavingsRate !== null && activeSavingsRate >= 0;

  const summaryRevenue = includeVatSummary
    ? summaryStats?.totalRevenue
    : summaryStats?.totalNetRevenue ?? summaryStats?.totalRevenue;
  const summaryExpense = includeVatSummary
    ? summaryStats?.totalExpense
    : summaryStats?.totalNetExpense ?? summaryStats?.totalExpense;
  const formatGoalDate = (value?: string | null) => {
    if (!value) return t("dashboard.goalNoDeadline");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("dashboard.goalNoDeadline");
    return date.toLocaleDateString(locale, { month: "short", year: "numeric" });
  };
  const activeGoals = useMemo(() => {
    const getGoalIcon = (name: string, index: number) => {
      const normalized = name.toLowerCase();
      if (normalized.includes("emergency") || normalized.includes("emergencia") || normalized.includes("reserva")) {
        return Landmark;
      }
      if (normalized.includes("car") || normalized.includes("carro") || normalized.includes("auto")) {
        return Car;
      }
      if (normalized.includes("home") || normalized.includes("house") || normalized.includes("casa") || normalized.includes("apart")) {
        return Home;
      }
      if (normalized.includes("trip") || normalized.includes("travel") || normalized.includes("viagem")) {
        return Plane;
      }
      const fallback = [Landmark, Car, Home, Plane];
      return fallback[index % fallback.length];
    };
    const items: Array<{
      id: string;
      title: string;
      detail: string | null;
      amountLine: string;
      progress: number;
      icon?: React.ElementType;
    }> = [];
    goals
      .slice()
      .sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)))
      .forEach((goal, index) => {
        const target = Number(goal.targetAmount || 0);
        const current = Number(goal.currentAmount || 0);
        const percent = target > 0 ? (current / target) * 100 : 0;
        items.push({
          id: `goal-${goal.id}`,
          title: goal.name,
          detail: t("dashboard.goalDeadline", { date: formatGoalDate(goal.deadline) }),
          amountLine: `${formatCurrency(current)} / ${formatCurrency(target)}`,
          progress: percent,
          icon: getGoalIcon(goal.name, index),
        });
      });
    return items;
  }, [goals, t, locale]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">
            {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <Button onClick={() => setShowAddInvoice(true)} className="gap-2 w-full md:w-auto">
          <Plus className="w-4 h-4" />
          {t("dashboard.addInvoice")}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-3">
        <EmergencyFundCard goals={activeGoals} />

        <div className="invodata-card p-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{t("dashboard.savingsRate")}</p>
            <p
              className={
                activeSavingsRate === null
                  ? "text-3xl font-bold text-foreground"
                  : isSavingsPositive
                    ? "text-3xl font-bold text-success"
                    : "text-3xl font-bold text-danger"
              }
            >
              {activeSavingsRate !== null ? `${activeSavingsRate.toFixed(1)}%` : "--"}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span
                className={savingsPeriod === "month" ? "text-foreground font-medium" : undefined}
              >
                {t("dashboard.savingsRateMonth")}
              </span>
              <Switch
                checked={savingsPeriod === "year"}
                onCheckedChange={(checked) => setSavingsPeriod(checked ? "year" : "month")}
                aria-label={t("dashboard.savingsRateToggle")}
              />
              <span
                className={savingsPeriod === "year" ? "text-foreground font-medium" : undefined}
              >
                {t("dashboard.savingsRateYear")}
              </span>
            </div>
          </div>
        </div>

        <div className="invodata-card p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">{t("dashboard.summary")}</span>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="text-[10px] text-muted-foreground uppercase">{t("dashboard.categoryPeriodLabel")}</span>
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  <Input
                    value={summaryMonthInput}
                    onChange={(event) => setSummaryMonthInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    className="h-8 w-full sm:w-16 text-xs"
                  />
                  <Input
                    value={summaryYearInput}
                    onChange={(event) => setSummaryYearInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="YYYY"
                    className="h-8 w-full sm:w-20 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className={includeVatSummary ? "text-foreground font-medium" : undefined}>
                {t("dashboard.withVat")}
              </span>
              <Switch
                checked={!includeVatSummary}
                onCheckedChange={(checked) => setIncludeVatSummary(!checked)}
                aria-label={t("dashboard.monthlySummaryToggle")}
              />
              <span className={!includeVatSummary ? "text-foreground font-medium" : undefined}>
                {t("dashboard.withoutVat")}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 text-center mt-5 sm:grid-cols-2">
            <div>
              <span className="text-xs text-muted-foreground uppercase">{t("dashboard.income")}</span>
              <p className="text-xl font-bold text-foreground">{formatCurrency(summaryRevenue)}</p>
              <div className="h-1 bg-success rounded-full mt-2" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase">{t("dashboard.expense")}</span>
              <p className="text-xl font-bold text-foreground">{formatCurrency(summaryExpense)}</p>
              <div className="h-1 bg-danger rounded-full mt-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <RevenueChart data={revenueChartData} />
        </div>
        <div>
          <CategoryChart
            data={categoryData}
            periodLabel={categoryPeriodLabel}
            headerContent={
              <>
                <span className="text-xs text-muted-foreground uppercase">{t("dashboard.categoryPeriodLabel")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={categoryMonthInput}
                    onChange={(event) => setCategoryMonthInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="MM"
                    className="w-full"
                  />
                  <Input
                    value={categoryYearInput}
                    onChange={(event) => setCategoryYearInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="YYYY"
                    className="w-full"
                  />
                </div>
              </>
            }
          />
        </div>
      </div>

      {/* Recent Invoices */}
      <RecentInvoices invoices={recentInvoices} isLoading={isInvoicesLoading || isDashboardLoading} error={recentInvoicesError} />

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

      {/* Add Invoice Modal */}
      <AddInvoiceModal open={showAddInvoice} onOpenChange={setShowAddInvoice} />
    </DashboardLayout>
  );
};

export default Dashboard;
