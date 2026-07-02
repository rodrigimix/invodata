import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Lock, Bell, CreditCard, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearAuth,
  deleteUserData,
  exportUserDataZip,
  getAuthToken,
  getUserProfile,
  setAuth,
  setStoredLanguage,
  updateAiConsent,
  updatePassword,
  updateUserProfile,
  type UserProfile,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("invodata_theme");
    if (stored === "light" || stored === "dark") return stored;
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });
  const [aiConsentEnabled, setAiConsentEnabled] = useState(false);
  const [language, setLanguage] = useState("pt");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const tabs = useMemo(
    () => [
      { id: "profile", label: t("settings.profile"), icon: User },
      { id: "appearance", label: t("settings.appearance"), icon: Sparkles },
      { id: "security", label: t("settings.security"), icon: Lock },
      { id: "notifications", label: t("settings.notifications"), icon: Bell },
      { id: "subscription", label: t("settings.subscription"), icon: CreditCard },
      { id: "ai-consent", label: t("settings.aiConsent"), icon: Sparkles },
    ],
    [t],
  );

  const passwordRequirements = [
    { label: t("auth.passwordMin"), met: newPassword.length >= 8 },
    { label: t("auth.passwordUpper"), met: /[A-Z]/.test(newPassword) },
    { label: t("auth.passwordNumber"), met: /[0-9]/.test(newPassword) },
    { label: t("auth.passwordSpecial"), met: /[!@#$%^&*]/.test(newPassword) },
  ];

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("invodata_theme", theme);
  }, [theme]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let isMounted = true;
    getUserProfile()
      .then((profile) => {
        if (!isMounted) return;
        setProfile(profile);
        setFullName(profile.name || "");
        setEmail(profile.email || "");
        setTaxId(profile.taxId || "");
        setAiConsentEnabled(Boolean(profile.aiConsent));
        const nextLanguage = profile.language || "pt";
        setLanguage(nextLanguage);
        setStoredLanguage(nextLanguage);
        i18n.changeLanguage(nextLanguage);
      })
      .catch(() => {
        // Ignore fetch errors; keep the current language.
      });
    return () => {
      isMounted = false;
    };
  }, [i18n]);

  const handleLanguageChange = async (value: string) => {
    setLanguage(value);
    setStoredLanguage(value);
    i18n.changeLanguage(value);

    try {
      const response = await updateUserProfile({ language: value });
      const token = response.token || getAuthToken();
      if (token) {
        setAuth(token, response.user);
      }
    } catch {
      // Keep the selected language even if the request fails.
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await updateUserProfile({
        name: fullName || undefined,
        email: email || undefined,
        taxId: taxId || undefined,
        language,
      });
      const token = response.token || getAuthToken();
      if (token) {
        setAuth(token, response.user);
      }
      setProfile(response.user);
      if (response.user.language) {
        setStoredLanguage(response.user.language);
        i18n.changeLanguage(response.user.language);
      }

      if (response.user.aiConsent !== aiConsentEnabled) {
        const consentResult = await updateAiConsent(aiConsentEnabled);
        setProfile((prev) => (prev ? { ...prev, aiConsent: consentResult.ai_consent } : prev));
      }

      toast({
        title: t("settings.saveSuccess"),
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : t("settings.saveError");
      const description = rawMessage.toLowerCase().includes("email")
        ? t("settings.emailExists")
        : rawMessage;
      toast({
        title: t("settings.saveError"),
        description,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (!profile) return;
    setFullName(profile.name || "");
    setEmail(profile.email || "");
    setTaxId(profile.taxId || "");
    setAiConsentEnabled(Boolean(profile.aiConsent));
    const nextLanguage = profile.language || "pt";
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
    i18n.changeLanguage(nextLanguage);
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast({
        title: t("settings.passwordRequired"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t("settings.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }
    if (!passwordRequirements.every((req) => req.met)) {
      toast({
        title: t("settings.passwordRulesError"),
        variant: "destructive",
      });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updatePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: t("settings.passwordUpdated"),
      });
    } catch (err) {
      toast({
        title: t("settings.passwordError"),
        description: err instanceof Error ? err.message : t("settings.passwordError"),
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExportData = async () => {
    if (!exportPassword) {
      toast({
        title: t("settings.passwordRequired"),
        variant: "destructive",
      });
      return;
    }
    setExporting(true);
    try {
      const blob = await exportUserDataZip(exportPassword);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invodata-user-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
      setExportPassword("");
      toast({
        title: t("settings.exportSuccess"),
      });
    } catch (err) {
      toast({
        title: t("settings.exportError"),
        description: err instanceof Error ? err.message : t("settings.exportError"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (!deletePassword) {
      toast({
        title: t("settings.passwordRequired"),
        variant: "destructive",
      });
      return;
    }
    setDeleting(true);
    try {
      await deleteUserData(deletePassword);
      clearAuth();
      navigate("/login");
    } catch (err) {
      toast({
        title: t("settings.deleteError"),
        description: err instanceof Error ? err.message : t("settings.deleteError"),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="mb-2 text-sm text-muted-foreground">
        {t("common.home")} / <span className="text-foreground">{t("settings.breadcrumb")}</span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === "profile" && (
            <>
              {/* Personal Information */}
              <div className="invodata-card p-6">
                <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.personalInfo")}</h2>
                <p className="text-muted-foreground text-sm mb-6">{t("settings.personalInfoDesc")}</p>

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("settings.fullName")}</Label>
                    <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("settings.email")}</Label>
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">{t("settings.nif")}</Label>
                    <Input id="taxId" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">{t("settings.language")}</Label>
                    <Select value={language} onValueChange={handleLanguageChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectLanguage")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "security" && (
            <>
              {/* Security */}
              <div className="invodata-card p-6">
                <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.securityTitle")}</h2>
                <p className="text-muted-foreground text-sm mb-6">{t("settings.securityDesc")}</p>

                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-4">{t("settings.changePassword")}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-primary text-sm">{t("settings.currentPassword")}</Label>
                      <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-primary text-sm">{t("settings.newPassword")}</Label>
                      <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                      <div className="grid grid-cols-2 gap-1 mt-3">
                        {passwordRequirements.map((req) => (
                          <div key={req.label} className="flex items-center gap-1.5">
                            <div
                              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${req.met ? "bg-success" : "bg-muted"
                                }`}
                            >
                              {req.met && <Check className="w-2.5 h-2.5 text-success-foreground" />}
                            </div>
                            <span className={`text-xs ${req.met ? "text-foreground" : "text-muted-foreground"}`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-primary text-sm">{t("settings.confirmNew")}</Label>
                      <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={handleUpdatePassword}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? t("settings.updatingPassword") : t("settings.updatePassword")}
                  </Button>
                </div>

                {/* Two-Factor */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{t("settings.twoFactorTitle")}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">{t("settings.recommended")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("settings.twoFactorComingSoon")}
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </div>

              {/* Data & Privacy */}
              <div className="invodata-card p-6">
                <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.dataTitle")}</h2>
                <p className="text-muted-foreground text-sm mb-6">{t("settings.dataDesc")}</p>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <h4 className="font-semibold text-foreground">{t("settings.exportTitle")}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{t("settings.exportDesc")}</p>
                    </div>
                    <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                      {t("settings.exportAction")}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <h4 className="font-semibold text-foreground">{t("settings.deleteTitle")}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{t("settings.deleteDesc")}</p>
                    </div>
                    <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                      {t("settings.deleteAction")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "ai-consent" && (
            <div className="invodata-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.aiConsentTitle")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("settings.aiConsentDesc")}</p>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-semibold text-foreground">{t("settings.aiConsentToggleTitle")}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("settings.aiConsentToggleDesc")}
                  </p>
                </div>
                <Switch checked={aiConsentEnabled} onCheckedChange={setAiConsentEnabled} />
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="invodata-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.appearanceTitle")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("settings.appearanceDesc")}</p>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-semibold text-foreground">{t("settings.themeTitle")}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {theme === "dark" ? t("settings.themeDark") : t("settings.themeLight")}
                  </p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
              </div>
            </div>
          )}

          {(activeTab === "notifications" || activeTab === "subscription") && (
            <div className="invodata-card p-6">
              <h2 className="text-xl font-bold text-foreground mb-1">{t("settings.comingSoonTitle")}</h2>
              <p className="text-muted-foreground text-sm">{t("settings.comingSoonDesc")}</p>
            </div>
          )}

          {/* Actions */}
          {activeTab !== "notifications" && activeTab !== "subscription" && activeTab !== "appearance" && (
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
              <Button variant="ghost" onClick={handleDiscardChanges}>
                {t("settings.discardChanges")}
              </Button>
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? t("settings.savingChanges") : t("settings.saveChanges")}
              </Button>
            </div>
          )}
        </div>
      </div >

      <Dialog open={exportDialogOpen} onOpenChange={(open) => {
        setExportDialogOpen(open);
        if (!open) setExportPassword("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.exportDialogTitle")}</DialogTitle>
            <DialogDescription>{t("settings.exportDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="export-password">{t("settings.passwordLabel")}</Label>
            <Input
              id="export-password"
              type="password"
              value={exportPassword}
              onChange={(event) => setExportPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              {t("settings.cancel")}
            </Button>
            <Button onClick={handleExportData} disabled={exporting}>
              {exporting ? t("settings.exporting") : t("settings.exportConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setDeletePassword("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.deleteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("settings.deleteDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-password">{t("settings.passwordLabel")}</Label>
            <Input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("settings.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteData} disabled={deleting}>
              {deleting ? t("settings.deleting") : t("settings.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          {t("settings.footer")}
        </p>
      </footer>
    </DashboardLayout >
  );
};

export default Settings;
