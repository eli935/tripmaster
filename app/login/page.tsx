"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plane, Loader2, MapPin, Calendar, Users, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Gate: check whether this email was ever invited or signed up.
    // If not — redirect to landing with email pre-filled so they can
    // leave details instead of landing on an empty dashboard.
    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (checkRes.ok) {
        const data = (await checkRes.json()) as { registered?: boolean };
        if (data.registered === false) {
          setLoading(false);
          router.push(`/?email=${encodeURIComponent(email)}&from=login#lead-form`);
          return;
        }
      }
    } catch {
      // fail-open: if check fails, proceed with OTP (don't block a real user)
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      toast.error("שגיאה בשליחת הלינק", { description: error.message });
      return;
    }

    setSent(true);
    toast.success("נשלח לינק כניסה למייל!");
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-pulse [animation-delay:4s]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          {/* Logo */}
          <motion.div
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-blue shadow-2xl shadow-blue-500/30"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            >
              <Plane className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent">
                TripMaster
              </span>
            </h1>
            <motion.p
              className="mt-3 text-lg text-muted-foreground max-w-md mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              חופשה מושלמת מתחילה בתכנון מושלם
            </motion.p>
          </motion.div>

          {/* Login Card */}
          <div className="w-full max-w-sm">
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-6 shadow-2xl shadow-black/20">
              {sent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                    <span className="text-3xl">📧</span>
                  </div>
                  <h3 className="text-lg font-semibold">בדוק את המייל!</h3>
                  <p className="text-sm text-muted-foreground">
                    שלחנו לינק כניסה ל-<strong className="text-foreground">{email}</strong>
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => setSent(false)}
                    className="mt-4"
                  >
                    שלח שוב
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="text-center mb-2">
                    <h2 className="font-semibold text-lg">כניסה לחשבון</h2>
                  </div>
                  <div className="space-y-2">
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      dir="ltr"
                      className="text-left h-12 bg-secondary/50 border-border/50 rounded-xl text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base gradient-blue border-0 hover:opacity-90 transition-opacity"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                        שולח...
                      </>
                    ) : (
                      <>
                        כניסה
                        <ArrowLeft className="mr-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    לינק חד פעמי למייל — בלי סיסמה
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full px-4">
            {[
              { icon: Calendar, label: "לוח עברי", desc: "חגים ושבתות" },
              { icon: Users, label: "ניהול קבוצה", desc: "חלוקת הוצאות" },
              { icon: MapPin, label: "תכנון יומי", desc: "ארוחות וטיולים" },
              { icon: Shield, label: "שקיפות מלאה", desc: "מסמכים וקבלות" },
            ].map((f) => (
              <div
                key={f.label}
                className="text-center p-4 rounded-xl border border-border/30 bg-card/50 backdrop-blur"
              >
                <f.icon className="h-6 w-6 mx-auto mb-2 text-blue-400" />
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-muted-foreground">
          TripMaster &copy; {new Date().getFullYear()} — Premium Trip Planning
        </div>
      </div>
    </div>
  );
}
