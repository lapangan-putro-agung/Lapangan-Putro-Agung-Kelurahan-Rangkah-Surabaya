import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Trash2, ImageIcon, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const COURTS = [
  { id: "soccer", label: "⚽ Mini Soccer" },
  { id: "voli", label: "🏐 Voli" },
  { id: "basket", label: "🏀 Basket" },
];

interface GalleryImage {
  id: string;
  court_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

const AdminGalleryTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCourt, setSelectedCourt] = useState("soccer");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gallery_images")
      .select("*")
      .eq("court_id", selectedCourt)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    setImages((data as GalleryImage[]) || []);
    setLoading(false);
  }, [selectedCourt]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop();
        const fileName = `${selectedCourt}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("gallery")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("gallery").getPublicUrl(fileName);

        const { error: insertError } = await supabase.from("gallery_images").insert({
          court_id: selectedCourt,
          image_url: urlData.publicUrl,
          caption: caption || null,
          display_order: images.length + successCount,
        });

        if (insertError) throw insertError;
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Terjadi kesalahan";
        toast({ title: "Upload gagal", description: message, variant: "destructive" });
      }
    }

    if (successCount > 0) {
      toast({ title: `${successCount} foto berhasil diupload` });
      setCaption("");
      fetchImages();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (img: GalleryImage) => {
    setDeletingId(img.id);
    try {
      // Extract path from URL
      const url = new URL(img.image_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/gallery/");
      if (pathParts[1]) {
        await supabase.storage.from("gallery").remove([decodeURIComponent(pathParts[1])]);
      }

      const { error } = await supabase.from("gallery_images").delete().eq("id", img.id);
      if (error) throw error;

      setImages((prev) => prev.filter((i) => i.id !== img.id));
      toast({ title: "Foto berhasil dihapus" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast({ title: "Gagal menghapus", description: message, variant: "destructive" });
    }
    setDeletingId(null);
  };

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-heading tracking-wider text-foreground mb-6">
        GALERI FOTO
      </h2>

      {/* Court Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {COURTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCourt(c.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedCourt === c.id
                ? "bg-primary text-secondary shadow-lg"
                : "bg-card text-foreground border border-border hover:border-accent/50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Upload Section */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-sm mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-accent" /> Upload Foto Baru
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Keterangan foto (opsional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <div
          className="relative border-2 border-dashed border-border hover:border-accent/50 rounded-2xl p-8 text-center cursor-pointer transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-sm text-muted-foreground">Mengupload foto...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Klik untuk upload foto</p>
              <p className="text-xs text-muted-foreground">Bisa pilih banyak file sekaligus • JPG, PNG, WebP</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Images Grid */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-accent" />
          Foto Tersimpan
          <span className="ml-auto text-sm text-muted-foreground font-normal">{images.length} foto</span>
        </h3>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Belum ada foto untuk lapangan ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <AnimatePresence>
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border"
                >
                  <img
                    src={img.image_url}
                    alt={img.caption || "Gallery"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-xs">{img.caption}</p>
                    </div>
                  )}

                  <button
                    onClick={() => handleDelete(img)}
                    disabled={deletingId === img.id}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    {deletingId === img.id ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGalleryTab;
