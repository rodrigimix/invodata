import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";

interface RevenueChartEntry {
  month: string;
  receita: number;
  despesa: number;
}

interface RevenueChartProps {
  data?: RevenueChartEntry[];
}

const fallbackData: RevenueChartEntry[] = [
  { month: "JAN", receita: 4000, despesa: 2400 },
  { month: "FEV", receita: 3000, despesa: 1398 },
  { month: "MAR", receita: 5000, despesa: 4800 },
  { month: "ABR", receita: 4780, despesa: 3908 },
  { month: "MAI", receita: 5890, despesa: 4800 },
  { month: "JUN", receita: 6390, despesa: 3800 },
];

export const RevenueChart = ({ data }: RevenueChartProps) => {
  const { t } = useTranslation();
  const chartData = data && data.length > 0 ? data : fallbackData;

  return (
    <div className="invodata-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg text-foreground">{t("dashboard.monthlyEvolution")}</h3>
          <p className="text-sm text-muted-foreground">{t("dashboard.incomeVsExpense")}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">{t("dashboard.income")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <span className="text-sm text-muted-foreground">{t("dashboard.expense")}</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-[16rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
              tickFormatter={(value) => `€${value/1000}k`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(214, 32%, 91%)',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`€${value.toLocaleString()}`, '']}
            />
            <Area 
              type="monotone" 
              dataKey="receita" 
              stroke="hsl(221, 83%, 53%)" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorReceita)" 
            />
            <Area 
              type="monotone" 
              dataKey="despesa" 
              stroke="hsl(215, 16%, 47%)" 
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
