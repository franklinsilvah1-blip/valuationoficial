// Tipos de operação disponíveis
export const OPERATION_TYPES = [
  { value: 'COMPRA', label: 'Compra', color: 'text-red-600' },
  { value: 'VENDA', label: 'Venda', color: 'text-green-600' },
  { value: 'GANHOS_JCP', label: 'JCP', color: 'text-blue-600' },
  { value: 'GANHOS_RC', label: 'Restituição Capital', color: 'text-purple-600' },
  { value: 'GANHOS_DY', label: 'Dividendos', color: 'text-emerald-600' },
  { value: 'GANHOS_BA', label: 'Bonificação', color: 'text-amber-600' },
] as const;

export type OperationType = typeof OPERATION_TYPES[number]['value'];

// Calcula o total da movimentação (valor × quantidade)
export const calcularTotalMovimentacao = (valorPorAcao: number, quantidade: number): number => {
  return valorPorAcao * quantidade;
};

// Calcula o saldo da movimentação (negativo para compras, positivo para vendas/ganhos)
export const calcularSaldoMovimentacao = (tipo: OperationType, total: number): number => {
  return tipo === 'COMPRA' ? -total : total;
};

// Retorna o label amigável do tipo de operação
export const getOperationLabel = (tipo: OperationType): string => {
  return OPERATION_TYPES.find(op => op.value === tipo)?.label || tipo;
};

// Retorna a classe de cor do tipo de operação
export const getOperationColor = (tipo: OperationType): string => {
  return OPERATION_TYPES.find(op => op.value === tipo)?.color || 'text-foreground';
};

// Verifica se é uma operação de ganho (proventos)
export const isGanhoOperation = (tipo: OperationType): boolean => {
  return tipo.startsWith('GANHOS_');
};

// Formata valor monetário para exibição
export const formatCurrencyBR = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Formata saldo com sinal e cor
export const formatSaldoDisplay = (saldo: number): { text: string; className: string } => {
  const formatted = formatCurrencyBR(Math.abs(saldo));
  // Usando NBSP (\u00A0) para evitar quebra de linha entre "R$" e o número
  if (saldo < 0) {
    return { text: `-R$\u00A0${formatted}`, className: 'text-red-600' };
  } else if (saldo > 0) {
    return { text: `+R$\u00A0${formatted}`, className: 'text-green-600' };
  }
  return { text: `R$\u00A0${formatted}`, className: 'text-foreground' };
};

// Interface para movimentação
export interface WalletMovement {
  id: string;
  user_id: string;
  asset_id?: string | null;
  codigo_b3: string;
  tipo_operacao: OperationType;
  valor_por_acao: number;
  quantidade: number;
  data_operacao: string;
  observacao?: string | null;
  created_at: string;
}

// Calcula totais agregados
export interface MovementTotals {
  totalMovimentacoes: number;
  totalCompras: number;
  totalVendas: number;
  totalProventos: number;
  saldoGeral: number;
  quantidadeRegistros: number;
}

export const calcularTotais = (movements: WalletMovement[]): MovementTotals => {
  return movements.reduce(
    (acc, mov) => {
      const total = calcularTotalMovimentacao(Number(mov.valor_por_acao), mov.quantidade);
      const saldo = calcularSaldoMovimentacao(mov.tipo_operacao, total);

      acc.totalMovimentacoes += total;
      acc.saldoGeral += saldo;
      acc.quantidadeRegistros += 1;

      if (mov.tipo_operacao === 'COMPRA') {
        acc.totalCompras += total;
      } else if (mov.tipo_operacao === 'VENDA') {
        acc.totalVendas += total;
      } else if (isGanhoOperation(mov.tipo_operacao)) {
        acc.totalProventos += total;
      }

      return acc;
    },
    {
      totalMovimentacoes: 0,
      totalCompras: 0,
      totalVendas: 0,
      totalProventos: 0,
      saldoGeral: 0,
      quantidadeRegistros: 0,
    }
  );
};

// Interface para preço médio por ativo
export interface PrecoMedioPorAtivo {
  codigo_b3: string;
  totalInvestido: number;
  quantidadeTotal: number;
  precoMedio: number;
}

// Calcula preço médio de compra por ativo
export const calcularPrecoMedioPorAtivo = (movements: WalletMovement[]): PrecoMedioPorAtivo[] => {
  const compras = movements.filter(m => m.tipo_operacao === 'COMPRA');
  
  const porAtivo: Record<string, { totalInvestido: number; quantidadeTotal: number }> = {};
  
  compras.forEach(mov => {
    const codigo = mov.codigo_b3;
    if (!porAtivo[codigo]) {
      porAtivo[codigo] = { totalInvestido: 0, quantidadeTotal: 0 };
    }
    porAtivo[codigo].totalInvestido += Number(mov.valor_por_acao) * mov.quantidade;
    porAtivo[codigo].quantidadeTotal += mov.quantidade;
  });
  
  return Object.entries(porAtivo)
    .map(([codigo, dados]) => ({
      codigo_b3: codigo,
      totalInvestido: dados.totalInvestido,
      quantidadeTotal: dados.quantidadeTotal,
      precoMedio: dados.quantidadeTotal > 0 ? dados.totalInvestido / dados.quantidadeTotal : 0
    }))
    .sort((a, b) => a.codigo_b3.localeCompare(b.codigo_b3));
};
