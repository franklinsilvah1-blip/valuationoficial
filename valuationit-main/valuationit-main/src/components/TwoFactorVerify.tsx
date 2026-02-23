import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";

interface TwoFactorVerifyProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorVerify = ({ factorId, onSuccess, onCancel }: TwoFactorVerifyProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Digite o código de 6 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Código inválido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle>Verificação de Dois Fatores</CardTitle>
        <CardDescription>
          Digite o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Código de Verificação</Label>
          <Input
            id="mfa-code"
            placeholder="000000"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onKeyDown={handleKeyDown}
            maxLength={6}
            className="text-center text-2xl tracking-widest"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleVerify} 
            disabled={loading || code.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar"
            )}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Voltar
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Abra seu aplicativo autenticador (Google Authenticator, Authy, etc.) para obter o código
        </p>
      </CardContent>
    </Card>
  );
};
