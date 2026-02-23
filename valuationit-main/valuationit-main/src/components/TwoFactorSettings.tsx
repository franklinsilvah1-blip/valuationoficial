import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export const TwoFactorSettings = () => {
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  
  // Enrollment state
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Disable state
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (error) {
      console.error("Error loading MFA factors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App"
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setShowSetupDialog(true);
      }
    } catch (error: any) {
      console.error("Error enrolling MFA:", error);
      toast.error(error.message || "Erro ao iniciar configuração 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (verifyCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;

      toast.success("Autenticação de dois fatores ativada com sucesso!");
      setShowSetupDialog(false);
      setQrCode("");
      setSecret("");
      setFactorId("");
      setVerifyCode("");
      loadFactors();
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error(error.message || "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (disableCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos para confirmar");
      return;
    }

    const activeFactor = factors.find(f => f.status === "verified");
    if (!activeFactor) {
      toast.error("Nenhum fator 2FA ativo encontrado");
      return;
    }

    setDisabling(true);
    try {
      // First verify the code
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: activeFactor.id
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: activeFactor.id,
        challengeId: challengeData.id,
        code: disableCode
      });

      if (verifyError) throw verifyError;

      // Then unenroll
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: activeFactor.id
      });

      if (unenrollError) throw unenrollError;

      toast.success("Autenticação de dois fatores desativada");
      setShowDisableDialog(false);
      setDisableCode("");
      loadFactors();
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      toast.error(error.message || "Erro ao desativar 2FA. Verifique o código.");
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const is2FAEnabled = factors.some(f => f.status === "verified");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Autenticação de Dois Fatores (2FA)
          </CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              {is2FAEnabled ? (
                <ShieldCheck className="h-8 w-8 text-green-500" />
              ) : (
                <ShieldOff className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {is2FAEnabled ? "2FA Ativado" : "2FA Desativado"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {is2FAEnabled 
                    ? "Sua conta está protegida com autenticação de dois fatores" 
                    : "Recomendamos ativar para maior segurança"}
                </p>
              </div>
            </div>
            <Badge variant={is2FAEnabled ? "default" : "secondary"} className={cn(
              is2FAEnabled && "bg-green-500 hover:bg-green-600"
            )}>
              {is2FAEnabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>

          {is2FAEnabled ? (
            <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Desativar 2FA
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Desativar Autenticação de Dois Fatores
                  </DialogTitle>
                  <DialogDescription>
                    Isso tornará sua conta menos segura. Digite o código do seu aplicativo autenticador para confirmar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="disable-code">Código de Verificação</Label>
                    <Input
                      id="disable-code"
                      placeholder="000000"
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest"
                    />
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full" 
                    onClick={handleUnenroll}
                    disabled={disabling || disableCode.length !== 6}
                  >
                    {disabling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Desativando...
                      </>
                    ) : (
                      "Confirmar Desativação"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button onClick={handleEnroll} disabled={enrolling} className="w-full">
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Ativar 2FA
                </>
              )}
            </Button>
          )}

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Use aplicativos como Google Authenticator, Authy ou Microsoft Authenticator para gerar códigos de verificação.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => {
        if (!open && factorId) {
          // If closing without verifying, unenroll the pending factor
          supabase.auth.mfa.unenroll({ factorId }).catch(console.error);
        }
        setShowSetupDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Autenticação de Dois Fatores</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu aplicativo autenticador ou insira o código manualmente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                </div>
              </div>
            )}

            {/* Manual Code */}
            <div className="space-y-2">
              <Label>Código Manual</Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este código se não conseguir escanear o QR Code
              </p>
            </div>

            {/* Verification */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Digite o código gerado pelo app</Label>
              <Input
                id="verify-code"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleVerifyEnrollment}
              disabled={verifying || verifyCode.length !== 6}
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar e Ativar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
