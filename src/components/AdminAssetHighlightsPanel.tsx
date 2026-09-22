import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Extrai uma mensagem de erro segura de um valor `unknown` (sem usar `any`). */
const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return "Erro desconhecido";
};

const isPostgrestError = (error: unknown): error is PostgrestError =>
  !!error && typeof error === "object" && "code" in error && "message" in error;

interface HighlightRow {
  id: string;
  asset_id: string;
  position: number;
  assets: { codigo_b3: string; nome: string | null } | null;
}

/**
 * Curadoria manual de ativos em destaque.
 *
 * DESATIVADO NA HOME desde a rodada de 2026-09: a seção da home passou a ser
 * "Melhores ativos do ano", calculada automaticamente a partir da base real
 * (os 20 maiores ROI 2026, via get_top_assets_year() no Postgres — ver
 * src/hooks/usePublicMarketAssets.ts). A home NÃO lê mais asset_highlights.
 *
 * O painel e a tabela foram mantidos intactos, sem apagar nenhuma curadoria
 * já cadastrada, para o caso de o cliente querer reativar a seção curada no
 * futuro. Hoje, porém, nada do que for salvo aqui aparece no site.
 */
export const AdminAssetHighlightsPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: highlights, isLoading } = useQuery({
    queryKey: ["admin-asset-highlights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_highlights")
        .select("id, asset_id, position, assets(codigo_b3, nome)")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as HighlightRow[];
    },
  });

  const handleAdd = async () => {
    const codigoTrimmed = codigo.trim().toUpperCase();
    const positionNumber = Number(position);
    if (!codigoTrimmed || !positionNumber || positionNumber < 1 || positionNumber > 20) {
      toast({ title: "Preencha código B3 e uma posição válida (1 a 20)", variant: "destructive" });
      return;
    }
    const isNewEntry = !highlights?.some((h) => h.assets?.codigo_b3 === codigoTrimmed);
    if (isNewEntry && (highlights?.length ?? 0) >= 20) {
      toast({
        title: "Limite de 20 ativos atingido",
        description: "Remova um ativo da curadoria antes de adicionar outro.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .select("id")
        .eq("codigo_b3", codigoTrimmed)
        .maybeSingle();
      if (assetError) throw assetError;
      if (!asset) {
        toast({ title: `Ativo ${codigoTrimmed} não encontrado`, variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("asset_highlights")
        .upsert(
          { asset_id: asset.id, position: positionNumber, created_by: user?.id },
          { onConflict: "asset_id" }
        );
      if (error) {
        // Violação do índice único de posição (dois ativos na mesma posição).
        if (isPostgrestError(error) && error.code === "23505") {
          toast({
            title: `Posição ${positionNumber} já está em uso`,
            description: "Escolha outra posição ou remova o ativo que já a ocupa.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({ title: `${codigoTrimmed} adicionado na posição ${positionNumber}` });
      setCodigo("");
      setPosition("");
      queryClient.invalidateQueries({ queryKey: ["admin-asset-highlights"] });
      queryClient.invalidateQueries({ queryKey: ["home-top-assets"] });
    } catch (error: unknown) {
      toast({ title: "Erro ao salvar", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from("asset_highlights").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-asset-highlights"] });
    queryClient.invalidateQueries({ queryKey: ["home-top-assets"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ativos em Destaque (curadoria manual — inativa)</CardTitle>
        <CardDescription>
          A home agora exibe "Melhores ativos do ano", calculada automaticamente pelos 20 maiores
          ROI 2026 da base. Esta curadoria manual não é mais usada por nenhuma página do site; ela
          segue disponível apenas caso você queira voltar a usar uma seleção manual no futuro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            <strong>Esta lista não aparece mais no site.</strong> Máximo de 20 ativos e uma posição por
            ativo (aplicado pelo banco). Reenviar o mesmo código B3 atualiza a posição existente.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Código B3 (ex: PETR4)" value={codigo} onChange={(e) => setCodigo(e.target.value)} className="sm:w-48" />
          <Input placeholder="Posição (1-20)" type="number" min={1} value={position} onChange={(e) => setPosition(e.target.value)} className="sm:w-32" />
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Adicionar / Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : highlights && highlights.length > 0 ? (
          <div className="space-y-2">
            {highlights.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                <span className="text-sm">
                  <strong>#{h.position}</strong> — {h.assets?.codigo_b3} {h.assets?.nome ? `(${h.assets.nome})` : ""}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(h.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma curadoria definida.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAssetHighlightsPanel;
