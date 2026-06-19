import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, X, ChevronRight, ChevronLeft as ChevronPrev, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const COURTS: Record<string, { name: string; emoji: string; description: string }> = {
  soccer: { name: "Lapangan Mini Soccer", emoji: "⚽", description: "Lapangan mini soccer dengan rumput sintetis premium dan gawang standar." },
  voli: { name: "Lapangan Voli", emoji: "🏐", description: "Lapangan voli standar dengan net profesional dan lantai berkualitas tinggi." },
  basket: { name: "Lapangan Basket", emoji: "🏀", description: "Lapangan basket full court dengan ring standar dan pencahayaan optimal." },
};

interface GalleryImage {
  id: string;
  court_id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

const Gallery = () => {
  const { courtId } = useParams<{ courtId: string }>();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const court = courtId ? COURTS[courtId] : null;

  useEffect(() => {
    if (!courtId) return;
    const fetchImages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("gallery_images")
        .select("*")
        .eq("court_id", courtId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      setImages((data as GalleryImage[]) || []);
      setLoading(false);
    };
    fetchImages();

    const channel = supabase
      .channel(`gallery-${courtId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gallery_images", filter: `court_id=eq.${courtId}` }, () => {
        fetchImages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [courtId]);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const goNext = useCallback(() => setLightboxIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev)), [images.length]);
  const goPrev = useCallback(() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev)), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, closeLightbox, goNext, goPrev]);

  if (!court) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 text-center">
          <p className="text-muted-foreground">Lapangan tidak ditemukan.</p>
          <Link to="/#lapangan" className="text-accent hover:underline mt-4 inline-block">Kembali</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <div className="gradient-hero pt-24 pb-12">
        <div className="container mx-auto px-4">
          <Link to="/#lapangan" className="inline-flex items-center gap-1 text-secondary/70 hover:text-secondary text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Kembali ke Lapangan
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-4xl mb-2 block">{court.emoji}</span>
            <h1 className="text-3xl md:text-5xl font-heading tracking-wider text-secondary">
              GALERI {court.name.replace("Lapangan ", "").toUpperCase()}
            </h1>
            <p className="text-primary-foreground/60 mt-2 max-w-lg">{court.description}</p>
          </motion.div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-heading tracking-wider text-foreground mb-2">BELUM ADA FOTO</h3>
            <p className="text-muted-foreground text-sm">Foto galeri untuk lapangan ini belum tersedia.</p>
          </motion.div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4 space-y-3 md:space-y-4">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="break-inside-avoid group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <div className="relative rounded-xl overflow-hidden bg-muted border border-border hover:border-accent/50 shadow-sm hover:shadow-xl transition-all duration-500">
                  <img
                    src={img.image_url}
                    alt={img.caption || court.name}
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-sm font-medium">{img.caption}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Other Courts */}
      <div className="container mx-auto px-4 pb-12">
        <h3 className="text-xl font-heading tracking-wider text-foreground mb-4">GALERI LAPANGAN LAIN</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(COURTS)
            .filter(([id]) => id !== courtId)
            .map(([id, c]) => (
              <Link
                key={id}
                to={`/galeri/${id}`}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-card border border-border hover:border-accent/50 hover:shadow-md transition-all text-sm font-semibold text-foreground"
              >
                <span className="text-lg">{c.emoji}</span>
                {c.name.replace("Lapangan ", "")}
              </Link>
            ))}
        </div>
      </div>

      <Footer />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && images[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <button onClick={closeLightbox} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>

            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-3 md:left-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronPrev className="w-6 h-6 text-white" />
              </button>
            )}

            {lightboxIndex < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-3 md:right-6 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}

            <motion.img
              key={images[lightboxIndex].id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={images[lightboxIndex].image_url}
              alt={images[lightboxIndex].caption || "Gallery"}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {images[lightboxIndex].caption && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl">
                <p className="text-white text-sm text-center">{images[lightboxIndex].caption}</p>
              </div>
            )}

            <div className="absolute bottom-6 right-6 text-white/50 text-sm">
              {lightboxIndex + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
