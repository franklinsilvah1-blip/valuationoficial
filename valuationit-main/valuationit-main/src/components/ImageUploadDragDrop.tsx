import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImageUploadDragDropProps {
  onImageUpload: (url: string) => void;
  currentImage?: string;
  onImageRemove: () => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

export const ImageUploadDragDrop = ({
  onImageUpload,
  currentImage,
  onImageRemove,
  onUploadStart,
  onUploadEnd,
}: ImageUploadDragDropProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Prevenir comportamento padrão de drag/drop em toda a página
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    window.addEventListener('dragover', preventDefaults);
    window.addEventListener('drop', preventDefaults);
    
    return () => {
      window.removeEventListener('dragover', preventDefaults);
      window.removeEventListener('drop', preventDefaults);
    };
  }, []);

  const validateAndUploadFile = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      onUploadStart?.();

      // Validate file type
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Tipo de arquivo inválido. Use JPG, PNG ou WEBP.");
      }

      // Validate file size (5MB)
      if (file.size > 5242880) {
        throw new Error("Arquivo muito grande. Máximo: 5MB.");
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("blog-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("blog-images")
        .getPublicUrl(fileName);

      setPreview(publicUrl);
      onImageUpload(publicUrl);
      
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      onUploadEnd?.();
    }
  }, [onUploadStart, onUploadEnd, onImageUpload, toast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await validateAndUploadFile(files[0]);
    }
  }, [validateAndUploadFile]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (files && files.length > 0) {
      await validateAndUploadFile(files[0]);
      e.target.value = '';
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          await validateAndUploadFile(file);
          break;
        }
      }
    }
  }, []);

  const handleRemove = () => {
    setPreview(null);
    onImageRemove();
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="max-h-64 w-auto rounded-lg object-cover border-2 border-border"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemove();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onClick={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
          className={`
            relative border-2 border-dashed rounded-lg p-8 cursor-pointer
            transition-all duration-200 hover:border-primary hover:bg-accent/5
            ${isDragging ? "border-primary bg-accent/10 scale-105" : "border-border"}
            ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            {isUploading ? (
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            ) : (
              <>
                <div className="rounded-full bg-accent p-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Arraste uma imagem ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou WEBP (máx. 5MB)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Você também pode colar (Ctrl+V) uma imagem
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};