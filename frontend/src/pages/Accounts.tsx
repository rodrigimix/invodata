import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createAccount,
  deleteAccount,
  getAccounts,
  getInvoices,
  updateAccount,
  type Account,
  type Invoice,
} from "@/lib/api";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

const Accounts = () => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [newAccount, setNewAccount] = useState({ name: "", type: "", currency: "EUR" });
  const [isSavingBalance, setIsSavingBalance] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "", currency: "EUR", last4: "" });
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const currencyOptions = [
    { value: "EUR", label: "EUR (€)" },
    { value: "USD", label: "USD ($)" },
    { value: "GBP", label: "GBP (£)" },
    { value: "BRL", label: "BRL (R$)" },
    { value: "CHF", label: "CHF (CHF)" },
  ];

  const normalizeCurrencyCode = (value?: string) => {
    if (!value) return "EUR";
    const normalized = value.trim().toUpperCase();
    if (normalized === "EURO") return "EUR";
    return normalized.length === 3 ? normalized : "EUR";
  };

  const formatCurrency = (value?: number, currency = "EUR") => {
    if (typeof value !== "number") return "-";
    const code = normalizeCurrencyCode(currency);
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(value);
    } catch {
      return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
    }
  };

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) || null,
    [accounts, selectedId]
  );

  useEffect(() => {
    const loadAccounts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAccounts();
        setAccounts(data);
        if (data.length > 0) {
          setSelectedId((prev) => prev ?? data[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t("accounts.errors.load");
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setInvoices([]);
      return;
    }
    const loadInvoices = async () => {
      setIsInvoicesLoading(true);
      try {
        const page = await getInvoices(0, 20, "date,desc", undefined, undefined, selectedId);
        setInvoices(page.content || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : t("accounts.errors.loadInvoices");
        setError(message);
      } finally {
        setIsInvoicesLoading(false);
      }
    };
    loadInvoices();
  }, [selectedId]);

  const handleAddBalance = async () => {
    if (!selectedAccount) return;
    const amount = Number(balanceAmount.replace(",", "."));
    if (Number.isNaN(amount)) return;
    const current = selectedAccount.balance ?? 0;
    const nextBalance = current + amount;
    setIsSavingBalance(true);
    try {
      const updated = await updateAccount(selectedAccount.id, { balance: nextBalance });
      setAccounts((prev) => prev.map((account) => (account.id === updated.id ? updated : account)));
      setBalanceAmount("");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("accounts.errors.updateBalance");
      setError(message);
    } finally {
      setIsSavingBalance(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name.trim()) return;
    setIsCreatingAccount(true);
    try {
      const created = await createAccount({
        name: newAccount.name.trim(),
        type: newAccount.type.trim() || undefined,
        currency: newAccount.currency || "EUR",
        last4: cardLast4.trim() || undefined,
      });
      setAccounts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setNewAccount({ name: "", type: "", currency: "EUR" });
      setCardLast4("");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("accounts.errors.create");
      setError(message);
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Card linking removed from UI.

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setEditForm({
      name: account.name || "",
      type: account.type || "",
      currency: account.currency || "EUR",
      last4: account.last4 || "",
    });
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;
    setIsUpdatingAccount(true);
    try {
      const updated = await updateAccount(editingAccount.id, {
        name: editForm.name.trim() || undefined,
        type: editForm.type.trim() || undefined,
        currency: editForm.currency.trim() || undefined,
        last4: editForm.last4.trim() || undefined,
      });
      setAccounts((prev) => prev.map((account) => (account.id === updated.id ? updated : account)));
      setEditingAccount(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("accounts.errors.update");
      setError(message);
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!pendingDelete || isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount(pendingDelete.id);
      setAccounts((prev) => {
        const remaining = prev.filter((account) => account.id !== pendingDelete.id);
        if (selectedId === pendingDelete.id) {
          setSelectedId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setPendingDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("accounts.errors.delete");
      setError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t("accounts.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("accounts.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">{t("accounts.addBalance.title")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("accounts.addBalance.title")}</DialogTitle>
                <DialogDescription>
                  {t("accounts.addBalance.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="balance-amount">{t("accounts.addBalance.amountLabel")}</Label>
                  <Input
                    id="balance-amount"
                    value={balanceAmount}
                    onChange={(event) => setBalanceAmount(event.target.value)}
                    placeholder={t("accounts.addBalance.amountPlaceholder")}
                  />
                </div>
                {selectedAccount && (
                  <div className="text-sm text-muted-foreground">
                    {t("accounts.addBalance.currentBalance", {
                      value: formatCurrency(selectedAccount.balance, selectedAccount.currency),
                    })}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleAddBalance} disabled={!selectedAccount || isSavingBalance}>
                  {isSavingBalance ? t("accounts.addBalance.saving") : t("accounts.addBalance.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">{t("accounts.create.title")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("accounts.create.title")}</DialogTitle>
                <DialogDescription>
                  {t("accounts.create.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="account-name">{t("accounts.create.nameLabel")}</Label>
                  <Input
                    id="account-name"
                    value={newAccount.name}
                    onChange={(event) => setNewAccount((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={t("accounts.create.namePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="account-type">{t("accounts.create.typeLabel")}</Label>
                  <Input
                    id="account-type"
                    value={newAccount.type}
                    onChange={(event) => setNewAccount((prev) => ({ ...prev, type: event.target.value }))}
                    placeholder={t("accounts.create.typePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="account-last4">{t("accounts.create.last4Label")}</Label>
                  <Input
                    id="account-last4"
                    value={cardLast4}
                    onChange={(event) => setCardLast4(event.target.value)}
                    placeholder={t("accounts.create.last4Placeholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="account-currency">{t("accounts.create.currencyLabel")}</Label>
                  <Select
                    value={newAccount.currency}
                    onValueChange={(value) =>
                      setNewAccount((prev) => ({ ...prev, currency: value }))
                    }
                  >
                    <SelectTrigger id="account-currency">
                      <SelectValue placeholder={t("accounts.create.currencyPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateAccount} disabled={isCreatingAccount}>
                  {isCreatingAccount ? t("accounts.create.creating") : t("accounts.create.action")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="invodata-card p-6 mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t("accounts.list.title")}</h2>
          <span className="text-sm text-muted-foreground">
            {t("accounts.list.count", { count: accounts.length })}
          </span>
        </div>
        {isLoading && (
          <div className="text-sm text-muted-foreground">{t("accounts.list.loading")}</div>
        )}
        {!isLoading && accounts.length === 0 && (
          <div className="text-sm text-muted-foreground">{t("accounts.list.empty")}</div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const isActive = account.id === selectedId;
            return (
              <div
                key={account.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(account.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(account.id);
                  }
                }}
                className={
                  isActive
                    ? "relative rounded-xl border border-primary/40 bg-primary/5 p-4 text-left"
                    : "relative rounded-xl border border-border p-4 text-left hover:border-primary/40"
                }
              >
                <div className="absolute right-3 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="flex items-center gap-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditAccount(account);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {t("accounts.actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-danger focus:text-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDelete(account);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("accounts.actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm text-muted-foreground">
                  {account.type || t("accounts.list.typeFallback")}
                </p>
                <h3 className="text-lg font-semibold text-foreground">{account.name}</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {formatCurrency(account.balance, account.currency)}
                </p>
                {account.last4 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("accounts.list.cardLast4", { last4: account.last4 })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="invodata-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{t("accounts.invoices.title")}</h2>
          {selectedAccount && (
            <span className="text-sm text-muted-foreground">
              {selectedAccount.name}
            </span>
          )}
        </div>
        {isInvoicesLoading && (
          <div className="text-sm text-muted-foreground">{t("accounts.invoices.loading")}</div>
        )}
        {!isInvoicesLoading && invoices.length === 0 && (
          <div className="text-sm text-muted-foreground">{t("accounts.invoices.empty")}</div>
        )}
        {!isInvoicesLoading && invoices.length > 0 && (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="border border-border rounded-lg p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{invoice.documentNum}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.issuer?.name || t("accounts.invoices.issuerFallback")} • {invoice.date}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(invoice.totalAmount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

      <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounts.edit.title")}</DialogTitle>
            <DialogDescription>{t("accounts.edit.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-account-name">{t("accounts.create.nameLabel")}</Label>
              <Input
                id="edit-account-name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t("accounts.create.namePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="edit-account-type">{t("accounts.create.typeLabel")}</Label>
              <Input
                id="edit-account-type"
                value={editForm.type}
                onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
                placeholder={t("accounts.create.typePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="edit-account-last4">{t("accounts.create.last4Label")}</Label>
              <Input
                id="edit-account-last4"
                value={editForm.last4}
                onChange={(event) => setEditForm((prev) => ({ ...prev, last4: event.target.value }))}
                placeholder={t("accounts.create.last4Placeholder")}
              />
            </div>
            <div>
              <Label htmlFor="edit-account-currency">{t("accounts.create.currencyLabel")}</Label>
              <Select
                value={editForm.currency}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, currency: value }))}
              >
                <SelectTrigger id="edit-account-currency">
                  <SelectValue placeholder={t("accounts.create.currencyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateAccount} disabled={isUpdatingAccount}>
              {isUpdatingAccount ? t("accounts.edit.saving") : t("accounts.edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("accounts.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("accounts.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeletingAccount}>
              {isDeletingAccount ? t("accounts.delete.deleting") : t("accounts.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Accounts;
