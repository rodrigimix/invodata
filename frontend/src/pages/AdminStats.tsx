import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { getAdminStats, AdminStatsResponse } from "@/lib/api";

const AdminStats = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodMonths, setPeriodMonths] = useState(6);
  const locale = "pt-PT";

  useEffect(() => {
    const urlPassword = searchParams.get("password") || "";
    if (urlPassword) {
      setPassword(urlPassword);
    }
  }, [searchParams]);

  const formatMonthLabel = (value: string) => {
    if (!value.includes("-")) return value;
    const [year, month] = value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(locale, { month: "short", year: "2-digit" });
  };

  const usersChartData = useMemo(
    () =>
      (stats?.usersMonthly || []).map((item) => ({
        month: item.month,
        label: formatMonthLabel(item.month),
        total: item.total,
      })),
    [stats],
  );

  const invoicesChartData = useMemo(
    () =>
      (stats?.invoicesMonthly || []).map((item) => ({
        month: item.month,
        label: formatMonthLabel(item.month),
        total: item.total,
      })),
    [stats],
  );

  const handleLoad = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await getAdminStats(password.trim(), periodMonths);
      setStats(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar estatísticas.";
      setError(message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-semibold">Admin — Estatísticas da plataforma</h1>
          <p className="text-muted-foreground mt-2">
            Aceda introduzindo a password de administração definida no backend.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium">Password admin</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Insira a password"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Período:</span>
                {[3, 6, 12].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={periodMonths === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodMonths(value)}
                  >
                    {value} meses
                  </Button>
                ))}
              </div>
              <Button onClick={handleLoad} disabled={loading || !password.trim()}>
                {loading ? "A carregar..." : "Ver estatísticas"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          {stats && (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Total de utilizadores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-semibold">{stats.totalUsers}</p>
                    {stats.generatedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Atualizado em {new Date(stats.generatedAt).toLocaleString("pt-PT")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Total de faturas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-semibold">{stats.totalInvoices}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Upload: {stats.uploadedInvoices} · Manual: {stats.manualInvoices}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contas registadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-semibold">{stats.totalAccounts}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Emitentes registados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-semibold">{stats.totalIssuers}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Progresso de utilizadores ({periodMonths} meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usersChartData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem dados.</p>
                    ) : (
                      <ChartContainer
                        config={{
                          total: { label: "Utilizadores", color: "hsl(var(--primary))" },
                        }}
                        className="h-[240px] w-full"
                      >
                        <AreaChart data={usersChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="var(--color-total)"
                            fill="var(--color-total)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Progresso de faturas ({periodMonths} meses)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {invoicesChartData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem dados.</p>
                    ) : (
                      <ChartContainer
                        config={{
                          total: { label: "Faturas", color: "hsl(var(--chart-2))" },
                        }}
                        className="h-[240px] w-full"
                      >
                        <AreaChart data={invoicesChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            stroke="var(--color-total)"
                            fill="var(--color-total)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
