import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getSetupStatus } from "@/lib/api";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getSetupStatus()
      .then((status) => {
        if (!isMounted) return;
        setTarget(status.setupCompleted ? "/login" : "/setup");
      })
      .catch(() => {
        if (!isMounted) return;
        setTarget("/login");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!target) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="invodata-card p-6 text-sm text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return <Navigate to={target} replace />;
};

export default Index;
