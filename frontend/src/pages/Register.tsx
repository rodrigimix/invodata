import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Check, FileText } from "lucide-react";
import { getSetupStatus, getStoredLanguage, registerUser, setStoredLanguage } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { useUploadJobs } from "@/context/UploadJobContext";

const Register = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { clearCompletedEntries } = useUploadJobs();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState(() => getStoredLanguage() || i18n.language || "pt");
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    aiConsent: false,
    privacyConsent: false,
    termsConsent: false,
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
        // Ignore setup status errors to avoid blocking registration.
      });
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setStoredLanguage(value);
    i18n.changeLanguage(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      nextErrors.name = requiredFieldMessage(t("auth.name"));
    }
    if (!formData.username.trim()) {
      nextErrors.username = requiredFieldMessage(t("auth.username"));
    }
    if (!formData.email.trim()) {
      nextErrors.email = requiredFieldMessage(t("auth.email"));
    }
    if (!formData.password.trim()) {
      nextErrors.password = requiredFieldMessage(t("auth.password"));
    }
    if (!formData.privacyConsent) {
      nextErrors.privacyConsent = t("auth.privacyRequired");
    }
    if (!formData.termsConsent) {
      nextErrors.termsConsent = t("auth.termsRequired");
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    if (formData.password !== formData.confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await registerUser({
        username: formData.username,
        password: formData.password,
        email: formData.email,
        name: formData.name,
        aiConsent: formData.aiConsent,
        privacyConsent: formData.privacyConsent,
      });
      const registeredMessage = i18n.language?.toLowerCase().startsWith("pt")
        ? "Conta registada. Faz login para continuar."
        : "Account created. Please sign in to continue.";
      navigate("/login", { state: { registeredMessage } });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : t("auth.registerError");
      const lower = rawMessage.toLowerCase();
      const message = lower.includes("email")
        ? t("auth.emailExists")
        : lower.includes("username") && lower.includes("size")
          ? t("auth.usernameLength")
          : rawMessage;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredFieldMessage = (field: string) =>
    t("auth.requiredField", { field });

  const passwordRequirements = [
    { label: t("auth.passwordMin"), met: formData.password.length >= 8 },
    { label: t("auth.passwordUpper"), met: /[A-Z]/.test(formData.password) },
    { label: t("auth.passwordNumber"), met: /[0-9]/.test(formData.password) },
    { label: t("auth.passwordSpecial"), met: /[!@#$%^&*]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            {t("auth.registerHeroTitle")}
          </h2>
          <p className="text-primary-foreground/80">
            {t("auth.registerHeroSubtitle")}
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 w-40">
            <Label htmlFor="register-language" className="sr-only">
              {t("settings.language")}
            </Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="register-language" className="h-10">
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

          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.register")}</h1>
          <p className="text-muted-foreground mb-8">
            {t("auth.registerPrompt")}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("auth.name")} <span className="text-danger">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("auth.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  className="h-11"
                />
                {fieldErrors.name && (
                  <p className="text-xs text-danger">{fieldErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">
                  {t("auth.username")} <span className="text-danger">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("auth.usernamePlaceholderRegister")}
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, username: "" }));
                  }}
                  className="h-11"
                />
                {fieldErrors.username && (
                  <p className="text-xs text-danger">{fieldErrors.username}</p>
                )}
                <p className="text-xs text-muted-foreground">{t("auth.usernameRule")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {t("auth.email")} <span className="text-danger">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
                className="h-11"
              />
              {fieldErrors.email && (
                <p className="text-xs text-danger">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {t("auth.password")} <span className="text-danger">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-danger">{fieldErrors.password}</p>
              )}

              {/* Password requirements */}
              <div className="grid grid-cols-2 gap-1 mt-2">
                {passwordRequirements.map((req) => (
                  <div key={req.label} className="flex items-center gap-1.5">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${req.met ? 'bg-success' : 'bg-muted'}`}>
                      {req.met && <Check className="w-2.5 h-2.5 text-success-foreground" />}
                    </div>
                    <span className={`text-xs ${req.met ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="h-11"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox
                id="aiConsent"
                checked={formData.aiConsent}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, aiConsent: checked === true })
                }
              />
              <div className="space-y-1">
                <Label htmlFor="aiConsent" className="text-sm font-medium text-foreground">
                  {t("auth.aiConsentTitle")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("auth.aiConsentText")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox
                id="privacyConsent"
                checked={formData.privacyConsent}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, privacyConsent: checked === true });
                  setFieldErrors((prev) => ({ ...prev, privacyConsent: "" }));
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="privacyConsent" className="text-sm font-medium text-foreground">
                  {t("auth.privacyConsentTitle")} <span className="text-danger">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("auth.privacyConsentText")} {" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    {t("auth.privacyPolicy")}
                  </Link>
                </p>
                {fieldErrors.privacyConsent && (
                  <p className="text-xs text-danger">{fieldErrors.privacyConsent}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox
                id="termsConsent"
                checked={formData.termsConsent}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, termsConsent: checked === true });
                  setFieldErrors((prev) => ({ ...prev, termsConsent: "" }));
                }}
              />
              <div className="space-y-1">
                <Label htmlFor="termsConsent" className="text-sm font-medium text-foreground">
                  {t("auth.termsConsentTitle")} <span className="text-danger">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("auth.termsConsentText")} {" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    {t("auth.termsLink")}
                  </Link>
                </p>
                {fieldErrors.termsConsent && (
                  <p className="text-xs text-danger">{fieldErrors.termsConsent}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base mt-2">
              {isSubmitting ? t("auth.creatingAccount") : t("auth.signUp")}
            </Button>
          </form>
          {error && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <p className="text-center text-muted-foreground mt-6">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("auth.loginHere")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
