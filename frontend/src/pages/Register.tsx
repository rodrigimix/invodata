import { useState } from "react";
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
import { getStoredLanguage, registerUser, setAuth, setStoredLanguage } from "@/lib/api";
import { useTranslation } from "react-i18next";

const Register = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(() => getStoredLanguage() || i18n.language || "pt");
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    adminKey: "",
    aiConsent: false,
  });

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setStoredLanguage(value);
    i18n.changeLanguage(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
        adminKey: formData.adminKey,
        aiConsent: formData.aiConsent,
      });
      setAuth(response.token, response.user);
      if (response.user?.language) {
        i18n.changeLanguage(response.user.language);
      }
      navigate("/dashboard");
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
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-bold text-xl text-foreground">{t("app.brand")}</span>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.register")}</h1>
          <p className="text-muted-foreground mb-8">
            {t("auth.registerPrompt")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("auth.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("auth.usernamePlaceholderRegister")}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">{t("auth.usernameRule")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-11"
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

            <div className="space-y-2">
              <Label htmlFor="adminKey">{t("auth.adminKey")}</Label>
              <Input
                id="adminKey"
                type="text"
                placeholder={t("auth.adminKeyPlaceholder")}
                value={formData.adminKey}
                onChange={(e) => setFormData({ ...formData, adminKey: e.target.value })}
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
