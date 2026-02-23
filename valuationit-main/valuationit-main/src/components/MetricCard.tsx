import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function MetricCard({ title, value, icon: Icon, iconColor, trend }: MetricCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-foreground">{value}</h3>
            {trend && (
              <p className={cn(
                "text-xs mt-1",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.value}
              </p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-lg",
            iconColor || "bg-blue-100"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              iconColor ? "text-white" : "text-blue-600"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
