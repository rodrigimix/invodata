import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    positive: boolean;
  };
  icon?: ReactNode;
  className?: string;
}

export const StatCard = ({ title, value, change, icon, className }: StatCardProps) => {
  return (
    <div className={cn("invodata-card p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          
          {change && (
            <div className="flex items-center gap-1">
              {change.positive ? (
                <ArrowUpRight className="w-4 h-4 text-success" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-danger" />
              )}
              <span className={cn(
                "text-sm font-medium",
                change.positive ? "text-success" : "text-danger"
              )}>
                {change.value}
              </span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
