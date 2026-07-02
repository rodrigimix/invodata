import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import {
  adminDeleteUser,
  adminResetUserPassword,
  getAdminStorageSettings,
  getAdminPublicShares,
  getAdminStats,
  getAdminUsers,
  updateAdminStorageSettings,
  updateAdminPublicShares,
  uploadAdminAiCredentials,
  type AdminStatsResponse,
  type AdminUser,
  type AdminStorageSettings,
} from "@/lib/api";

const Admin = () => {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [userActionLoading, setUserActionLoading] = useState(false);

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [periodMonths, setPeriodMonths] = useState(6);

  const [allowPublicShares, setAllowPublicShares] = useState(false);
  const [publicSharesLoading, setPublicSharesLoading] = useState(false);
  const [publicSharesSaving, setPublicSharesSaving] = useState(false);

  const [storageSettings, setStorageSettings] = useState<AdminStorageSettings | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageSaving, setStorageSaving] = useState(false);

  const [credentialsFile, setCredentialsFile] = useState<File | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  const locale = "pt-PT";

  const usersChartData = useMemo(
    () =>
      (stats?.usersMonthly || []).map((item) => ({
        month: item.month,
        label: formatMonthLabel(item.month, locale),
        total: item.total,
      })),
    [stats, locale],
  );

  const invoicesChartData = useMemo(
    () =>
      (stats?.invoicesMonthly || []).map((item) => ({
        month: item.month,
        label: formatMonthLabel(item.month, locale),
        total: item.total,
      })),
    [stats, locale],
  );

  useEffect(() => {
    setError(null);
  }, [password]);


  const handleLoadUsers = async () => {
    setError(null);
    setUsersLoading(true);
    try {
      const data = await getAdminUsers(password.trim());
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.usersLoadError");
      setError(message);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setUserActionLoading(true);
    setError(null);
    try {
      await adminResetUserPassword(password.trim(), resetUser.username, newPassword);
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.resetError");
      setError(message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setUserActionLoading(true);
    setError(null);
    try {
      await adminDeleteUser(password.trim(), deleteUser.username);
      setUsers((prev) => prev.filter((user) => user.username !== deleteUser.username));
      setDeleteUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.deleteError");
      setError(message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleLoadStats = async () => {
    setError(null);
    setStatsLoading(true);
    try {
      const response = await getAdminStats(password.trim(), periodMonths);
      setStats(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.statsError");
      setError(message);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLoadPublicShares = async () => {
    setError(null);
    setPublicSharesLoading(true);
    try {
      const settings = await getAdminPublicShares(password.trim());
      setAllowPublicShares(Boolean(settings.allowPublicShares));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.publicSharesError");
      setError(message);
    } finally {
      setPublicSharesLoading(false);
    }
  };

  const handleSavePublicShares = async () => {
    setError(null);
    setPublicSharesSaving(true);
    try {
      const settings = await updateAdminPublicShares(password.trim(), allowPublicShares);
      setAllowPublicShares(Boolean(settings.allowPublicShares));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.publicSharesError");
      setError(message);
    } finally {
      setPublicSharesSaving(false);
    }
  };

  const handleUploadCredentials = async () => {
    if (!credentialsFile) return;
    setCredentialsLoading(true);
    setError(null);
    try {
      await uploadAdminAiCredentials(credentialsFile, password.trim());
      setCredentialsFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.credentialsError");
      setError(message);
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleLoadStorage = async () => {
    setError(null);
    setStorageLoading(true);
    try {
      const settings = await getAdminStorageSettings(password.trim());
      setStorageSettings(settings);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.storageError");
      setError(message);
    } finally {
      setStorageLoading(false);
    }
  };

  const handleSaveStorage = async () => {
    if (!storageSettings) return;
    setError(null);
    setStorageSaving(true);
    try {
      const updated = await updateAdminStorageSettings(password.trim(), storageSettings);
      setStorageSettings(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.storageError");
      setError(message);
    } finally {
      setStorageSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-semibold">{t("admin.title")}</h1>
            <p className="text-muted-foreground mt-2">{t("admin.subtitle")}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.accessTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">{t("admin.adminPassword")}</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("admin.adminPasswordPlaceholder")}
              />
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.aiCredentialsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="ai-credentials">{t("admin.aiCredentialsLabel")}</Label>
                <Input
                  id="ai-credentials"
                  type="file"
                  accept="application/json"
                  onChange={(event) => setCredentialsFile(event.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">{t("admin.aiCredentialsHint")}</p>
                <Button
                  variant="outline"
                  onClick={handleUploadCredentials}
                  disabled={!credentialsFile || credentialsLoading || !password.trim()}
                >
                  {credentialsLoading ? t("admin.loading") : t("admin.aiCredentialsAction")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin.publicSharesTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("admin.publicSharesLabel")}</p>
                    <p className="text-xs text-muted-foreground">{t("admin.publicSharesHint")}</p>
                  </div>
                  <Switch
                    checked={allowPublicShares}
                    onCheckedChange={(value) => setAllowPublicShares(value === true)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleLoadPublicShares}
                    disabled={publicSharesLoading || !password.trim()}
                  >
                    {publicSharesLoading ? t("admin.loading") : t("admin.loadPublicShares")}
                  </Button>
                  <Button
                    onClick={handleSavePublicShares}
                    disabled={publicSharesSaving || !password.trim()}
                  >
                    {publicSharesSaving ? t("admin.saving") : t("admin.savePublicShares")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin.storageTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="admin-storage-target">{t("admin.storageTarget")}</Label>
                  <select
                    id="admin-storage-target"
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={storageSettings?.storageTarget || "local"}
                    onChange={(event) =>
                      setStorageSettings((prev) => ({
                        storageTarget: event.target.value,
                        localPath: prev?.localPath || "",
                        nfsPath: prev?.nfsPath || "",
                      }))
                    }
                  >
                    <option value="local">{t("admin.storageTargetLocal")}</option>
                    <option value="nfs">{t("admin.storageTargetNfs")}</option>
                    <option value="both">{t("admin.storageTargetBoth")}</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">{t("admin.storageTargetHint")}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleLoadStorage}
                    disabled={storageLoading || !password.trim()}
                  >
                    {storageLoading ? t("admin.loading") : t("admin.loadStorage")}
                  </Button>
                  <Button
                    onClick={handleSaveStorage}
                    disabled={storageSaving || !password.trim()}
                  >
                    {storageSaving ? t("admin.saving") : t("admin.saveStorage")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.statsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("admin.periodLabel")}</span>
                  {[3, 6, 12].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={periodMonths === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodMonths(value)}
                    >
                      {value} {t("admin.months")}
                    </Button>
                  ))}
                </div>
                <Button onClick={handleLoadStats} disabled={statsLoading || !password.trim()}>
                  {statsLoading ? t("admin.loading") : t("admin.loadStats")}
                </Button>
              </div>

              {stats && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.totalUsers")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-semibold">{stats.totalUsers}</p>
                      {stats.generatedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("admin.updatedAt", { date: new Date(stats.generatedAt).toLocaleString("pt-PT") })}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.totalInvoices")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-semibold">{stats.totalInvoices}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("admin.uploaded")}: {stats.uploadedInvoices} · {t("admin.manual")}: {stats.manualInvoices}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.totalAccounts")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-semibold">{stats.totalAccounts}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.totalIssuers")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-semibold">{stats.totalIssuers}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {stats && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.usersChart", { months: periodMonths })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {usersChartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("admin.noData")}</p>
                      ) : (
                        <ChartContainer
                          config={{
                            total: { label: t("admin.usersLabel"), color: "hsl(var(--primary))" },
                          }}
                          className="h-[240px] w-full"
                        >
                          <AreaChart data={usersChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Area
                              type="monotone"
                              dataKey="total"
                              stroke="var(--color-total)"
                              fill="var(--color-total)"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("admin.invoicesChart", { months: periodMonths })}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {invoicesChartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("admin.noData")}</p>
                      ) : (
                        <ChartContainer
                          config={{
                            total: { label: t("admin.invoicesLabel"), color: "hsl(var(--chart-2))" },
                          }}
                          className="h-[240px] w-full"
                        >
                          <AreaChart data={invoicesChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Area
                              type="monotone"
                              dataKey="total"
                              stroke="var(--color-total)"
                              fill="var(--color-total)"
                              fillOpacity={0.2}
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.usersTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <Button onClick={handleLoadUsers} disabled={usersLoading || !password.trim()}>
                  {usersLoading ? t("admin.loading") : t("admin.loadUsers")}
                </Button>
              </div>

              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.noUsers")}</p>
              ) : (
                users.map((user) => (
                  <Card key={user.username}>
                    <CardHeader>
                      <CardTitle className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <span>{user.name || user.username}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        <div>{user.username}</div>
                        <div>{user.email || "-"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetUser(user)}
                        >
                          {t("admin.resetPassword")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteUser(user)}
                        >
                          {t("admin.deleteUser")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(resetUser)} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.resetTitle")}</DialogTitle>
            <DialogDescription>
              {resetUser ? t("admin.resetSubtitle", { user: resetUser.username }) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="new-password">{t("admin.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handleResetPassword} disabled={userActionLoading || newPassword.length < 8}>
              {userActionLoading ? t("admin.loading") : t("admin.confirmReset")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser ? t("admin.deleteSubtitle", { user: deleteUser.username }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={userActionLoading}
            >
              {userActionLoading ? t("admin.loading") : t("admin.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const formatMonthLabel = (value: string, locale: string) => {
  if (!value.includes("-")) return value;
  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
};


export default Admin;
