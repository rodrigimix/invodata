import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";

interface CategoryChartEntry {
  name: string;
  value: number;
  color?: string;
  label?: string;
}

interface CategoryChartProps {
  data?: CategoryChartEntry[];
  periodLabel?: string;
  headerContent?: React.ReactNode;
}

const categoryColorMap: Record<string, string> = {
  FUEL: "#b45309",
  RESTAURANT: "#b91c1c",
  SUPERMARKET: "#15803d",
  TRANSPORT: "#0369a1",
  HEALTH: "#6d28d9",
  UTILITIES: "#475569",
  TELECOM: "#c2410c",
  CLOTHING: "#be123c",
  EDUCATION: "#1d4ed8",
  ENTERTAINMENT: "#a16207",
  SERVICES: "#0f766e",
  REVENUE: "#4d7c0f",
};
const palette = Object.values(categoryColorMap);

export const CategoryChart = ({ data, periodLabel, headerContent }: CategoryChartProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? "pt-PT" : "en-US";
  const getCategoryLabel = (value?: string) => {
    if (!value) return "";
    const normalized = value.trim().toUpperCase();
    return t(`issuerCategories.${normalized}`, { defaultValue: value });
  };
  const fallbackData: CategoryChartEntry[] = [
    { name: t("dashboard.categoryHousing"), value: 45, color: palette[0] },
    { name: t("dashboard.categoryFood"), value: 20, color: palette[1] },
    { name: t("dashboard.categoryLeisure"), value: 25, color: palette[2] },
    { name: t("dashboard.categoryOther"), value: 10, color: palette[3] },
  ];
  const chartData = (data && data.length > 0 ? data : fallbackData).map((item, index) => {
    const normalized = item.name?.trim().toUpperCase() ?? "";
    return {
      ...item,
      color: item.color || categoryColorMap[normalized] || palette[index % palette.length],
      label: getCategoryLabel(item.name),
    };
  });
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="invodata-card p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-lg text-foreground">{t("dashboard.expensesByCategory")}</h3>
          {periodLabel && <p className="text-sm text-muted-foreground mt-1">{periodLabel}</p>}
        </div>
        {headerContent ? <div className="flex flex-col items-end gap-2">{headerContent}</div> : null}
      </div>

      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">{t("dashboard.total")}</span>
          <span className="text-2xl font-bold text-foreground">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {chartData.map((item, index) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={`${item.name}-${index}`} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">
                {(item.label || item.name)} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
