import { Card, CardContent, CardHeader } from "@/components/ui/card";

const AssetCardSkeleton = () => {
  return (
    <Card className="shadow-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-20 bg-muted rounded shimmer" />
            <div className="h-4 w-full bg-muted rounded shimmer" />
          </div>
          <div className="h-5 w-16 bg-muted rounded shimmer" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Setor */}
        <div className="h-4 w-32 bg-muted rounded shimmer" />

        {/* Badge (opcional) */}
        <div className="h-6 w-28 bg-muted rounded-full shimmer" />

        {/* Botão Ver mais */}
        <div className="h-10 w-full bg-muted rounded shimmer mt-4" />

        {/* Espaço para informações adicionais */}
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full bg-muted rounded shimmer" />
          <div className="h-3 w-3/4 bg-muted rounded shimmer" />
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetCardSkeleton;
