import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    const handleResetPassword = async () => {
        if (password.length < 6)
        {
            toast({
                title: "Password terlalu pendek",
                description: "Password minimal 6 karakter.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.updateUser({
            password,
        });

        setLoading(false);

        if (error)
        {
            toast({
                title: "Gagal mengubah password",
                description: error.message,
                variant: "destructive",
            });
        } else
        {
            toast({
                title: "Berhasil",
                description: "Password berhasil diperbarui.",
            });

            navigate("/auth");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl p-8 w-full max-w-md space-y-4">
                <h1 className="text-2xl font-bold text-center">
                    Reset Password
                </h1>

                <p className="text-sm text-muted-foreground text-center">
                    Masukkan password baru Anda.
                </p>

                <Input
                    type="password"
                    placeholder="Password Baru"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <Button
                    className="w-full"
                    onClick={handleResetPassword}
                    disabled={loading}
                >
                    {loading ? "Menyimpan..." : "Simpan Password Baru"}
                </Button>
            </div>
        </div>
    );
};

export default ResetPassword;