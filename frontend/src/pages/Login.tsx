import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, FileText } from "lucide-react";
import { clearUserKey, getSetupStatus, getStoredLanguage, getUserEncryptionSalt, login, setAuth, setStoredLanguage, setUserKey } from "@/lib/api";
import { deriveUserKey } from "@/lib/crypto";
import { useTranslation } from "react-i18next";
import { useUploadJobs } from "@/context/UploadJobContext";

const Login = () => {
  const MFA_TRUST_KEY = "invodata_mfa_trust";
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCompletedEntries } = useUploadJobs();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [language, setLanguage] = useState(() => getStoredLanguage() || i18n.language || "pt");
  const isPt = i18n.language?.toLowerCase().startsWith("pt");
  const surveyUrl = isPt
    ? "https://forms.gle/J8a4V2sUE8jn43pE6"
    : "https://forms.gle/SEjfKLthcsonTbCEA";
  const surveyLabel = isPt ? "Responder ao inquérito" : "Take the survey";
  const [derivedKey, setDerivedKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  useEffect(() => {
    clearCompletedEntries();
  }, [clearCompletedEntries]);

  useEffect(() => {
    let isMounted = true;
    getSetupStatus()
      .then((status) => {
        if (!isMounted) return;
        if (!status.setupCompleted) {
          navigate("/setup", { replace: true });
        }
      })
      .catch(() => {
        // Ignore setup status errors to avoid blocking login.
      });
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    const message = (location.state as { registeredMessage?: string } | null)?.registeredMessage;
    if (message) {
      setSuccessMessage(message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setStoredLanguage(value);
    i18n.changeLanguage(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const saltResponse = await getUserEncryptionSalt(formData.username);
      const key = await deriveUserKey(formData.password, saltResponse.salt);
      setDerivedKey(key);
      setUserKey(key);
      const trustToken = localStorage.getItem(MFA_TRUST_KEY) || undefined;
      const response = await login(formData.username, formData.password, undefined, false, trustToken);
      setAuth(response.token, response.user);
      if (response.user?.language) {
        i18n.changeLanguage(response.user.language);
      }
      navigate("/dashboard");
    } catch (err) {
      const raw = err instanceof Error ? err.message : t("auth.loginError");
      const upper = raw.toUpperCase();
      if (upper.includes("MFA_REQUIRED")) {
        setMfaRequired(true);
        setMfaDialogOpen(true);
        setError(t("auth.mfaRequired"));
      } else if (upper.includes("INVALID_MFA_CODE")) {
        setMfaRequired(true);
        setMfaDialogOpen(true);
        setError(t("auth.mfaInvalid"));
      } else {
        clearUserKey();
        setError(raw);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaCode) {
      setError(t("auth.mfaRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      if (!derivedKey) {
        const saltResponse = await getUserEncryptionSalt(formData.username);
        const key = await deriveUserKey(formData.password, saltResponse.salt);
        setDerivedKey(key);
        setUserKey(key);
      } else {
        setUserKey(derivedKey);
      }
      const response = await login(
        formData.username,
        formData.password,
        mfaCode,
        trustDevice
      );
      if (trustDevice && response.mfaTrustToken) {
        localStorage.setItem(MFA_TRUST_KEY, response.mfaTrustToken);
      }
      setAuth(response.token, response.user);
      if (response.user?.language) {
        i18n.changeLanguage(response.user.language);
      }
      setMfaDialogOpen(false);
      navigate("/dashboard");
    } catch (err) {
      const raw = err instanceof Error ? err.message : t("auth.loginError");
      const upper = raw.toUpperCase();
      if (upper.includes("INVALID_MFA_CODE")) {
        setError(t("auth.mfaInvalid"));
      } else {
        clearUserKey();
        setError(raw);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 w-40">
            <Label htmlFor="login-language" className="sr-only">
              {t("settings.language")}
            </Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="login-language" className="h-10">
                <SelectValue placeholder={t("settings.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Logo */}
          <div className="mb-10">
            <div className="w-full rounded-lg border border-border bg-background/80 p-5 shadow-sm">
              <img src="/logo.png" alt={t("app.brand")} className="h-28 w-full object-contain" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.welcomeBack")}</h1>
          <p className="text-muted-foreground mb-8">
            {t("auth.signInPrompt")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">{t("auth.username")}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t("auth.usernamePlaceholder")}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mfaRequired && (
              <p className="text-xs text-muted-foreground">{t("auth.mfaPopupHint")}</p>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-input" />
                <span className="text-sm text-muted-foreground">{t("auth.rememberMe")}</span>
              </label>
            </div>

            <Button type="submit" className="w-full h-12 text-base">
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          )}

          <p className="text-center text-muted-foreground mt-6">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <span>{t("app.footer")}</span>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/terms" className="hover:underline">
                {t("auth.termsLink")}
              </Link>
              <Link to="/privacy" className="hover:underline">
                {t("auth.privacyPolicy")}
              </Link>
              <a href={surveyUrl} target="_blank" rel="noreferrer" className="hover:underline">
                {surveyLabel}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            {t("auth.heroTitle")}
          </h2>
          <p className="text-primary-foreground/80">
            {t("auth.heroSubtitle")}
          </p>
        </div>
      </div>

      <Dialog open={mfaDialogOpen} onOpenChange={setMfaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.mfaDialogTitle")}</DialogTitle>
            <DialogDescription>{t("auth.mfaDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="mfa-code">{t("auth.mfaCode")}</Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                onCheckedChange={(checked) => setTrustDevice(checked === true)}
              />
              <Label htmlFor="trust-device" className="text-sm text-muted-foreground">
                {t("auth.trustDevice")}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaDialogOpen(false)}>
              {t("auth.cancel")}
            </Button>
            <Button onClick={handleMfaSubmit} disabled={isSubmitting}>
              {isSubmitting ? t("auth.signingIn") : t("auth.confirmMfa")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
