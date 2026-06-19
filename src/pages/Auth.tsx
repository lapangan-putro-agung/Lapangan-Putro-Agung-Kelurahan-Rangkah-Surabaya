import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-persebaya.png";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (!isLogin && !fullName.trim()) return;

    setSubmitting(true);
    try
    {
      if (isLogin)
      {
        const { error } = await signIn(email, password);
        if (error)
        {
          toast({ title: "Login gagal", description: error.message, variant: "destructive" });
        } else
        {
          navigate("/");
        }
      } else
      {
        const { error } = await signUp(email, password, fullName);
        if (error)
        {
          toast({ title: "Registrasi gagal", description: error.message, variant: "destructive" });
        } else
        {
          toast({
            title: "Registrasi berhasil!",
            description: "Silakan cek email untuk verifikasi akun Anda.",
          });
          setIsLogin(true);
        }
      }
    } finally
    {
      setSubmitting(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email.trim())
    {
      toast({
        title: "Email diperlukan",
        description: "Masukkan email terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error)
    {
      toast({
        title: "Gagal mengirim email",
        description: error.message,
        variant: "destructive",
      });
    } else
    {
      toast({
        title: "Email terkirim",
        description: "Silakan cek email untuk reset password.",
      });
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border shadow-2xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-6">
          <img src={logo} alt="Putroagung" className="h-16 w-16 mx-auto mb-3" />
          <h1 className="text-3xl font-heading tracking-wider text-foreground">
            {isLogin ? "MASUK" : "DAFTAR"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Masuk ke akun Anda" : "Buat akun baru"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nama Lengkap"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                required={!isLogin}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {isLogin && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-accent hover:underline"
              >
                Lupa Password?
              </button>
            </div>
          )}

          <Button variant="hero" className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
          </Button>

          <Button variant="hero" className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-accent font-semibold hover:underline"
          >
            {isLogin ? "Daftar" : "Masuk"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
