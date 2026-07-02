import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

const ResetPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRequirements = [
    { label: t("auth.passwordMin"), met: password.length >= 8 },
    { label: t("auth.passwordUpper"), met: /[A-Z]/.test(password) },
    { label: t("auth.passwordNumber"), met: /[0-9]/.test(password) },
    { label: t("auth.passwordSpecial"), met: /[!@#$%^&*]/.test(password) },
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError(t("auth.resetTokenMissing"));
      return;
    }
    if (!password || !confirmPassword) {
      setError(t("auth.resetRequired"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.resetMismatch"));
      return;
    }
    if (!passwordRequirements.every((req) => req.met)) {
      setError(t("settings.passwordRulesError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate("/login", {
        state: { registeredMessage: t("auth.resetSuccess") },
        replace: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.resetError");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-10">
          <div className="w-full rounded-lg border border-border bg-background/80 p-5 shadow-sm">
            <img src="/logo.png" alt={t("app.brand")} className="h-28 w-full object-contain" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.resetTitle")}</h1>
        <p className="text-muted-foreground mb-8">{t("auth.resetSubtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("auth.resetNewPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12"
            />
            <div className="grid grid-cols-2 gap-1 mt-2">
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
            <Label htmlFor="confirm-password">{t("auth.resetConfirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-12"
            />
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
            {isSubmitting ? t("auth.resetSubmitting") : t("auth.resetSubmit")}
          </Button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <p className="text-center text-muted-foreground mt-6">
          <Link to="/login" className="text-primary font-medium hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
