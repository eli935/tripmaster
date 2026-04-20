"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Child {
  name: string;
  age: string;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const nextUrl = params.get("next") || "/dashboard";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent("/onboarding")}`);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setAdults(profile.adults ?? 2);
        if (Array.isArray(profile.children)) {
          setChildren(
            profile.children.map((c: any) => ({
              name: c?.name || "",
              age: c?.age?.toString() || "",
            }))
          );
        }
      }
      setLoading(false);
    })();
  }, []);

  function addChild() {
    setChildren([...children, { name: "", age: "" }]);
  }

  function removeChild(i: number) {
    setChildren(children.filter((_, idx) => idx !== i));
  }

  function updateChild(i: number, field: keyof Child, value: string) {
    setChildren(
      children.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("נא למלא את השם המלא");
      return;
    }
    // Phone is now required so we can send the daily WhatsApp itinerary.
    const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
    if (cleanPhone.length < 9) {
      toast.error("נא להזין מספר טלפון תקין (לפחות 9 ספרות) — נדרש לשליחת תוכנית יומית ב-WhatsApp");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      router.replace("/login");
      return;
    }

    const cleanChildren = children
      .filter((c) => c.name.trim() && c.age.trim())
      .map((c) => ({ name: c.name.trim(), age: parseInt(c.age) || 0 }));

    // Upsert profile (handles both existing + first-login)
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName.trim(),
        phone: cleanPhone,
        adults,
        children: cleanChildren,
      },
      { onConflict: "id" }
    );

    if (error) {
      toast.error("שגיאה בשמירה", { description: error.message });
      setSaving(false);
      return;
    }

    // Also update participant rows for trips this user is in (so family count stays accurate)
    await supabase
      .from("trip_participants")
      .update({
        adults,
        children: cleanChildren.length,
      })
      .eq("profile_id", user.id);

    toast.success("הפרופיל נשמר!");
    router.push(nextUrl);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(212,169,96,0.22), transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10"
      >
        <Card className="border-[var(--gold-500)]/20 bg-card/90 backdrop-blur-xl rounded-3xl">
          <CardHeader className="text-center space-y-3 pt-8">
            <div className="mx-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[var(--gold-200)] font-serif italic">
              <span className="h-px w-6 bg-[var(--gold-500)]" />
              ברוכים הבאים
              <span className="h-px w-6 bg-[var(--gold-500)]" />
            </div>
            <CardTitle className="font-serif text-3xl font-black leading-tight">
              הרכב המשפחה
            </CardTitle>
            <CardDescription className="font-serif text-sm">
              כמה פרטים שיעזרו לנו להתאים את הטיול עבורכם — כמויות אוכל, ציוד, וחלוקת עלויות.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label>שם מלא *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ישראל ישראלי"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>טלפון (וואטסאפ) *</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+972501234567"
                  dir="ltr"
                  required
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  נצרף לכם הודעת וואטסאפ עם סדר היום שלכם בכל בוקר בזמן הטיול.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[var(--gold-500)]" />
                  מבוגרים
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                  dir="ltr"
                  className="h-11 text-center"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[var(--gold-500)]" />
                    ילדים ({children.length})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addChild}
                    className="h-8 rounded-full text-xs"
                  >
                    <Plus className="ml-1 h-3 w-3" />
                    הוסף ילד
                  </Button>
                </div>

                <AnimatePresence mode="popLayout">
                  {children.map((c, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="grid grid-cols-[1fr_80px_auto] gap-2"
                    >
                      <Input
                        value={c.name}
                        onChange={(e) => updateChild(i, "name", e.target.value)}
                        placeholder="שם הילד/ה"
                        className="h-10"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="25"
                        value={c.age}
                        onChange={(e) => updateChild(i, "age", e.target.value)}
                        placeholder="גיל"
                        dir="ltr"
                        className="h-10 text-center"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeChild(i)}
                        className="h-10 w-10 text-red-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {children.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    טיול בלי ילדים? אפשר לדלג.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={saving || !fullName.trim() || phone.trim().replace(/[^\d+]/g, "").length < 9}
                className="w-full h-12 rounded-full gradient-gold text-white border-0 shadow-[0_4px_20px_-6px_rgba(212,169,96,0.6)]"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "שמור והמשך לטיול"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
