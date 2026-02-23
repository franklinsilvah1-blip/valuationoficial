export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  
  // Converter string para número se necessário (banco pode retornar numeric como string)
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return "-";
  
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return "-";
  
  return `${numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

export const formatNumber = (value: number | string | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined) return "-";
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return "-";
  
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
