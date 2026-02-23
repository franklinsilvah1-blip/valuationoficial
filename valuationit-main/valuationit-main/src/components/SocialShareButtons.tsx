import { Facebook, Linkedin, Twitter, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SocialShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

const SocialShareButtons = ({ url, title, description }: SocialShareButtonsProps) => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || "");

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.error("Erro ao copiar o link");
    }
  };

  const openShareWindow = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground mr-2">Compartilhar:</span>
      
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]/30"
        onClick={() => openShareWindow(shareLinks.facebook)}
        aria-label="Compartilhar no Facebook"
      >
        <Facebook className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/30"
        onClick={() => openShareWindow(shareLinks.twitter)}
        aria-label="Compartilhar no Twitter"
      >
        <Twitter className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:bg-[#0A66C2]/10 hover:text-[#0A66C2] hover:border-[#0A66C2]/30"
        onClick={() => openShareWindow(shareLinks.linkedin)}
        aria-label="Compartilhar no LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30"
        onClick={() => openShareWindow(shareLinks.whatsapp)}
        aria-label="Compartilhar no WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        onClick={handleCopyLink}
        aria-label="Copiar link"
      >
        <Link2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default SocialShareButtons;
