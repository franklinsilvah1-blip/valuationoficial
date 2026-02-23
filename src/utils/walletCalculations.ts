export interface WalletItem {
  id: string;
  asset_id: string;
  codigo_b3: string;
  nome: string;
  tipo: string;
  setor: string;
  quantidade: number;
  preco_compra: number;
  aporte_adicional: number;
  preco_atual: number;
  roitrim: number;
  dy2025?: number;
  roi2025?: number;
  proventos: number; // Proventos por ação
}

export interface CalculatedItem extends WalletItem {
  pm: number;
  valor_investido: number;
  valor_atual: number;
  resultado: number;
  resultado_percentual: number;
  roi_reais: number;
  dy_mensal_reais: number;
  dy_trimestral_reais: number;
  dy_anual_reais: number;
  percentual_carteira: number;
  proventos_totais: number; // Proventos × Quantidade
}

export interface CalculatedItemReal extends WalletItem {
  valor_investido: number;
  valor_atual_total: number;
  roi_percentual_real: number;
  roi_reais_real: number;
  resultado_real: number;
  percentual_carteira: number;
  proventos_totais: number; // Proventos × Quantidade
  resultado_com_proventos: number; // Resultado + Proventos
  roi_com_proventos_percentual: number; // ROI incluindo proventos
  roi_com_proventos_reais: number; // ROI em R$ incluindo proventos
}

export interface WalletTotals {
  total_investido: number;
  total_atual: number;
  resultado_total: number;
  resultado_percentual: number;
  roi_medio_carteira: number;
  dy_total_mensal: number;
  dy_total_trimestral: number;
  dy_total_anual: number;
  proventos_total: number;
}

// Fórmula da planilha: PM = (preço_compra × quantidade + aporte_adicional) / quantidade
export const calcularPM = (
  preco_compra: number,
  quantidade: number,
  aporte_adicional: number = 0
): number => {
  return (preco_compra * quantidade + aporte_adicional) / quantidade;
};

// Valor Investido = Preço Compra × Quantidade + Aporte Adicional
export const calcularValorInvestido = (
  preco_compra: number,
  quantidade: number,
  aporte_adicional: number = 0
): number => {
  return preco_compra * quantidade + aporte_adicional;
};

// Valor Atual = Preço Atual × Quantidade
export const calcularValorAtual = (
  preco_atual: number,
  quantidade: number
): number => {
  return preco_atual * quantidade;
};

// Resultado = Valor Atual - Valor Investido
export const calcularResultado = (
  valor_atual: number,
  valor_investido: number
): number => {
  return valor_atual - valor_investido;
};

// Resultado % = (Valor Atual - Valor Investido) / Valor Investido × 100
export const calcularResultadoPercentual = (
  valor_atual: number,
  valor_investido: number
): number => {
  if (valor_investido === 0) return 0;
  return ((valor_atual - valor_investido) / valor_investido) * 100;
};

// ROI em Reais (da planilha) = Valor Investido × ROI TRIM (%)
export const calcularROIReais = (
  valor_investido: number,
  roitrim: number
): number => {
  return valor_investido * (roitrim / 100);
};

// DY em Reais = Valor Atual × DY (%)
export const calcularDYReais = (
  valor_atual: number,
  dy_percentual: number
): number => {
  return valor_atual * (dy_percentual / 100);
};

// Calcular item completo com todas as fórmulas
export const calcularItem = (
  item: WalletItem,
  total_investido_carteira: number
): CalculatedItem => {
  const pm = calcularPM(item.preco_compra, item.quantidade, item.aporte_adicional);
  const valor_investido = calcularValorInvestido(item.preco_compra, item.quantidade, item.aporte_adicional);
  const valor_atual = calcularValorAtual(item.preco_atual, item.quantidade);
  const resultado = calcularResultado(valor_atual, valor_investido);
  const resultado_percentual = calcularResultadoPercentual(valor_atual, valor_investido);
  const roi_reais = calcularROIReais(valor_investido, item.roitrim || 0);
  
  // DY em diferentes períodos
  const dy_anual = item.roi2025 || item.dy2025 || 0;
  const dy_anual_reais = calcularDYReais(valor_atual, dy_anual);
  const dy_mensal_reais = dy_anual_reais / 12;
  const dy_trimestral_reais = dy_anual_reais / 4;
  
  // Proventos totais
  const proventos_totais = (item.proventos || 0) * item.quantidade;
  
  const percentual_carteira = total_investido_carteira > 0 
    ? (valor_investido / total_investido_carteira) * 100 
    : 0;

  return {
    ...item,
    pm,
    valor_investido,
    valor_atual,
    resultado,
    resultado_percentual,
    roi_reais,
    dy_mensal_reais,
    dy_trimestral_reais,
    dy_anual_reais,
    percentual_carteira,
    proventos_totais,
  };
};

// ROI % baseado no preço atual (Ganho Real)
export const calcularROIPercentualReal = (
  preco_atual: number,
  quantidade: number,
  valor_investido: number
): number => {
  if (valor_investido === 0) return 0;
  const valor_atual_total = preco_atual * quantidade;
  return ((valor_atual_total - valor_investido) / valor_investido) * 100;
};

// ROI em Reais baseado no preço atual (Ganho Real)
export const calcularROIReaisReal = (
  preco_atual: number,
  quantidade: number,
  valor_investido: number
): number => {
  const valor_atual_total = preco_atual * quantidade;
  return valor_atual_total - valor_investido;
};

// Resultado = Valor Atual Total (Ganho Real)
export const calcularResultadoReal = (
  preco_atual: number,
  quantidade: number
): number => {
  return preco_atual * quantidade;
};

// Calcular item completo com ganho real
export const calcularItemReal = (
  item: WalletItem,
  total_investido_carteira: number
): CalculatedItemReal => {
  const valor_investido = calcularValorInvestido(item.preco_compra, item.quantidade, item.aporte_adicional);
  const valor_atual_total = calcularResultadoReal(item.preco_atual, item.quantidade);
  const roi_percentual_real = calcularROIPercentualReal(item.preco_atual, item.quantidade, valor_investido);
  const roi_reais_real = calcularROIReaisReal(item.preco_atual, item.quantidade, valor_investido);
  const resultado_real = valor_atual_total;
  
  // Proventos totais
  const proventos_totais = (item.proventos || 0) * item.quantidade;
  const resultado_com_proventos = valor_atual_total + proventos_totais;
  const roi_com_proventos_reais = roi_reais_real + proventos_totais;
  const roi_com_proventos_percentual = valor_investido > 0 
    ? (roi_com_proventos_reais / valor_investido) * 100 
    : 0;
  
  const percentual_carteira = total_investido_carteira > 0 
    ? (valor_investido / total_investido_carteira) * 100 
    : 0;

  return {
    ...item,
    valor_investido,
    valor_atual_total,
    roi_percentual_real,
    roi_reais_real,
    resultado_real,
    percentual_carteira,
    proventos_totais,
    resultado_com_proventos,
    roi_com_proventos_percentual,
    roi_com_proventos_reais,
  };
};

// Calcular totais da carteira
export const calcularTotaisCarteira = (items: CalculatedItem[]): WalletTotals => {
  const total_investido = items.reduce((sum, item) => sum + item.valor_investido, 0);
  const total_atual = items.reduce((sum, item) => sum + item.valor_atual, 0);
  const resultado_total = total_atual - total_investido;
  const resultado_percentual = total_investido > 0 
    ? (resultado_total / total_investido) * 100 
    : 0;
  
  // ROI médio ponderado da carteira (como na planilha)
  const roi_medio_carteira = total_investido > 0
    ? items.reduce((sum, item) => {
        const peso = item.valor_investido / total_investido;
        return sum + (item.roitrim || 0) * peso;
      }, 0)
    : 0;
  
  const dy_total_mensal = items.reduce((sum, item) => sum + item.dy_mensal_reais, 0);
  const dy_total_trimestral = items.reduce((sum, item) => sum + item.dy_trimestral_reais, 0);
  const dy_total_anual = items.reduce((sum, item) => sum + item.dy_anual_reais, 0);
  const proventos_total = items.reduce((sum, item) => sum + item.proventos_totais, 0);

  return {
    total_investido,
    total_atual,
    resultado_total,
    resultado_percentual,
    roi_medio_carteira,
    dy_total_mensal,
    dy_total_trimestral,
    dy_total_anual,
    proventos_total,
  };
};

// Calcular totais da carteira com ganho real
export const calcularTotaisCarteiraReal = (items: CalculatedItemReal[]): {
  total_investido: number;
  valor_atual_total: number;
  roi_percentual_medio: number;
  roi_reais_total: number;
  resultado_total: number;
  proventos_total: number;
  resultado_com_proventos_total: number;
  roi_com_proventos_percentual: number;
  roi_com_proventos_reais: number;
} => {
  const total_investido = items.reduce((sum, item) => sum + item.valor_investido, 0);
  const resultado_total = items.reduce((sum, item) => sum + item.resultado_real, 0);
  const roi_reais_total = resultado_total - total_investido;
  const roi_percentual_medio = total_investido > 0 
    ? (roi_reais_total / total_investido) * 100 
    : 0;
  
  // Totais com proventos
  const proventos_total = items.reduce((sum, item) => sum + item.proventos_totais, 0);
  const resultado_com_proventos_total = resultado_total + proventos_total;
  const roi_com_proventos_reais = roi_reais_total + proventos_total;
  const roi_com_proventos_percentual = total_investido > 0 
    ? (roi_com_proventos_reais / total_investido) * 100 
    : 0;

  return {
    total_investido,
    valor_atual_total: resultado_total,
    roi_percentual_medio,
    roi_reais_total,
    resultado_total,
    proventos_total,
    resultado_com_proventos_total,
    roi_com_proventos_percentual,
    roi_com_proventos_reais,
  };
};
