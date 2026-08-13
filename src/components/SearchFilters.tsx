import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchFiltersProps {
  onSearch: (filters: { codigo?: string; tipo?: string; setor?: string; nota_especialista?: string }) => void;
  showAllFilters?: boolean;
  isFreeUser?: boolean;
  /** Valor inicial do campo de busca (ex.: pré-preenchido a partir de ?q= na URL). */
  initialValue?: string;
}

const SearchFilters = ({ onSearch, showAllFilters = false, isFreeUser = false, initialValue = "" }: SearchFiltersProps) => {
  const [value, setValue] = useState(initialValue);

  // Mantém o campo sincronizado se o valor inicial mudar externamente
  // (ex.: navegação direta para /mercado?q=... ou refresh da página).
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Campo de busca único para todos os usuários (filtros avançados movidos para grid abaixo)
  return (
    <div className="w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código B3 ou nome do ativo (ex: PETR4, Petrobras)"
          className="pl-9"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onSearch({ codigo: e.target.value });
          }}
        />
      </div>
    </div>
  );
};

export default SearchFilters;
