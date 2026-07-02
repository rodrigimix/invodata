import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Landmark,
  Car,
  Home,
  Plane,
  ArrowRight,
  TrendingUp,
  MoreVertical,
  Pencil,
  Trash2,
  Coins,
  Calendar as CalendarIcon
} from "lucide-react";
import { format, parse } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import {
  addGoalFunds,
  createGoal,
  deleteGoal,
  getAccounts,
  getGoals,
  updateGoal,
  type Account,
  type Goal,
} from "@/lib/api";

const Goals = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "categories">("active");
  const [timeRange, setTimeRange] = useState<"12m" | "5y">("12m");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [deleteGoalTarget, setDeleteGoalTarget] = useState<Goal | null>(null);
  const [fundGoalTarget, setFundGoalTarget] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
    linkedAccountId: "none",
  });
  const [deadlineInput, setDeadlineInput] = useState("");
  const [fundsAmount, setFundsAmount] = useState("");
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";

  const formatDateDisplay = (value?: string) => {
    if (!value) return "";
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (Number.isNaN(parsed.getTime())) return "";
    return format(parsed, "dd/MM/yyyy");
  };

  const parseIsoDate = (value?: string) => {
    if (!value) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  };

  const parseDisplayDateToIso = (value: string) => {
    const trimmed = value.trim();
    const fullMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!fullMatch) return "";
    const parsed = parse(trimmed, "dd/MM/yyyy", new Date());
    if (Number.isNaN(parsed.getTime())) return "";
    return format(parsed, "yyyy-MM-dd");
  };

  const formatDateInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  useEffect(() => {
    setDeadlineInput(form.deadline ? formatDateDisplay(form.deadline) : "");
  }, [form.deadline]);

  const iconPalette = [Landmark, Car, Home, Plane];

  const getGoalIcon = (goal: Goal, index: number) => {
    const name = (goal.name || "").toLowerCase();
    if (name.includes("emergency") || name.includes("emergencia") || name.includes("reserva")) {
      return Landmark;
    }
    if (name.includes("car") || name.includes("carro") || name.includes("auto")) {
      return Car;
    }
    if (name.includes("home") || name.includes("house") || name.includes("casa") || name.includes("apart")) {
      return Home;
    }
    if (name.includes("trip") || name.includes("travel") || name.includes("viagem")) {
      return Plane;
    }
    return iconPalette[index % iconPalette.length];
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

  const formatDate = (value?: string | null) => {
    if (!value) return t("goals.noDeadline");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("goals.noDeadline");
    return date.toLocaleDateString(locale, { month: "short", year: "numeric" });
  };

  const parseAmount = (value: string) => {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const resetForm = () => {
    setForm({
      name: "",
      targetAmount: "",
      currentAmount: "",
      deadline: "",
      linkedAccountId: "none",
    });
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [goalsData, accountsData] = await Promise.all([getGoals(), getAccounts()]);
        if (!isMounted) return;
        setGoals(goalsData || []);
        setAccounts(accountsData || []);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : t("goals.errors.load");
        setError(message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [t]);

  const totalProjected = useMemo(
    () => goals.reduce((sum, goal) => sum + (goal.targetAmount || 0), 0),
    [goals],
  );

  const currentTotal = useMemo(
    () => goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0),
    [goals],
  );

  const projectionData = useMemo(() => {
    const startValue = currentTotal;
    const endValue = totalProjected;
    const points =
      timeRange === "5y"
        ? [
          t("goals.projection.years.y1"),
          t("goals.projection.years.y2"),
          t("goals.projection.years.y3"),
          t("goals.projection.years.y4"),
          t("goals.projection.years.y5"),
        ]
        : [
          t("goals.projection.months.sep"),
          t("goals.projection.months.nov"),
          t("goals.projection.months.jan"),
          t("goals.projection.months.mar"),
          t("goals.projection.months.may"),
          t("goals.projection.months.jul"),
          t("goals.projection.months.aug"),
        ];
    const steps = Math.max(points.length - 1, 1);
    return points.map((label, index) => {
      const ratio = index / steps;
      const value = startValue + (endValue - startValue) * ratio;
      return { month: label, value };
    });
  }, [currentTotal, totalProjected, timeRange, t]);

  const projectionPercent = useMemo(() => {
    if (totalProjected <= 0) return 0;
    return (currentTotal / totalProjected) * 100;
  }, [currentTotal, totalProjected]);

  const filteredGoals = useMemo(() => {
    if (activeTab === "completed") {
      return goals.filter((goal) => goal.completed);
    }
    const sorted = [...goals];
    if (activeTab === "active") {
      sorted.sort((a, b) => Number(Boolean(a.completed)) - Number(Boolean(b.completed)));
    }
    return sorted;
  }, [goals, activeTab]);

  const activeCount = useMemo(
    () => (activeTab === "active" ? goals.length : goals.filter((goal) => !goal.completed).length),
    [goals, activeTab],
  );

  const handleOpenCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleSubmitCreate = async () => {
    if (!form.name.trim()) return;
    const target = parseAmount(form.targetAmount);
    if (target === null) return;
    const current = parseAmount(form.currentAmount);
    setIsSaving(true);
    try {
      const linkedAccountId = form.linkedAccountId === "none" ? null : Number(form.linkedAccountId);
      const created = await createGoal({
        name: form.name.trim(),
        targetAmount: target,
        currentAmount: linkedAccountId ? undefined : current ?? 0,
        deadline: form.deadline || undefined,
        linkedAccountId,
      });
      setGoals((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("goals.errors.create");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditGoal(goal);
    setForm({
      name: goal.name || "",
      targetAmount: goal.targetAmount ? String(goal.targetAmount) : "",
      currentAmount: goal.currentAmount ? String(goal.currentAmount) : "",
      deadline: goal.deadline ? goal.deadline.split("T")[0] : "",
      linkedAccountId: goal.linkedAccount?.id ? String(goal.linkedAccount.id) : "none",
    });
  };

  const handleSubmitEdit = async () => {
    if (!editGoal) return;
    const target = parseAmount(form.targetAmount);
    const current = parseAmount(form.currentAmount);
    setIsSaving(true);
    try {
      const linkedAccountId = form.linkedAccountId === "none" ? null : Number(form.linkedAccountId);
      const clearLinkedAccount = linkedAccountId === null && Boolean(editGoal.linkedAccount);
      const updated = await updateGoal(editGoal.id, {
        name: form.name.trim() || undefined,
        targetAmount: target ?? undefined,
        currentAmount: current ?? undefined,
        deadline: form.deadline || undefined,
        linkedAccountId,
        clearLinkedAccount,
      });
      setGoals((prev) => prev.map((goal) => (goal.id === updated.id ? updated : goal)));
      setEditGoal(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("goals.errors.update");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!deleteGoalTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteGoal(deleteGoalTarget.id);
      setGoals((prev) => prev.filter((goal) => goal.id !== deleteGoalTarget.id));
      setDeleteGoalTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("goals.errors.delete");
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddFunds = async () => {
    if (!fundGoalTarget || isAddingFunds) return;
    const amount = parseAmount(fundsAmount);
    if (amount === null || amount <= 0) return;
    setIsAddingFunds(true);
    try {
      const updated = await addGoalFunds(fundGoalTarget.id, amount);
      setGoals((prev) => prev.map((goal) => (goal.id === updated.id ? updated : goal)));
      setFundsAmount("");
      setFundGoalTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("goals.errors.addFunds");
      setError(message);
    } finally {
      setIsAddingFunds(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t("goals.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("goals.subtitle")}</p>
        </div>
        <Button className="gap-2 w-full md:w-auto" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4" />
          {t("goals.create")}
        </Button>
      </div>

      {/* Projection Chart */}
      <div className="invodata-card p-6 mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t("goals.projection.title")}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-foreground">
                {formatCurrency(totalProjected)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{t("goals.projection.estimate")}</span>
              <span className="flex items-center gap-1 text-sm text-success font-medium">
                <TrendingUp className="w-4 h-4" />
                {projectionPercent > 0 ? "+" : ""}
                {projectionPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="flex items-center bg-muted rounded-lg p-1 w-full md:w-auto">
            <button
              onClick={() => setTimeRange("12m")}
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors",
                timeRange === "12m" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              {t("goals.projection.range12")}
            </button>
            <button
              onClick={() => setTimeRange("5y")}
              className={cn(
                "flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors",
                timeRange === "5y" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              {t("goals.projection.range5")}
            </button>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorProjection" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
                tickFormatter={(value) =>
                  `€${(value / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(214, 32%, 91%)',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [
                  formatCurrency(value),
                  t("goals.projection.tooltipLabel"),
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorProjection)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goals Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground">{t("goals.sectionTitle")}</h2>
        <button className="flex items-center gap-1 text-primary font-medium hover:underline text-sm">
          {t("goals.viewAll")} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "active"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t("goals.tabs.active", { count: activeCount })}
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "completed"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t("goals.tabs.completed")}
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={cn(
            "pb-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "categories"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t("goals.tabs.categories")}
        </button>
      </div>

      {error && (
        <div className="invodata-card p-4 mb-6 text-sm text-danger">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="invodata-card p-6 text-center text-sm text-muted-foreground mb-6">
          {t("goals.loading")}
        </div>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && filteredGoals.map((goal, index) => {
          const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          const Icon = getGoalIcon(goal, index);
          const categoryLabel = goal.linkedAccount?.name || t("goals.categoryDefault");
          const monthsRemaining = goal.deadline
            ? Math.max(
              1,
              Math.ceil(
                (new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30),
              ),
            )
            : null;
          const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
          const suggestedMonthly = monthsRemaining ? remaining / monthsRemaining : null;

          return (
            <div key={goal.id} className="invodata-card-hover p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  "bg-primary/10 text-primary"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={() => handleOpenEdit(goal)}
                    >
                      <Pencil className="h-4 w-4" />
                      {t("goals.actions.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2 text-danger focus:text-danger"
                      onClick={() => setDeleteGoalTarget(goal)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("goals.actions.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-semibold text-foreground mb-1">{goal.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {t("goals.deadline", { deadline: formatDate(goal.deadline) })}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {categoryLabel}
              </p>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-foreground">
                  {t("goals.amountProgress", {
                    current: goal.currentAmount.toLocaleString(locale),
                    target: goal.targetAmount.toLocaleString(locale),
                  })}
                </span>
                <span className={cn(
                  "text-sm font-semibold",
                  percentage >= 80 ? "text-success" : "text-primary"
                )}>
                  {percentage.toFixed(0)}%
                </span>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    percentage >= 80 ? "bg-success" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {suggestedMonthly !== null ? (
                  <span className="text-xs text-muted-foreground">
                    {t("goals.suggestedMonthly", {
                      amount: suggestedMonthly.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("goals.noSuggestion")}</span>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full sm:w-auto"
                    onClick={() => {
                      setFundsAmount("");
                      setFundGoalTarget(goal);
                    }}
                  >
                    <Coins className="mr-1 h-4 w-4" />
                    {t("goals.actions.addFunds")}
                  </Button>
                  <button className="text-sm text-primary font-medium hover:underline" onClick={() => handleOpenEdit(goal)}>
                    {t("goals.manage")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add New Goal Card */}
        <div
          className="invodata-card border-2 border-dashed border-border p-6 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer min-h-[280px]"
          onClick={handleOpenCreate}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenCreate();
            }
          }}
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <span className="text-muted-foreground font-medium">{t("goals.addNew")}</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-border">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {t("goals.footer")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">
              {t("goals.footerLinks.terms")}
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              {t("goals.footerLinks.privacy")}
            </Link>
            <a href="#" className="hover:text-foreground">{t("goals.footerLinks.help")}</a>
            <a href={surveyUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              {surveyLabel}
            </a>
          </div>
        </div>
      </footer>

      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("goals.form.createTitle")}</DialogTitle>
            <DialogDescription>{t("goals.form.createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal-name">{t("goals.form.name")}</Label>
              <Input
                id="goal-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("goals.form.namePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="goal-target">{t("goals.form.target")}</Label>
              <Input
                id="goal-target"
                value={form.targetAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, targetAmount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="goal-current">{t("goals.form.current")}</Label>
              <Input
                id="goal-current"
                value={form.currentAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, currentAmount: event.target.value }))}
                placeholder="0.00"
                disabled={form.linkedAccountId !== "none"}
              />
            </div>
            <div>
              <Label htmlFor="goal-deadline">{t("goals.form.deadline")}</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="goal-deadline"
                  placeholder={t("goals.form.deadlinePlaceholder")}
                  value={deadlineInput}
                  onChange={(event) => {
                    const value = formatDateInput(event.target.value);
                    setDeadlineInput(value);
                    const iso = parseDisplayDateToIso(value);
                    if (iso) {
                      setForm((prev) => ({ ...prev, deadline: iso }));
                    } else if (!value.trim()) {
                      setForm((prev) => ({ ...prev, deadline: "" }));
                    }
                  }}
                  onBlur={() => {
                    setDeadlineInput(form.deadline ? formatDateDisplay(form.deadline) : "");
                  }}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("goals.form.deadline")}
                      className="w-full sm:w-auto"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseIsoDate(form.deadline)}
                      onSelect={(date) =>
                        setForm((prev) => ({ ...prev, deadline: date ? format(date, "yyyy-MM-dd") : "" }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="goal-account">{t("goals.form.linkedAccount")}</Label>
              <Select
                value={form.linkedAccountId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, linkedAccountId: value }))}
              >
                <SelectTrigger id="goal-account">
                  <SelectValue placeholder={t("goals.form.linkedAccountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("goals.form.linkedAccountNone")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitCreate} disabled={isSaving}>
              {isSaving ? t("goals.form.saving") : t("goals.form.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editGoal)} onOpenChange={(open) => !open && setEditGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("goals.form.editTitle")}</DialogTitle>
            <DialogDescription>{t("goals.form.editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal-edit-name">{t("goals.form.name")}</Label>
              <Input
                id="goal-edit-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("goals.form.namePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="goal-edit-target">{t("goals.form.target")}</Label>
              <Input
                id="goal-edit-target"
                value={form.targetAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, targetAmount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="goal-edit-current">{t("goals.form.current")}</Label>
              <Input
                id="goal-edit-current"
                value={form.currentAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, currentAmount: event.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="goal-edit-deadline">{t("goals.form.deadline")}</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="goal-edit-deadline"
                  placeholder={t("goals.form.deadlinePlaceholder")}
                  value={deadlineInput}
                  onChange={(event) => {
                    const value = formatDateInput(event.target.value);
                    setDeadlineInput(value);
                    const iso = parseDisplayDateToIso(value);
                    if (iso) {
                      setForm((prev) => ({ ...prev, deadline: iso }));
                    } else if (!value.trim()) {
                      setForm((prev) => ({ ...prev, deadline: "" }));
                    }
                  }}
                  onBlur={() => {
                    setDeadlineInput(form.deadline ? formatDateDisplay(form.deadline) : "");
                  }}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("goals.form.deadline")}
                      className="w-full sm:w-auto"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseIsoDate(form.deadline)}
                      onSelect={(date) =>
                        setForm((prev) => ({ ...prev, deadline: date ? format(date, "yyyy-MM-dd") : "" }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="goal-edit-account">{t("goals.form.linkedAccount")}</Label>
              <Select
                value={form.linkedAccountId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, linkedAccountId: value }))}
              >
                <SelectTrigger id="goal-edit-account">
                  <SelectValue placeholder={t("goals.form.linkedAccountPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("goals.form.linkedAccountNone")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitEdit} disabled={isSaving}>
              {isSaving ? t("goals.form.saving") : t("goals.form.update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(fundGoalTarget)} onOpenChange={(open) => !open && setFundGoalTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("goals.form.addFundsTitle")}</DialogTitle>
            <DialogDescription>{t("goals.form.addFundsDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal-funds-amount">{t("goals.form.amount")}</Label>
              <Input
                id="goal-funds-amount"
                value={fundsAmount}
                onChange={(event) => setFundsAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddFunds} disabled={isAddingFunds}>
              {isAddingFunds ? t("goals.form.saving") : t("goals.form.addFunds")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteGoalTarget)}
        onOpenChange={(open) => !open && setDeleteGoalTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("goals.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("goals.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGoal} disabled={isDeleting}>
              {isDeleting ? t("goals.delete.deleting") : t("goals.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Goals;
