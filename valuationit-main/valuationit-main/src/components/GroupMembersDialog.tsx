import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, X, Search, Loader2 } from "lucide-react";

interface GroupMembersDialogProps {
  group: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

const GroupMembersDialog = ({ group, open, onOpenChange }: GroupMembersDialogProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch current members
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_group_members")
        .select(`
          id,
          user_id,
          profiles:user_id (id, name, email)
        `)
        .eq("group_id", group.id);

      if (error) throw error;
      return data.map((m) => ({
        memberId: m.id,
        ...(m.profiles as unknown as Profile),
      }));
    },
    enabled: open,
  });

  // Search users
  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      toast.error("Digite pelo menos 2 caracteres para buscar");
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      // Filter out already added members
      const memberIds = new Set(members?.map((m) => m.id) || []);
      setSearchResults((data || []).filter((p) => !memberIds.has(p.id)));
    } catch (error) {
      toast.error("Erro ao buscar usuários");
    } finally {
      setIsSearching(false);
    }
  };

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("notification_group_members").insert({
        group_id: group.id,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("Membro adicionado!");
      setSearchResults([]);
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar membro: " + error.message);
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("notification_group_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
      queryClient.invalidateQueries({ queryKey: ["notification-groups"] });
      toast.success("Membro removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover membro: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros: {group.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Section */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Adicionar membro</p>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-md p-2 space-y-1">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded"
                  >
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addMemberMutation.mutate(user.id)}
                      disabled={addMemberMutation.isPending}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Members */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Membros atuais ({members?.length || 0})
            </p>
            <ScrollArea className="h-[300px] border rounded-md">
              {loadingMembers ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members?.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum membro neste grupo
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {members?.map((member) => (
                    <div
                      key={member.memberId}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMemberMutation.mutate(member.memberId)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupMembersDialog;
