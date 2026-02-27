import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { WalletMovement, OperationType } from '@/utils/movementCalculations';

interface CreateMovementData {
  asset_id?: string | null;
  codigo_b3: string;
  tipo_operacao: OperationType;
  valor_por_acao: number;
  quantidade: number;
  data_operacao: string;
  observacao?: string;
}

interface UpdateMovementData extends Partial<CreateMovementData> {
  id: string;
}

export const useWalletMovements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [movements, setMovements] = useState<WalletMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMovements = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallet_movements')
        .select('*')
        .eq('user_id', user.id)
        .order('data_operacao', { ascending: false });

      if (error) throw error;
      
      // Type assertion since the table is new and types may not be generated yet
      setMovements((data as unknown as WalletMovement[]) || []);
    } catch (error: any) {
      console.error('Erro ao buscar movimentações:', error);
      toast({
        title: 'Erro ao carregar movimentações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createMovement = async (data: CreateMovementData): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('wallet_movements')
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          asset_id: data.asset_id,
          codigo_b3: data.codigo_b3.toUpperCase(),
          tipo_operacao: data.tipo_operacao,
          valor_por_acao: data.valor_por_acao,
          quantidade: data.quantidade,
          data_operacao: data.data_operacao,
          observacao: data.observacao || null,
        } as any);

      if (error) throw error;

      toast({
        title: 'Movimentação registrada',
        description: 'A movimentação foi adicionada com sucesso.',
      });

      await fetchMovements();
      return true;
    } catch (error: any) {
      console.error('Erro ao criar movimentação:', error);
      toast({
        title: 'Erro ao registrar movimentação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateMovement = async (data: UpdateMovementData): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const updateData: any = {};
      if (data.codigo_b3) updateData.codigo_b3 = data.codigo_b3.toUpperCase();
      if (data.tipo_operacao) updateData.tipo_operacao = data.tipo_operacao;
      if (data.valor_por_acao !== undefined) updateData.valor_por_acao = data.valor_por_acao;
      if (data.quantidade !== undefined) updateData.quantidade = data.quantidade;
      if (data.data_operacao) updateData.data_operacao = data.data_operacao;
      if (data.observacao !== undefined) updateData.observacao = data.observacao || null;
      if (data.asset_id !== undefined) updateData.asset_id = data.asset_id;

      const { error } = await supabase
        .from('wallet_movements')
        .update(updateData)
        .eq('id', data.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Movimentação atualizada',
        description: 'A movimentação foi atualizada com sucesso.',
      });

      await fetchMovements();
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar movimentação:', error);
      toast({
        title: 'Erro ao atualizar movimentação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteMovement = async (id: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('wallet_movements')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Movimentação excluída',
        description: 'A movimentação foi removida com sucesso.',
      });

      await fetchMovements();
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir movimentação:', error);
      toast({
        title: 'Erro ao excluir movimentação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [user?.id]);

  return {
    movements,
    isLoading,
    fetchMovements,
    createMovement,
    updateMovement,
    deleteMovement,
  };
};
