import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, AlertCircle, ChevronLeft, Users, Wifi, Car, Droplets, ShieldCheck, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfDay } from "date-fns";
import { id } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/hero-field.jpg";
import sportVoli from "@/assets/sport-voli.jpg";
import sportBasket from "@/assets/sport-basket.jpg";
import sportSoccer from "@/assets/sport-soccer.jpg";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PaymentLoadingOverlay from "@/components/PaymentLoadingOverlay";

const COURTS = [
  { id: "soccer", name: "Lapangan Mini Soccer", label: "Mini Soccer", emoji: "⚽", image: sportSoccer, type: "Outdoor", surface: "Rumput Sintetis", capacity: "14 Pemain", description: "Lapangan mini soccer dengan rumput sintetis premium dan gawang standar." },
  { id: "voli", name: "Lapangan Voli", label: "Voli", emoji: "🏐", image: sportVoli, type: "Indoor", surface: "Lantai Profesional", capacity: "12 Pemain", description: "Lapangan voli standar dengan net profesional dan lantai berkualitas tinggi." },
  { id: "basket", name: "Lapangan Basket", label: "Basket", emoji: "🏀", image: sportBasket, type: "Indoor", surface: "Hardcourt", capacity: "10 Pemain", description: "Lapangan basket full court dengan ring standar dan pencahayaan optimal." },
];

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const hour = 7 + i;
  return {
    start: `${hour.toString().padStart(2, "0")}:00`,
    end: `${(hour + 1).toString().padStart(2, "0")}:00`,
    label: `${hour.toString().padStart(2, "0")}:00 - ${(hour + 1).toString().padStart(2, "0")}:00`,
  };
});

const FACILITIES = [
  { icon: Car, label: "Parkir Motor" },
  { icon: Car, label: "Parkir Mobil" },
  { icon: Droplets, label: "Air Minum" },
  { icon: Wifi, label: "Free WiFi" },
  { icon: ShieldCheck, label: "Keamanan" },
  { icon: Users, label: "Musholla" },
];

const Booking = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showSOP, setShowSOP] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<Record<string, Set<string>>>({});
  const [bookingCounts, setBookingCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const dates = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(today, i));
  }, []);

  // Fetch booked slots per court for selected date
  useEffect(() => {
    const fetchBookedSlots = async () => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data } = await supabase
        .from("bookings")
        .select("court_id, time_slot")
        .eq("booking_date", dateStr)
        .neq("payment_status", "failed")
        .neq("payment_status", "expired");

      const slots: Record<string, Set<string>> = {};
      const counts: Record<string, number> = {};
      (data || []).forEach((b: any) => {
        if (!slots[b.court_id]) slots[b.court_id] = new Set();
        slots[b.court_id].add(b.time_slot);
        counts[b.court_id] = (counts[b.court_id] || 0) + 1;
      });
      setBookedSlots(slots);
      setBookingCounts(counts);
    };
    fetchBookedSlots();
  }, [selectedDate, showSOP]);

  const getCourtDayCount = (courtId: string) => bookingCounts[courtId] || 0;
  const isCourtFull = (courtId: string) => getCourtDayCount(courtId) >= 3;
  const isSlotBooked = (courtId: string, timeSlot: string) => bookedSlots[courtId]?.has(timeSlot) || false;
  const getAvailableCount = (courtId: string) => {
    const booked = bookedSlots[courtId]?.size || 0;
    if (isCourtFull(courtId)) return 0;
    return TIME_SLOTS.length - booked;
  };

  const handleBooking = (courtId: string) => {
    if (!user)
    {
      toast({ title: "Login dulu", description: "Silakan login untuk melakukan booking.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (!selectedTime) return;
    setSelectedCourtId(courtId);
    setShowPayment(true);
  };

  const handlePayment = async () => {
    if (!user || !selectedCourtId || !selectedTime) return;
    setSubmitting(true);

    try
    {
      // 1. Create booking record first
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
          court_id: selectedCourtId,
          booking_date: format(selectedDate, "yyyy-MM-dd"),
          time_slot: selectedTime,
          amount: 200000,
          payment_status: "pending",
        })
        .select()
        .single();

      if (bookingError || !booking)
      {
        throw new Error(bookingError?.message || "Gagal membuat booking");
      }

      // 2. Call DOKU payment edge function
      const courtLabel = COURTS.find((c) => c.id === selectedCourtId)?.label || selectedCourtId;
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("doku-payment", {
        body: {
          bookingId: booking.id,
          amount: 200000,
          courtLabel,
          date: format(selectedDate, "dd MMMM yyyy", { locale: id }),
          timeSlot: selectedTime,
        },
      });

      if (paymentError)
      {
        throw new Error(paymentError.message || "Gagal memproses pembayaran");
      }

      if (paymentData?.payment_url)
      {
        // Redirect to DOKU checkout page
        window.location.href = paymentData.payment_url;
      } else
      {
        throw new Error("Tidak mendapatkan URL pembayaran dari DOKU");
      }
    } catch (err: any)
    {
      toast({
        title: "Pembayaran gagal",
        description: err.message || "Terjadi kesalahan saat memproses pembayaran",
        variant: "destructive",
      });
    } finally
    {
      setSubmitting(false);
    }
  };

  const selectedCourt = COURTS.find((c) => c.id === selectedCourtId);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative h-[200px] sm:h-[300px] md:h-[400px] overflow-hidden">
        <img src={heroImage} alt="Lapangan Putroagung" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/50 to-background" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-10">
          <div className="container mx-auto">
            <Link to="/" className="inline-flex items-center gap-1 text-secondary text-sm mb-3 hover:underline">
              <ChevronLeft className="w-4 h-4" /> Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>

      {/* Venue Info */}
      <div className="container mx-auto px-3 sm:px-4 -mt-10 sm:-mt-16 relative z-10">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            {/* Venue Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-4 sm:p-6 md:p-8 shadow-lg mb-4 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-heading tracking-wider text-foreground">LAPANGAN PUTROAGUNG</h1>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 text-accent" />
                <span>Putroagung, Surabaya, Jawa Timur</span>
              </div>
              <div className="mt-6">
                <h3 className="font-bold text-foreground mb-1">Deskripsi</h3>
                <p className="text-sm text-muted-foreground">Lapangan olahraga terbaik dengan fasilitas modern dan harga terjangkau.</p>
              </div>
              <div className="mt-6">
                <h3 className="font-bold text-foreground mb-3">Fasilitas</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {FACILITIES.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <f.icon className="w-4 h-4 text-accent" /> {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Date Selector */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-lg mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-heading tracking-wider text-foreground mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" /> PILIH TANGGAL
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((date) => {
                  const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                  const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <button key={date.toISOString()} onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                      className={`flex flex-col items-center px-4 py-3 rounded-xl min-w-[72px] transition-all duration-300 shrink-0 ${isSelected ? "bg-primary text-secondary shadow-lg" : "bg-muted text-foreground hover:bg-muted/80"}`}>
                      <span className="text-[10px] font-semibold uppercase opacity-70">{format(date, "EEE", { locale: id })}</span>
                      <span className="text-lg font-bold">{format(date, "d")}</span>
                      <span className="text-[10px] opacity-70">{format(date, "MMM")}</span>
                      {isToday && <span className={`text-[9px] font-bold mt-0.5 ${isSelected ? "text-secondary" : "text-accent"}`}>Hari ini</span>}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Courts */}
            {COURTS.map((court, idx) => {
              const available = getAvailableCount(court.id);
              return (
                <motion.div key={court.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.1 }}
                  className="bg-card rounded-2xl border border-border shadow-lg mb-4 sm:mb-6 overflow-hidden">
                  <div className="flex flex-col md:grid md:grid-cols-[280px_1fr]">
                    <div className="relative aspect-[16/9] sm:aspect-[4/3] md:aspect-auto overflow-hidden">
                      <img src={court.image} alt={court.name} className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-primary/90 text-secondary text-xs font-bold">{court.capacity}</div>
                    </div>
                    <div className="p-4 sm:p-5 md:p-6">
                      <h3 className="text-xl font-heading tracking-wider text-foreground">{court.emoji} {court.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{court.description}</p>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 bg-muted rounded-full">{court.type}</span>
                        <span className="px-2 py-0.5 bg-muted rounded-full">{court.surface}</span>
                      </div>
                      <div className="mt-3 mb-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${available > 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {available > 0 ? `${available} Jadwal Tersedia` : "Tidak ada jadwal"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {TIME_SLOTS.map((slot) => {
                          const courtFull = isCourtFull(court.id);
                          const slotTaken = isSlotBooked(court.id, slot.start);
                          const disabled = courtFull || slotTaken;
                          const isSelected = selectedTime === slot.start && selectedCourtId === court.id;
                          return (
                            <button key={slot.start} disabled={disabled}
                              onClick={() => {
                                if (isSelected) { setSelectedTime(null); setSelectedCourtId(null); }
                                else { setSelectedTime(slot.start); setSelectedCourtId(court.id); }
                              }}
                              className={`relative p-2.5 rounded-lg text-center text-xs transition-all duration-200 ${disabled ? "bg-destructive/5 text-muted-foreground cursor-not-allowed opacity-50 line-through" : isSelected ? "bg-primary text-secondary shadow-md ring-2 ring-accent" : "bg-muted/50 text-foreground border border-border hover:border-accent/50 hover:bg-muted"}`}>
                              <span className="font-semibold">{slot.label}</span>
                              <div className="text-[10px] mt-0.5 opacity-70">{slotTaken ? "Sudah Dipesan" : courtFull ? "Penuh" : "Tersedia"}</div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedCourtId === court.id && selectedTime && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                          <Button variant="hero" className="w-full" onClick={() => handleBooking(court.id)}>
                            <MapPin className="w-4 h-4" />
                            Pesan {court.label} - {format(selectedDate, "dd MMM")} {selectedTime}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div className="order-first lg:order-none lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-4 sm:p-6 shadow-lg lg:sticky lg:top-20">
              <p className="text-xs text-muted-foreground">Mulai dari</p>
              <p className="text-3xl font-heading tracking-wider text-foreground">
                Rp 200.000 <span className="text-sm font-body text-muted-foreground font-normal">/sesi</span>
              </p>
              <Button variant="hero" className="w-full mt-4" disabled={!selectedTime || !selectedCourtId}
                onClick={() => selectedCourtId && handleBooking(selectedCourtId)}>
                {selectedTime && selectedCourtId ? "Cek Ketersediaan" : "Pilih Jadwal Dulu"}
              </Button>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground text-xs uppercase tracking-wider">Keuntungan booking online</p>
                <div className="flex items-start gap-2"><Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>Pembayaran mudah 24/7</span></div>
                <div className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>Keamanan terjamin</span></div>
                <div className="flex items-start gap-2"><Droplets className="w-4 h-4 text-accent mt-0.5 shrink-0" /><span>Air minum gratis</span></div>
              </div>
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Jam Operasional</h4>
                <p className="text-sm text-muted-foreground">Senin - Minggu</p>
                <p className="text-lg font-heading tracking-wider text-accent">07:00 - 20:00</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="py-12" />
      <Footer />

      <PaymentLoadingOverlay visible={submitting} />

      {/* Payment Modal */}
      {showPayment && selectedCourt && (
        <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-3xl font-heading tracking-wider text-foreground mb-4">RINCIAN BIAYA</h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">📍 {selectedCourt.label}</span>
                <span className="font-semibold text-foreground">{format(selectedDate, "dd MMMM yyyy", { locale: id })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">🕐 Waktu</span>
                <span className="font-semibold text-foreground">{selectedTime}</span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between"><span className="text-muted-foreground">Sewa Lapangan</span><span className="font-semibold text-foreground">Rp 100.000</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kebersihan</span><span className="font-semibold text-foreground">Rp 50.000</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Keamanan</span><span className="font-semibold text-foreground">Rp 50.000</span></div>
              <hr className="border-border" />
              <div className="flex justify-between text-lg">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-accent">Rp 200.000</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayment(false)}>Batal</Button>
              <Button variant="hero" className="flex-1" onClick={handlePayment} disabled={submitting}>
                {submitting ? "Memproses..." : "Bayar Sekarang"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SOP Modal */}
      {showSOP && (
        <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSOP(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <h3 className="text-3xl font-heading tracking-wider text-foreground">BOOKING BERHASIL!</h3>
            </div>
            <div className="bg-muted rounded-xl p-4 mb-6">
              <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-accent" /> SOP Penggunaan Lapangan
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-accent font-bold">1.</span>Datang <strong className="text-foreground">15 menit sebelum</strong> jadwal dimulai</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">2.</span>Booking <strong className="text-foreground">tidak hangus</strong> jika terlambat</li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">3.</span>Wajib menjaga <strong className="text-foreground">kebersihan lapangan</strong></li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">4.</span>Dilarang membawa <strong className="text-foreground">makanan ke area lapangan</strong></li>
                <li className="flex items-start gap-2"><span className="text-accent font-bold">5.</span>Gunakan <strong className="text-foreground">sepatu olahraga</strong> yang sesuai</li>
              </ul>
            </div>
            <Button variant="hero" className="w-full" onClick={() => setShowSOP(false)}>Mengerti</Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Booking;
