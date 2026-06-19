import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { Navigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Users,
  DollarSign,
  CheckCircle,
  Clock,
  Filter,
  LogOut,
  LayoutDashboard,
  List,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MessageCircle,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import AdminChatTab from "@/components/AdminChatTab";
import AdminGalleryTab from "@/components/AdminGalleryTab";

const COURT_LABELS: Record<string, string> = {
  voli: "🏐 Voli",
  basket: "🏀 Basket",
  soccer: "⚽ Mini Soccer",
};

const COURT_COLORS: Record<string, string> = {
  voli: "bg-blue-100 text-blue-800 border-blue-200",
  basket: "bg-orange-100 text-orange-800 border-orange-200",
  soccer: "bg-green-100 text-green-800 border-green-200",
};

interface BookingRow {
  id: string;
  user_id: string;
  court_id: string;
  booking_date: string;
  time_slot: string;
  amount: number;
  payment_status: string;
  created_at: string;
  user_name?: string;
}

type Tab = "overview" | "bookings" | "revenue" | "calendar" | "chat" | "gallery";

const AdminDashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const adminUnread = useUnreadChatCount("admin", user?.id);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [filterCourt, setFilterCourt] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchBookings = async () => {
      // Fetch bookings
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("*")
        .order("booking_date", { ascending: false });

      if (!bookingsData) {
        setFetching(false);
        return;
      }

      // Fetch profiles for user names
      const userIds = [...new Set(bookingsData.map((b) => b.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      profilesData?.forEach((p) => {
        profileMap[p.user_id] = p.full_name;
      });

      const enriched: BookingRow[] = bookingsData.map((b) => ({
        ...b,
        user_name: profileMap[b.user_id] || "—",
      }));

      setBookings(enriched);
      setFetching(false);
    };
    fetchBookings();
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p>Loading...</p></div>;
  if (!isAdmin) return <Navigate to="/admin-login" replace />;

  const filtered = bookings.filter((b) => {
    if (filterCourt !== "all" && b.court_id !== filterCourt) return false;
    if (filterPayment !== "all" && b.payment_status !== filterPayment) return false;
    return true;
  });

  const totalRevenue = bookings.reduce((s, b) => s + b.amount, 0);
  const paidRevenue = bookings.filter((b) => b.payment_status === "paid").reduce((s, b) => s + b.amount, 0);
  const pendingRevenue = bookings.filter((b) => b.payment_status === "pending").reduce((s, b) => s + b.amount, 0);
  const paidCount = bookings.filter((b) => b.payment_status === "paid").length;
  const pendingCount = bookings.filter((b) => b.payment_status === "pending").length;

  const courtStats = Object.keys(COURT_LABELS).map((court) => {
    const courtBookings = bookings.filter((b) => b.court_id === court);
    return {
      id: court,
      label: COURT_LABELS[court],
      total: courtBookings.length,
      paid: courtBookings.filter((b) => b.payment_status === "paid").length,
      revenue: courtBookings.reduce((s, b) => s + b.amount, 0),
    };
  });

  const updatePaymentStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ payment_status: status }).eq("id", id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, payment_status: status } : b)));
  };

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "bookings", label: "Daftar Booking", icon: List },
    { id: "revenue", label: "Pemasukan", icon: BarChart3 },
    { id: "calendar", label: "Kalender", icon: CalendarIcon },
    { id: "gallery", label: "Galeri Foto", icon: ImageIcon },
    { id: "chat", label: "Chat", icon: MessageCircle },
  ];

  const handleTabClick = (tabId: Tab) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-primary text-primary-foreground flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-primary-foreground/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading tracking-wider text-secondary">ADMIN PANEL</h1>
            <p className="text-xs text-primary-foreground/50 mt-1">GOR Persebaya</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-primary-foreground/70 hover:text-primary-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "chat" && adminUnread > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {adminUnread > 9 ? "9+" : adminUnread}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-foreground/10">
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start gap-3 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-3 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === "overview" && (
            <OverviewTab
              bookings={bookings}
              totalRevenue={totalRevenue}
              paidRevenue={paidRevenue}
              pendingRevenue={pendingRevenue}
              paidCount={paidCount}
              pendingCount={pendingCount}
              courtStats={courtStats}
              fetching={fetching}
            />
          )}
          {activeTab === "bookings" && (
            <BookingsTab
              filtered={filtered}
              filterCourt={filterCourt}
              setFilterCourt={setFilterCourt}
              filterPayment={filterPayment}
              setFilterPayment={setFilterPayment}
              fetching={fetching}
              updatePaymentStatus={updatePaymentStatus}
            />
          )}
          {activeTab === "revenue" && (
            <RevenueTab bookings={bookings} courtStats={courtStats} paidRevenue={paidRevenue} pendingRevenue={pendingRevenue} />
          )}
          {activeTab === "calendar" && (
            <CalendarTab
              bookings={bookings}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
            />
          )}
          {activeTab === "chat" && <AdminChatTab />}
          {activeTab === "gallery" && <AdminGalleryTab />}
        </div>
      </main>
    </div>
  );
};

interface CourtStat {
  id: string;
  label: string;
  total: number;
  paid: number;
  revenue: number;
}

interface OverviewTabProps {
  bookings: BookingRow[];
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  courtStats: CourtStat[];
  fetching: boolean;
}

/* ===================== OVERVIEW TAB ===================== */
function OverviewTab({
  bookings,
  totalRevenue,
  paidCount,
  pendingCount,
  courtStats,
  fetching,
}: OverviewTabProps) {
  const stats = [
    { icon: Users, label: "Total Booking", value: bookings.length, color: "text-primary" },
    { icon: CheckCircle, label: "Lunas", value: paidCount, color: "text-green-600" },
    { icon: Clock, label: "Belum Bayar", value: pendingCount, color: "text-yellow-600" },
    { icon: DollarSign, label: "Total Pendapatan", value: `Rp ${totalRevenue.toLocaleString("id-ID")}`, color: "text-accent" },
  ];

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-heading tracking-wider text-foreground mb-6">OVERVIEW</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-muted">
                <s.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{s.label}</p>
                <p className="text-base sm:text-xl font-heading tracking-wider text-foreground truncate">{s.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <h3 className="text-lg font-heading tracking-wider text-foreground mb-4">STATISTIK PER LAPANGAN</h3>
      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {courtStats.map((c: CourtStat) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm">
            <p className="text-base sm:text-lg font-semibold mb-3">{c.label}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Booking</span>
                <span className="font-semibold text-foreground">{c.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lunas</span>
                <span className="font-semibold text-green-600">{c.paid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pendapatan</span>
                <span className="font-semibold text-foreground">Rp {c.revenue.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-heading tracking-wider text-foreground mb-4">BOOKING TERBARU</h3>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {fetching ? (
          <p className="text-center text-muted-foreground py-8">Memuat...</p>
        ) : bookings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Belum ada booking</p>
        ) : (
          bookings.slice(0, 5).map((b: BookingRow) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-sm">{b.user_name || "—"}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {b.payment_status === "paid" ? "Lunas" : "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${COURT_COLORS[b.court_id] || ""}`}>
                  {COURT_LABELS[b.court_id] || b.court_id}
                </span>
                <span className="text-xs text-muted-foreground">{format(new Date(b.booking_date), "dd MMM yyyy", { locale: idLocale })}</span>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 sm:p-4 font-semibold text-foreground">Nama</th>
              <th className="text-left p-3 sm:p-4 font-semibold text-foreground">Lapangan</th>
              <th className="text-left p-3 sm:p-4 font-semibold text-foreground">Tanggal</th>
              <th className="text-left p-3 sm:p-4 font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Memuat...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada booking</td></tr>
            ) : (
              bookings.slice(0, 5).map((b: BookingRow) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 sm:p-4">{b.user_name || "—"}</td>
                  <td className="p-3 sm:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${COURT_COLORS[b.court_id] || ""}`}>
                      {COURT_LABELS[b.court_id] || b.court_id}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4">{format(new Date(b.booking_date), "dd MMM yyyy", { locale: idLocale })}</td>
                  <td className="p-3 sm:p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {b.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface BookingsTabProps {
  filtered: BookingRow[];
  filterCourt: string;
  setFilterCourt: (val: string) => void;
  filterPayment: string;
  setFilterPayment: (val: string) => void;
  fetching: boolean;
  updatePaymentStatus: (id: string, status: string) => Promise<void>;
}

/* ===================== BOOKINGS TAB ===================== */
function BookingsTab({
  filtered,
  filterCourt,
  setFilterCourt,
  filterPayment,
  setFilterPayment,
  fetching,
  updatePaymentStatus,
}: BookingsTabProps) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-heading tracking-wider text-foreground mb-6">DAFTAR BOOKING</h2>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={filterCourt} onChange={(e) => setFilterCourt(e.target.value)} className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground">
            <option value="all">Semua Lapangan</option>
            <option value="voli">Voli</option>
            <option value="basket">Basket</option>
            <option value="soccer">Mini Soccer</option>
          </select>
        </div>
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground">
          <option value="all">Semua Status</option>
          <option value="paid">Lunas</option>
          <option value="pending">Belum Bayar</option>
        </select>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {fetching ? (
          <p className="text-center text-muted-foreground py-8">Memuat data...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Belum ada booking</p>
        ) : (
          filtered.map((b: BookingRow) => (
            <div key={b.id} className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{b.user_name || "—"}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {b.payment_status === "paid" ? "Lunas" : "Pending"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${COURT_COLORS[b.court_id] || ""}`}>
                  {COURT_LABELS[b.court_id] || b.court_id}
                </span>
                <span className="text-xs text-muted-foreground">{b.time_slot}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{format(new Date(b.booking_date), "dd MMM yyyy", { locale: idLocale })}</span>
                <span className="font-semibold">Rp {b.amount.toLocaleString("id-ID")}</span>
              </div>
              {b.payment_status === "pending" && (
                <Button size="sm" variant="outline" className="w-full" onClick={() => updatePaymentStatus(b.id, "paid")}>
                  <CheckCircle className="w-3 h-3 mr-1" /> Konfirmasi Bayar
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-4 font-semibold text-foreground">Nama</th>
              <th className="text-left p-4 font-semibold text-foreground">Lapangan</th>
              <th className="text-left p-4 font-semibold text-foreground">Tanggal</th>
              <th className="text-left p-4 font-semibold text-foreground">Jam</th>
              <th className="text-left p-4 font-semibold text-foreground">Jumlah</th>
              <th className="text-left p-4 font-semibold text-foreground">Status</th>
              <th className="text-left p-4 font-semibold text-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {fetching ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada booking</td></tr>
            ) : (
              filtered.map((b: BookingRow) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                  <td className="p-4 text-foreground">{b.user_name || "—"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${COURT_COLORS[b.court_id] || ""}`}>
                      {COURT_LABELS[b.court_id] || b.court_id}
                    </span>
                  </td>
                  <td className="p-4">{format(new Date(b.booking_date), "dd MMM yyyy", { locale: idLocale })}</td>
                  <td className="p-4">{b.time_slot}</td>
                  <td className="p-4 font-semibold">Rp {b.amount.toLocaleString("id-ID")}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {b.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                    </span>
                  </td>
                  <td className="p-4">
                    {b.payment_status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updatePaymentStatus(b.id, "paid")}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Konfirmasi
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RevenueTabProps {
  bookings: BookingRow[];
  courtStats: CourtStat[];
  paidRevenue: number;
  pendingRevenue: number;
}

/* ===================== REVENUE TAB ===================== */
function RevenueTab({ bookings, courtStats, paidRevenue, pendingRevenue }: RevenueTabProps) {
  const totalRevenue = paidRevenue + pendingRevenue;

  const monthlyData = useMemo(() => {
    const map: Record<string, { paid: number; pending: number }> = {};
    bookings.forEach((b: BookingRow) => {
      const key = format(new Date(b.booking_date), "yyyy-MM");
      if (!map[key]) map[key] = { paid: 0, pending: 0 };
      if (b.payment_status === "paid") map[key].paid += b.amount;
      else map[key].pending += b.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .reverse();
  }, [bookings]);

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-heading tracking-wider text-foreground mb-6">REKAP PEMASUKAN</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-5 sm:p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Total Pemasukan</p>
          <p className="text-xl sm:text-2xl font-heading tracking-wider text-foreground">Rp {totalRevenue.toLocaleString("id-ID")}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 sm:p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Sudah Dibayar</p>
          <p className="text-xl sm:text-2xl font-heading tracking-wider text-green-600">Rp {paidRevenue.toLocaleString("id-ID")}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 sm:p-6 shadow-sm">
          <p className="text-sm text-muted-foreground mb-1">Belum Dibayar</p>
          <p className="text-xl sm:text-2xl font-heading tracking-wider text-yellow-600">Rp {pendingRevenue.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <h3 className="text-lg font-heading tracking-wider text-foreground mb-4">PENDAPATAN PER LAPANGAN</h3>
      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {courtStats.map((c: CourtStat) => {
          const pct = totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0;
          return (
            <div key={c.id} className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm">
              <p className="font-semibold mb-3">{c.label}</p>
              <p className="text-lg sm:text-xl font-heading tracking-wider text-foreground mb-2">Rp {c.revenue.toLocaleString("id-ID")}</p>
              <div className="w-full bg-muted rounded-full h-2 mb-1">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{pct}% dari total</p>
            </div>
          );
        })}
      </div>

      <h3 className="text-lg font-heading tracking-wider text-foreground mb-4">PEMASUKAN BULANAN</h3>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {monthlyData.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Belum ada data</p>
        ) : (
          monthlyData.map(([month, data]: [string, { paid: number; pending: number }]) => (
            <div key={month} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <p className="font-semibold mb-2">{format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lunas</span>
                <span className="text-green-600 font-semibold">Rp {data.paid.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <span className="text-yellow-600 font-semibold">Rp {data.pending.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-sm mt-1 pt-1 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">Rp {(data.paid + data.pending).toLocaleString("id-ID")}</span>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-4 font-semibold text-foreground">Bulan</th>
              <th className="text-left p-4 font-semibold text-foreground">Lunas</th>
              <th className="text-left p-4 font-semibold text-foreground">Belum Bayar</th>
              <th className="text-left p-4 font-semibold text-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Belum ada data</td></tr>
            ) : (
              monthlyData.map(([month, data]: [string, { paid: number; pending: number }]) => (
                <tr key={month} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-4 font-medium">{format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}</td>
                  <td className="p-4 text-green-600 font-semibold">Rp {data.paid.toLocaleString("id-ID")}</td>
                  <td className="p-4 text-yellow-600 font-semibold">Rp {data.pending.toLocaleString("id-ID")}</td>
                  <td className="p-4 font-semibold">Rp {(data.paid + data.pending).toLocaleString("id-ID")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== CALENDAR TAB ===================== */
function CalendarTab({
  bookings,
  calendarMonth,
  setCalendarMonth,
}: {
  bookings: BookingRow[];
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const padStart = Array.from({ length: startDayOfWeek }, (_, i) => null);

  const bookingsByDate = useMemo(() => {
    const map: Record<string, BookingRow[]> = {};
    bookings.forEach((b) => {
      const key = b.booking_date;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedBookings = selectedDateStr ? bookingsByDate[selectedDateStr] || [] : [];

  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-heading tracking-wider text-foreground mb-6">KALENDER BOOKING</h2>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-base sm:text-lg font-heading tracking-wider text-foreground">
              {format(calendarMonth, "MMMM yyyy", { locale: idLocale }).toUpperCase()}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
              <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1 sm:py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {padStart.map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateStr] || [];
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-lg p-0.5 sm:p-1 text-sm transition-all relative flex flex-col items-center justify-start ${
                    isSelected
                      ? "bg-primary text-primary-foreground ring-2 ring-primary"
                      : isToday
                      ? "bg-secondary/20 text-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-medium">{format(day, "d")}</span>
                  {dayBookings.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayBookings.length <= 3 ? (
                        dayBookings.map((b) => (
                          <span
                            key={b.id}
                            className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${
                              b.court_id === "voli" ? "bg-blue-500" : b.court_id === "basket" ? "bg-orange-500" : "bg-green-500"
                            }`}
                          />
                        ))
                      ) : (
                        <span className="text-[8px] sm:text-[10px] font-bold text-primary">{dayBookings.length}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 sm:gap-4 mt-4 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Voli</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Basket</div>
            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Soccer</div>
          </div>
        </div>

        {/* Selected Day Detail */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 sm:p-6">
          <h3 className="font-heading tracking-wider text-foreground mb-4">
            {selectedDate
              ? format(selectedDate, "dd MMMM yyyy", { locale: idLocale })
              : "Pilih tanggal"}
          </h3>

          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Klik tanggal di kalender untuk melihat detail booking.</p>
          ) : selectedBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada booking pada tanggal ini.</p>
          ) : (
            <div className="space-y-3">
              {selectedBookings.map((b) => (
                <div key={b.id} className="border border-border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${COURT_COLORS[b.court_id] || ""}`}>
                      {COURT_LABELS[b.court_id]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      b.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {b.payment_status === "paid" ? "Lunas" : "Pending"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{b.user_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">⏰ {b.time_slot}</p>
                  <p className="text-xs font-semibold text-foreground">Rp {b.amount.toLocaleString("id-ID")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
