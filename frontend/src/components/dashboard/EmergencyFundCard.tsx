import { useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

type ActiveGoalCard = {
  id: string;
  title: string;
  detail: string | null;
  amountLine: string;
  progress: number;
  icon?: React.ElementType;
};

interface EmergencyFundCardProps {
  goals: ActiveGoalCard[];
}

export const EmergencyFundCard = ({ goals }: EmergencyFundCardProps) => {
  const { t, i18n } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartRef = useRef<number | null>(null);
  const touchMovedRef = useRef(false);
  const total = goals.length;
  const activeGoal = goals[Math.min(activeIndex, Math.max(total - 1, 0))];
  const progressValue = activeGoal ? Math.min(activeGoal.progress, 100) : 0;
  const isNearComplete = activeGoal ? activeGoal.progress >= 90 : false;

  useEffect(() => {
    if (total === 0) return;
    if (activeIndex >= total) {
      setActiveIndex(total - 1);
    }
  }, [total, activeIndex]);

  const goPrev = () => {
    if (total <= 1) return;
    setActiveIndex((current) => (current - 1 + total) % total);
  };

  const goNext = () => {
    if (total <= 1) return;
    setActiveIndex((current) => (current + 1) % total);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    touchStartRef.current = event.clientX;
    touchMovedRef.current = false;
  };

  const handlePointerMove = () => {
    touchMovedRef.current = true;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = touchStartRef.current;
    if (startX === null || !touchMovedRef.current || total <= 1) return;
    const delta = startX - event.clientX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  if (!activeGoal) {
    return (
      <div className="invodata-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-xs text-primary font-semibold uppercase">{t("dashboard.activeGoal")}</span>
            <p className="text-sm text-muted-foreground mt-2">{t("dashboard.noActiveGoals")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="invodata-card p-6 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          {activeGoal.icon ? (
            <activeGoal.icon className="w-6 h-6 text-primary" />
          ) : (
            <Target className="w-6 h-6 text-primary" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-primary font-semibold uppercase">{t("dashboard.activeGoal")}</span>
            {total > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label={t("dashboard.previousGoal")}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label={t("dashboard.nextGoal")}
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <h4 className="text-lg font-bold text-foreground mb-1">{activeGoal.title}</h4>
          {activeGoal.detail && (
            <p className="text-base font-medium text-foreground">{activeGoal.detail}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{activeGoal.amountLine}</p>
          <div className="flex items-center justify-between mt-3 mb-2">
            <span className="text-xs text-muted-foreground uppercase">{t("dashboard.progress")}</span>
            <span className={isNearComplete ? "text-sm font-medium text-success" : "text-sm font-medium text-primary"}>
              {progressValue.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={progressValue}
            className="h-2"
            indicatorClassName={isNearComplete ? "bg-success" : undefined}
          />
        </div>
      </div>
      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {goals.map((goal, index) => (
            <button
              type="button"
              key={goal.id}
              onClick={() => setActiveIndex(index)}
              aria-label={t("dashboard.selectGoal", { index: index + 1, total })}
              className={
                index === activeIndex
                  ? "h-1.5 w-6 rounded-full bg-primary"
                  : "h-1.5 w-6 rounded-full bg-muted"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
