import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn, LogOut, LayoutDashboard, Shield, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { Link, useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/logo-persebaya.png";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAdmin, profile, signOut } = useAuth();
  const userUnread = useUnreadChatCount("user", !isAdmin ? user?.id : undefined);
  const adminUnread = useUnreadChatCount("admin", isAdmin ? user?.id : undefined);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Beranda", href: "/", isAnchor: false },
    { label: "Lapangan", href: "lapangan", isAnchor: true },
    { label: "Booking", href: "/booking", isAnchor: false },
    { label: "SOP", href: "sop", isAnchor: true },
  ];

  const handleAnchorClick = (anchor: string, closeMobile = false) => {
    if (closeMobile) setIsOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary/95 backdrop-blur-md border-b border-green-light/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Lapangan Putroagung" className="h-10 w-10 object-contain" />
            <span className="font-heading text-2xl text-secondary tracking-wider">PUTROAGUNG</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) =>
              item.isAnchor ? (
                <button
                  key={item.label}
                  onClick={() => handleAnchorClick(item.href)}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}

            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="px-3 py-2 text-sm font-medium text-secondary hover:text-accent transition-colors flex items-center gap-1 relative">
                    <Shield className="w-3 h-3" /> Admin
                    {adminUnread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {adminUnread > 9 ? "9+" : adminUnread}
                      </span>
                    )}
                  </Link>
                )}
                <Link to="/dashboard" className="px-3 py-2 text-sm font-medium text-primary-foreground/80 hover:text-secondary transition-colors flex items-center gap-1">
                  <LayoutDashboard className="w-3 h-3" /> Riwayat Pemesanan
                </Link>
                {!isAdmin && (
                  <Link to="/chat" className="px-3 py-2 text-sm font-medium text-primary-foreground/80 hover:text-secondary transition-colors flex items-center gap-1 relative">
                    <MessageCircle className="w-3 h-3" /> Chat
                    {userUnread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                        {userUnread > 9 ? "9+" : userUnread}
                      </span>
                    )}
                  </Link>
                )}
                <Button variant="heroOutline" size="sm" className="ml-2" onClick={signOut}>
                  <LogOut className="w-4 h-4" /> Keluar
                </Button>
              </>
            ) : (
              <Button variant="hero" size="sm" className="ml-4" asChild>
                <Link to="/auth">
                  <LogIn className="w-4 h-4" /> Masuk
                </Link>
              </Button>
            )}
          </div>

          <button className="md:hidden text-primary-foreground" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-primary border-t border-green-light/20"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              {navItems.map((item) =>
                item.isAnchor ? (
                  <button
                    key={item.label}
                    onClick={() => handleAnchorClick(item.href, true)}
                    className="px-4 py-3 text-sm font-medium text-primary-foreground/80 hover:text-secondary rounded-lg hover:bg-green-light/10 transition-colors text-left"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="px-4 py-3 text-sm font-medium text-primary-foreground/80 hover:text-secondary rounded-lg hover:bg-green-light/10 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              )}
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" className="px-4 py-3 text-sm font-medium text-secondary flex items-center gap-1 relative" onClick={() => setIsOpen(false)}>
                      <Shield className="w-3 h-3" /> Admin Dashboard
                      {adminUnread > 0 && (
                        <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                          {adminUnread > 9 ? "9+" : adminUnread}
                        </span>
                      )}
                    </Link>
                  )}
                  <Link to="/dashboard" className="px-4 py-3 text-sm font-medium text-primary-foreground/80" onClick={() => setIsOpen(false)}>
                    <LayoutDashboard className="w-3 h-3 inline mr-1" /> Riwayat Pemesanan
                  </Link>
                  {!isAdmin && (
                    <Link to="/chat" className="px-4 py-3 text-sm font-medium text-primary-foreground/80 flex items-center gap-1" onClick={() => setIsOpen(false)}>
                      <MessageCircle className="w-3 h-3" /> Chat Admin
                      {userUnread > 0 && (
                        <span className="ml-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                          {userUnread > 9 ? "9+" : userUnread}
                        </span>
                      )}
                    </Link>
                  )}
                  <Button variant="heroOutline" className="mt-2" onClick={() => { signOut(); setIsOpen(false); }}>
                    <LogOut className="w-4 h-4" /> Keluar
                  </Button>
                </>
              ) : (
                <Button variant="hero" className="mt-2" asChild>
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <LogIn className="w-4 h-4" /> Masuk
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
