import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import {
  adminDeleteUser,
  adminResetUserPassword,
  getAdminUsers,
  uploadAdminAiCredentials,
  type AdminUser,
} from "@/lib/api";

const AdminUsers = () => {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsFile, setCredentialsFile] = useState<File | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  const handleLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getAdminUsers(password.trim());
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.usersLoadError");
      setError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await adminResetUserPassword(password.trim(), resetUser.username, newPassword);
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.resetError");
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setActionLoading(true);
    setError(null);
    try {
      await adminDeleteUser(password.trim(), deleteUser.username);
      setUsers((prev) => prev.filter((user) => user.username !== deleteUser.username));
      setDeleteUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("admin.deleteError");
      setError(message);
    } finally {
      setActionLoading(false);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-semibold">{t("admin.usersTitle")}</h1>
          <p className="text-muted-foreground mt-2">{t("admin.usersSubtitle")}</p>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium">{t("admin.adminPassword")}</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("admin.adminPasswordPlaceholder")}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <Button onClick={handleLoad} disabled={loading || !password.trim()}>
                {loading ? t("admin.loading") : t("admin.loadUsers")}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-4">
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
          </div>
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
            <Button onClick={handleResetPassword} disabled={actionLoading || newPassword.length < 8}>
              {actionLoading ? t("admin.loading") : t("admin.confirmReset")}
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
              disabled={actionLoading}
            >
              {actionLoading ? t("admin.loading") : t("admin.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
