import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { completeSetup, getSetupStatus, uploadSetupAiCredentials, type SetupStatus } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";

const Setup = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [allowPublicShares, setAllowPublicShares] = useState(false);
  const [storageTarget, setStorageTarget] = useState("local");
  const [credentialsFile, setCredentialsFile] = useState<File | null>(null);
  const [isUploadingCredentials, setIsUploadingCredentials] = useState(false);

  const canSubmit = useMemo(() => {
    if (!adminPassword || adminPassword.length < 8) return false;
    if (adminPassword !== confirmPassword) return false;
    return true;
  }, [adminPassword, confirmPassword]);

  useEffect(() => {
    let isMounted = true;
    getSetupStatus()
      .then((data) => {
        if (!isMounted) return;
        if (data.setupCompleted) {
          navigate("/login", { replace: true });
          return;
        }
        setStatus(data);
        setAiEnabled(Boolean(data.aiEnabled));
        setAllowPublicShares(Boolean(data.allowPublicShares));
        setStorageTarget(data.storageTarget || "local");
      })
      .catch(() => {
        if (!isMounted) return;
        toast({
          title: t("setup.statusErrorTitle"),
          description: t("setup.statusErrorBody"),
          variant: "destructive",
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [navigate, toast, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (credentialsFile) {
        setIsUploadingCredentials(true);
        await uploadSetupAiCredentials(credentialsFile);
      }
      await completeSetup({
        adminPassword,
        storageTarget,
        aiEnabled,
        allowPublicShares,
      });
      toast({
        title: t("setup.successTitle"),
        description: t("setup.successBody"),
      });
      navigate("/login", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("setup.submitErrorBody");
      toast({
        title: t("setup.submitErrorTitle"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingCredentials(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="invodata-card p-6 text-sm text-muted-foreground">{t("setup.loading")}</div>
      </div>
    );
  }

  if (status?.setupCompleted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-44 rounded-lg border border-border bg-background/80 p-3 shadow-sm">
            <img src="/logo.png" alt={t("app.brand")} className="h-20 w-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("setup.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("setup.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="invodata-card p-6 space-y-5">
            <div>
              <Label htmlFor="adminPassword">{t("setup.adminPassword")}</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("setup.adminPasswordHint")}</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">{t("setup.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="invodata-card p-6 space-y-5">
            <div>
              <Label htmlFor="storageTarget">{t("setup.storageTarget")}</Label>
              <select
                id="storageTarget"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={storageTarget}
                onChange={(event) => setStorageTarget(event.target.value)}
              >
                <option value="local">{t("setup.storageTargetLocal")}</option>
                <option value="nfs">{t("setup.storageTargetNfs")}</option>
                <option value="both">{t("setup.storageTargetBoth")}</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">{t("setup.storageTargetHint")}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("setup.aiEnabled")}</p>
                <p className="text-xs text-muted-foreground">{t("setup.aiEnabledHint")}</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={(value) => setAiEnabled(value === true)} />
            </div>
            <div>
              <Label htmlFor="ai-credentials">{t("setup.aiCredentialsLabel")}</Label>
              <Input
                id="ai-credentials"
                type="file"
                accept="application/json"
                onChange={(event) => setCredentialsFile(event.target.files?.[0] ?? null)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("setup.aiCredentialsHint")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("setup.aiCredentialsNotice")}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t("setup.publicShares")}</p>
                <p className="text-xs text-muted-foreground">{t("setup.publicSharesHint")}</p>
              </div>
              <Switch
                checked={allowPublicShares}
                onCheckedChange={(value) => setAllowPublicShares(value === true)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={!canSubmit || submitting || isUploadingCredentials}>
              {submitting ? t("setup.submitting") : t("setup.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Setup;
