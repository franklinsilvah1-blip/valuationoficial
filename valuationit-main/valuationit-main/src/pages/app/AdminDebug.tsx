import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle2, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAdminCheck } from "@/hooks/useAdminCheck";

interface AnalysisSample {
  id: string;
  asset_codigo: string;
  asset_nome: string;
  carteira: string;
  valor: number | null;
  perfil_investidor: string | null;
  recomendacao: string | null;
  tendencia: string | null;
  taxa_semanal: number | null;
  roitrim: number | null;
  roi2026: number | null;
  roi2025: number | null;
  roi2024: number | null;
  dy2025: number | null;
  fator_mc: number | null;
  roi2023a2025: number | null;
  nota_especialista: number | null;
}

interface Stats {
  totalAnalyses: number;
  byCarteira: Record<string, number>;
  nullFieldsCounts: Record<string, number>;
  completenessPercentage: number;
}

const AdminDebug = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [samples, setSamples] = useState<AnalysisSample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [cleaningData, setCleaningData] = useState(false);
  const { toast } = useToast();

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "CSV inválido",
          description: "Arquivo deve ter pelo menos header e uma linha de dados",
          variant: "destructive"
        });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const preview = lines.slice(1, 6).map(line => parseCSVLine(line));
      
      setCsvHeaders(headers);
      setCsvPreview(preview);
      
      toast({
        title: "CSV carregado",
        description: `${headers.length} colunas detectadas, mostrando primeiras ${preview.length} linhas`
      });
    };
    
    reader.readAsText(file);
  };

  const cleanEmptyAnalyses = async () => {
    setCleaningData(true);
    try {
      const { error } = await supabase
        .from('asset_analyses')
        .delete()
        .in('carteira', ['PRO', 'SPECIALIST'])
        .is('taxa_semanal', null)
        .is('roi2026', null)
        .is('valor', null);

      if (error) throw error;

      toast({
        title: "Dados limpos",
        description: "Análises vazias de PRO e SPECIALIST foram removidas"
      });
      
      fetchDebugData();
    } catch (error) {
      console.error('Error cleaning data:', error);
      toast({
        title: "Erro ao limpar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setCleaningData(false);
    }
  };

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      // Fetch 10 random analyses with asset info
      const { data: sampleData, error: sampleError } = await supabase
        .from("asset_analyses")
        .select(`
          id,
          carteira,
          valor,
          perfil_investidor,
          recomendacao,
          tendencia,
          taxa_semanal,
          roitrim,
            roi2026,
            roi2025,
            roi2024,
            dy2025,
          fator_mc,
          roi2023a2025,
          nota_especialista,
          assets!inner(codigo_b3, nome)
        `)
        .limit(10);

      if (sampleError) throw sampleError;

      const formattedSamples = sampleData?.map((item: any) => ({
        id: item.id,
        asset_codigo: item.assets.codigo_b3,
        asset_nome: item.assets.nome,
        carteira: item.carteira,
        valor: item.valor,
        perfil_investidor: item.perfil_investidor,
        recomendacao: item.recomendacao,
        tendencia: item.tendencia,
        taxa_semanal: item.taxa_semanal,
        roitrim: item.roitrim,
        roi2026: item.roi2026,
        roi2025: item.roi2025,
        roi2024: item.roi2024,
        dy2025: item.dy2025,
        fator_mc: item.fator_mc,
        roi2023a2025: item.roi2023a2025,
        nota_especialista: item.nota_especialista,
      })) || [];

      setSamples(formattedSamples);

      // Fetch stats
      const { count: totalCount } = await supabase
        .from("asset_analyses")
        .select("*", { count: "exact", head: true });

      const { data: carteiraStats } = await supabase
        .from("asset_analyses")
        .select("carteira");

      const byCarteira: Record<string, number> = {};
      carteiraStats?.forEach((item) => {
        byCarteira[item.carteira] = (byCarteira[item.carteira] || 0) + 1;
      });

      // Calculate null fields
      const fields = [
        "valor", "perfil_investidor", "taxa_semanal", "roitrim",
        "roi2026", "roi2025", "roi2024", "dy2025", "fator_mc", "roi2023a2025", "nota_especialista"
      ];

      const nullFieldsCounts: Record<string, number> = {};
      let totalFields = 0;
      let filledFields = 0;

      for (const field of fields) {
        const { count } = await supabase
          .from("asset_analyses")
          .select("*", { count: "exact", head: true })
          .is(field, null);
        
        nullFieldsCounts[field] = count || 0;
        totalFields += totalCount || 0;
        filledFields += (totalCount || 0) - (count || 0);
      }

      const completenessPercentage = totalFields > 0 
        ? Math.round((filledFields / totalFields) * 100) 
        : 0;

      setStats({
        totalAnalyses: totalCount || 0,
        byCarteira,
        nullFieldsCounts,
        completenessPercentage
      });

      toast({
        title: "Debug atualizado",
        description: "Dados carregados com sucesso",
      });
    } catch (error) {
      console.error("Erro ao carregar debug:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar dados de debug",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  const getFieldValue = (value: any) => {
    if (value === null || value === undefined) {
      return <Badge variant="outline" className="text-red-500">NULL</Badge>;
    }
    return <span className="text-sm">{value}</span>;
  };

  return (
    <AppLayout title="Debug de Importação">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Debug de Importação</h1>
          <p className="text-muted-foreground">Validação de qualidade dos dados importados</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={cleanEmptyAnalyses} disabled={cleaningData} variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Dados Vazios
          </Button>
          <Button onClick={fetchDebugData} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="validator">Validador de CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
          {stats && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de Análises:</span>
                    <span className="font-bold">{stats.totalAnalyses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completude dos Dados:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{stats.completenessPercentage}%</span>
                      {stats.completenessPercentage > 80 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Por Carteira</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(stats.byCarteira).map(([carteira, count]) => (
                    <div key={carteira} className="flex justify-between">
                      <Badge>{carteira}</Badge>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Campos com NULL</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(stats.nullFieldsCounts).map(([field, count]) => (
                    <div key={field} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{field}:</span>
                      <Badge variant={count === 0 ? "default" : "destructive"}>
                        {count}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Sample de 10 Análises</CardTitle>
              <CardDescription>Dados aleatórios para validação manual</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {samples.map((sample) => (
                  <Card key={sample.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="font-semibold">Código:</span> {sample.asset_codigo}
                        </div>
                        <div className="col-span-2">
                          <span className="font-semibold">Nome:</span> {sample.asset_nome}
                        </div>
                        <div>
                          <span className="font-semibold">Carteira:</span> <Badge>{sample.carteira}</Badge>
                        </div>
                        <div>
                          <span className="font-semibold">Valor:</span> {getFieldValue(sample.valor)}
                        </div>
                        <div>
                          <span className="font-semibold">Perfil:</span> {getFieldValue(sample.perfil_investidor)}
                        </div>
                        <div>
                          <span className="font-semibold">Recomendação:</span> {getFieldValue(sample.recomendacao)}
                        </div>
                        <div>
                          <span className="font-semibold">Tendência:</span> {getFieldValue(sample.tendencia)}
                        </div>
                        <div>
                          <span className="font-semibold">Taxa Semanal:</span> {getFieldValue(sample.taxa_semanal)}
                        </div>
                        <div>
                          <span className="font-semibold">ROI TRIM:</span> {getFieldValue(sample.roitrim)}
                        </div>
                        <div>
                          <span className="font-semibold">ROI 2026:</span> {getFieldValue(sample.roi2026)}
                        </div>
                        <div>
                          <span className="font-semibold">ROI 2025:</span> {getFieldValue(sample.roi2025)}
                        </div>
                        <div>
                          <span className="font-semibold">ROI 2024:</span> {getFieldValue(sample.roi2024)}
                        </div>
                        <div>
                          <span className="font-semibold">DY 2025:</span> {getFieldValue(sample.dy2025)}
                        </div>
                        <div>
                          <span className="font-semibold">Fator MC:</span> {getFieldValue(sample.fator_mc)}
                        </div>
                        <div>
                          <span className="font-semibold">ROI 23-25:</span> {getFieldValue(sample.roi2023a2025)}
                        </div>
                        <div>
                          <span className="font-semibold">Nota:</span> {getFieldValue(sample.nota_especialista)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validador de CSV</CardTitle>
              <CardDescription>
                Faça upload de um CSV para validar a estrutura antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="max-w-md"
                />
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>

              {csvPreview && (
                <>
                  <Alert>
                    <AlertDescription>
                      <strong>{csvHeaders.length} colunas detectadas</strong> - Mostrando primeiras {csvPreview.length} linhas
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Headers (Índices)</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {csvHeaders.map((header, idx) => (
                          <div key={idx} className="p-2 bg-muted rounded">
                            <span className="font-mono text-xs text-muted-foreground">[{idx}]</span>{' '}
                            <span className="font-medium">{header}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold mb-2">Preview das Linhas</h3>
                      <div className="space-y-2">
                        {csvPreview.map((row, rowIdx) => (
                          <Card key={rowIdx}>
                            <CardHeader className="py-2">
                              <CardTitle className="text-sm">Linha {rowIdx + 2}</CardTitle>
                            </CardHeader>
                            <CardContent className="py-2">
                              <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                                {row.map((cell, cellIdx) => (
                                  <div key={cellIdx} className="flex gap-2">
                                    <span className="text-muted-foreground min-w-[150px]">
                                      [{cellIdx}] {csvHeaders[cellIdx] || 'Unknown'}:
                                    </span>
                                    <span className={cell ? 'text-foreground' : 'text-destructive'}>
                                      {cell || '(vazio)'}
                                    </span>
                                  </div>
                                ))}
                                {row.length !== csvHeaders.length && (
                                  <div className="text-destructive mt-2">
                                    ⚠️ Contagem de colunas não corresponde: {row.length} valores vs {csvHeaders.length} headers
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default AdminDebug;
