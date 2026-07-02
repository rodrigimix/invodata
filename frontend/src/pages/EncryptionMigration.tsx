import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { migrateEncryption } from "@/lib/api";

const EncryptionMigration = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await migrateEncryption();
      setResult(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao migrar a encriptação.";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Migração de Encriptação</CardTitle>
            <CardDescription>
              Regrava todos os teus dados com a nova chave de encriptação. Executa apenas uma vez depois do login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleRun} disabled={isRunning}>
              {isRunning ? "A migrar..." : "Iniciar migração"}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {result ? (
              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="font-medium mb-2">Resultado</p>
                <ul className="space-y-1 text-muted-foreground">
                  {Object.entries(result).map(([key, value]) => (
                    <li key={key}>
                      {key}: {value}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EncryptionMigration;
