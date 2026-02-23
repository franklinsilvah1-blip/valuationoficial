import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Plus, Trash2, Edit2, Filter, TrendingUp, TrendingDown, 
  DollarSign, Receipt, Wallet, X, Save, Calendar as CalendarIcon,
  HelpCircle
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWalletMovements } from "@/hooks/useWalletMovements";
import { 
  OPERATION_TYPES, 
  OperationType,
  calcularTotalMovimentacao,
  calcularSaldoMovimentacao,
  calcularTotais,
  getOperationLabel,
  getOperationColor,
  formatCurrencyBR,
  formatSaldoDisplay,
  WalletMovement
} from "@/utils/movementCalculations";
import { cn } from "@/lib/utils";


interface MovementFormData {
  codigo_b3: string;
  tipo_operacao: OperationType;
  valor_por_acao: string;
  quantidade: string;
  data_operacao: Date;
  observacao: string;
}

const initialFormData: MovementFormData = {
  codigo_b3: "",
  tipo_operacao: "COMPRA",
  valor_por_acao: "",
  quantidade: "",
  data_operacao: new Date(),
  observacao: "",
};

const RMC = () => {
  const { movements, isLoading, createMovement, updateMovement, deleteMovement } = useWalletMovements();
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MovementFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter states
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterDataInicio, setFilterDataInicio] = useState<Date | undefined>();
  const [filterDataFim, setFilterDataFim] = useState<Date | undefined>();

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (filterCodigo && !mov.codigo_b3.toLowerCase().includes(filterCodigo.toLowerCase())) {
        return false;
      }
      if (filterTipo !== "all" && mov.tipo_operacao !== filterTipo) {
        return false;
      }
      if (filterDataInicio) {
        const movDate = new Date(mov.data_operacao);
        if (movDate < filterDataInicio) return false;
      }
      if (filterDataFim) {
        const movDate = new Date(mov.data_operacao);
        if (movDate > filterDataFim) return false;
      }
      return true;
    });
  }, [movements, filterCodigo, filterTipo, filterDataInicio, filterDataFim]);

  // Calculate totals
  const totals = useMemo(() => calcularTotais(filteredMovements), [filteredMovements]);

  const handleOpenCreate = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (movement: WalletMovement) => {
    setFormData({
      codigo_b3: movement.codigo_b3,
      tipo_operacao: movement.tipo_operacao,
      valor_por_acao: String(movement.valor_por_acao),
      quantidade: String(movement.quantidade),
      data_operacao: new Date(movement.data_operacao),
      observacao: movement.observacao || "",
    });
    setEditingId(movement.id);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.codigo_b3 || !formData.valor_por_acao || !formData.quantidade) {
      return;
    }

    setIsSubmitting(true);

    const data = {
      codigo_b3: formData.codigo_b3.toUpperCase(),
      tipo_operacao: formData.tipo_operacao,
      valor_por_acao: parseFloat(formData.valor_por_acao),
      quantidade: parseInt(formData.quantidade),
      data_operacao: format(formData.data_operacao, "yyyy-MM-dd"),
      observacao: formData.observacao || undefined,
    };

    let success = false;
    if (editingId) {
      success = await updateMovement({ id: editingId, ...data });
    } else {
      success = await createMovement(data);
    }

    if (success) {
      setIsFormOpen(false);
      setFormData(initialFormData);
      setEditingId(null);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMovement(deleteId);
      setDeleteId(null);
    }
  };

  const clearFilters = () => {
    setFilterCodigo("");
    setFilterTipo("all");
    setFilterDataInicio(undefined);
    setFilterDataFim(undefined);
  };

  const hasFilters = filterCodigo || filterTipo !== "all" || filterDataInicio || filterDataFim;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Registros de Movimentações</h1>
            <p className="text-muted-foreground">Acompanhe suas compras, vendas e proventos</p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Total Registros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.quantidadeRegistros}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Total Compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 whitespace-nowrap tabular-nums">
                -R${"\u00A0"}{formatCurrencyBR(totals.totalCompras)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Total Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 whitespace-nowrap tabular-nums">
                +R${"\u00A0"}{formatCurrencyBR(totals.totalVendas)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Total Proventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600 whitespace-nowrap tabular-nums">
                +R${"\u00A0"}{formatCurrencyBR(totals.totalProventos)}
              </p>
            </CardContent>
          </Card>

          {/* Card de Saldo Geral - ocupa largura total no mobile */}
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Saldo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const { text, className } = formatSaldoDisplay(totals.saldoGeral);
                return <p className={cn("text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap tabular-nums", className)}>{text}</p>;
              })()}
            </CardContent>
          </Card>
        </div>


        {/* Filters */}
        <Card>
          <CardContent className="pt-4 md:pt-6 space-y-4">
            {/* Linha 1: Código B3 */}
            <div>
              <Label htmlFor="filterCodigo" className="text-sm">Código B3</Label>
              <Input
                id="filterCodigo"
                placeholder="Ex: PETR4"
                value={filterCodigo}
                onChange={(e) => setFilterCodigo(e.target.value)}
              />
            </div>

            {/* Linha 2: Tipo de Operação como botões toggle */}
            <div>
              <Label className="text-sm mb-2 block">Tipo de Operação</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterTipo === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterTipo("all")}
                  className="text-xs sm:text-sm"
                >
                  Todos
                </Button>
                {OPERATION_TYPES.map((op) => (
                  <Button
                    key={op.value}
                    variant={filterTipo === op.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterTipo(op.value)}
                    className="text-xs sm:text-sm"
                  >
                    {op.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Linha 3: Datas lado a lado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs sm:text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {filterDataInicio ? format(filterDataInicio, "dd/MM/yyyy") : "Selecionar"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDataInicio}
                      onSelect={setFilterDataInicio}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-xs sm:text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {filterDataFim ? format(filterDataFim, "dd/MM/yyyy") : "Selecionar"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDataFim}
                      onSelect={setFilterDataFim}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Linha 4: Botão Limpar (só aparece quando há filtros) */}
            {hasFilters && (
              <Button 
                variant="ghost" 
                onClick={clearFilters} 
                className="w-full justify-center gap-2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Movements Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>COD B3</TableHead>
                    <TableHead>TIPO OPERAÇÃO</TableHead>
                    <TableHead className="text-right">VALOR/AÇÃO</TableHead>
                    <TableHead className="text-right">QTDE</TableHead>
                    <TableHead className="text-right">TOTAL</TableHead>
                    <TableHead className="text-right">SALDO</TableHead>
                    <TableHead>DATA</TableHead>
                    <TableHead className="text-center">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhuma movimentação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMovements.map((mov) => {
                      const total = calcularTotalMovimentacao(Number(mov.valor_por_acao), mov.quantidade);
                      const saldo = calcularSaldoMovimentacao(mov.tipo_operacao, total);
                      const saldoDisplay = formatSaldoDisplay(saldo);

                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="font-medium">{mov.codigo_b3}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("font-medium", getOperationColor(mov.tipo_operacao))}>
                              {getOperationLabel(mov.tipo_operacao)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">R$ {formatCurrencyBR(Number(mov.valor_por_acao))}</TableCell>
                          <TableCell className="text-right">{mov.quantidade}</TableCell>
                          <TableCell className="text-right">R$ {formatCurrencyBR(total)}</TableCell>
                          <TableCell className={cn("text-right font-medium", saldoDisplay.className)}>
                            {saldoDisplay.text}
                          </TableCell>
                          <TableCell>{format(new Date(mov.data_operacao), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(mov)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(mov.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {filteredMovements.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>TOTAIS</TableCell>
                      <TableCell>{totals.quantidadeRegistros}</TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totalQtd = filteredMovements.reduce((sum, m) => sum + m.quantidade, 0);
                          const valorMedio = totalQtd > 0 ? Math.abs(totals.saldoGeral) / totalQtd : 0;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex items-center gap-1">
                                  R$ {formatCurrencyBR(valorMedio)}
                                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-semibold mb-1">Valor Médio</p>
                                <p className="text-xs text-muted-foreground">
                                  ABS(Saldo Geral) ÷ Quantidade Total
                                </p>
                                <p className="text-xs mt-1">
                                  ABS(R$ {formatCurrencyBR(totals.saldoGeral)}) ÷ {totalQtd} = R$ {formatCurrencyBR(valorMedio)}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {filteredMovements.reduce((sum, m) => sum + m.quantidade, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {formatCurrencyBR(totals.totalMovimentacoes)}
                      </TableCell>
                      <TableCell className={cn("text-right", formatSaldoDisplay(totals.saldoGeral).className)}>
                        {formatSaldoDisplay(totals.saldoGeral).text}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Movimentação" : "Nova Movimentação"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da movimentação abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="codigo_b3">Código B3 *</Label>
                <Input
                  id="codigo_b3"
                  placeholder="Ex: PETR4"
                  value={formData.codigo_b3}
                  onChange={(e) => setFormData({ ...formData, codigo_b3: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="tipo_operacao">Tipo de Operação *</Label>
                <Select
                  value={formData.tipo_operacao}
                  onValueChange={(value: OperationType) => setFormData({ ...formData, tipo_operacao: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPES.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="valor_por_acao">Valor por Ação (R$) *</Label>
                <Input
                  id="valor_por_acao"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={formData.valor_por_acao}
                  onChange={(e) => setFormData({ ...formData, valor_por_acao: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Data da Operação *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.data_operacao, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.data_operacao}
                    onSelect={(date) => date && setFormData({ ...formData, data_operacao: date })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                placeholder="Notas adicionais (opcional)"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                rows={3}
              />
            </div>
            {/* Preview */}
            {formData.valor_por_acao && formData.quantidade && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Total da Movimentação:</span>
                  <span className="font-bold">
                    R$ {formatCurrencyBR(
                      calcularTotalMovimentacao(
                        parseFloat(formData.valor_por_acao) || 0,
                        parseInt(formData.quantidade) || 0
                      )
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Impacto no Saldo:</span>
                  {(() => {
                    const total = calcularTotalMovimentacao(
                      parseFloat(formData.valor_por_acao) || 0,
                      parseInt(formData.quantidade) || 0
                    );
                    const saldo = calcularSaldoMovimentacao(formData.tipo_operacao, total);
                    const display = formatSaldoDisplay(saldo);
                    return <span className={cn("font-bold", display.className)}>{display.text}</span>;
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default RMC;
