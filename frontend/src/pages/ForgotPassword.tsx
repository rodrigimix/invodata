import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/api";
import { useTranslation } from "react-i18next";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setResetLink(null);

    if (!identifier.trim()) {
      setError(t("auth.forgotIdentifierRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(identifier.trim());
      setSuccess(t("auth.forgotSuccess"));
      if (response.resetToken) {
        setResetLink(`/reset-password?token=${encodeURIComponent(response.resetToken)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.forgotError");
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

        <h1 className="text-3xl font-bold text-foreground mb-2">{t("auth.forgotTitle")}</h1>
        <p className="text-muted-foreground mb-8">{t("auth.forgotSubtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier">{t("auth.forgotIdentifierLabel")}</Label>
            <Input
              id="identifier"
              type="text"
              placeholder={t("auth.forgotIdentifierPlaceholder")}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="h-12"
            />
          </div>

          <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
            {isSubmitting ? t("auth.forgotSubmitting") : t("auth.forgotSubmit")}
          </Button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}
        {resetLink && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            <p className="text-foreground">{t("auth.forgotResetHint")}</p>
            <Link to={resetLink} className="text-primary hover:underline break-all">
              {t("auth.forgotResetLink")}
            </Link>
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

export default ForgotPassword;
