import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlayCircle, VideoOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExclusiveVideo {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  order_num: number;
}

function VideoEmbed({ video }: { video: ExclusiveVideo }) {
  const [playing, setPlaying] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video w-full relative">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${video.youtube_id}?rel=0&modestbranding=1&autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative group cursor-pointer"
            aria-label={`Reproduzir ${video.title}`}
          >
            <img
              src={`https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
              alt={video.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
              <PlayCircle className="h-16 w-16 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
            </div>
          </button>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{video.title}</CardTitle>
        {video.description && (
          <CardDescription>{video.description}</CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

export default function ConteudosExclusivos() {
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["exclusive-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exclusive_videos")
        .select("*")
        .eq("is_active", true)
        .order("order_num", { ascending: true });

      if (error) {
        console.error("Error fetching videos:", error);
        return [];
      }
      return data as ExclusiveVideo[];
    },
  });

  return (
    <AppLayout title="Conteúdos Exclusivos">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PlayCircle className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Vídeo Aulas</h1>
            <p className="text-muted-foreground">
              Assista às aulas exclusivas diretamente na plataforma
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48 mt-1" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <Card className="p-8 text-center">
            <VideoOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum conteúdo disponível</h3>
            <p className="text-muted-foreground">
              Novos conteúdos serão adicionados em breve.
            </p>
          </Card>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${videos.length > 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            {videos.map((video) => (
              <VideoEmbed key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
