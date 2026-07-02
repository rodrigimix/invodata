import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Eye, EyeOff, FileText } from "lucide-react";
import { getStoredLanguage, login, setAuth, setStoredLanguage } from "@/lib/api";
import { useTranslation } from "react-i18next";

const Login = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(() => getStoredLanguage() || i18n.language || "pt");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

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
      const response = await login(formData.username, formData.password);
      setAuth(response.token, response.user);
      if (response.user?.language) {
        i18n.changeLanguage(response.user.language);
      }
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.loginError");
      setError(message);
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
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-bold text-xl text-foreground">{t("app.brand")}</span>
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

            <div className="flex items-center">
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

          <p className="text-center text-muted-foreground mt-6">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              {t("auth.createOne")}
            </Link>
          </p>
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
    </div>
  );
};

export default Login;
