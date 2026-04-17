"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Loader2, Check, AlertTriangle, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "already_accepted"; tripId: string }
  | { kind: "cancelled" }
  | { kind: "email_mismatch"; invitedEmail: string }
  | {
      kind: "ready";
      tripName: string;
      destination: string;
      startDate: string;
      endDate: string;
      inviterName: string;
      tripId: string;
      message: string | null;
    };

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(`/invite/accept/${token}`)}`);
        return;
      }

      // Try to find the invitation by token (RLS allows invitee-by-email OR admin)
      const { data: inv } = await supabase
        .from("trip_invitations")
        .select("id, trip_id, email, status, expires_at, message, invited_by, trip:trips(name, destination, start_date, end_date), inviter:profiles!invited_by(full_name)")
        .eq("token", token)
        .maybeSingle();

      if (!inv) {
        setState({ kind: "invalid" });
        return;
      }

      if (inv.status === "cancelled") {
        setState({ kind: "cancelled" });
        return;
      }
      if (inv.status === "accepted") {
        setState({ kind: "already_accepted", tripId: inv.trip_id });
        return;
      }
      if (inv.status === "expired" || new Date(inv.expires_at) < new Date()) {
        setState({ kind: "expired" });
        return;
      }

      // Check email match
      if ((user.email || "").toLowerCase() !== inv.email.toLowerCase()) {
        setState({ kind: "email_mismatch", invitedEmail: inv.email });
        return;
      }

      const trip = (inv as any).trip;
      const inviter = (inv as any).inviter;
      setState({
        kind: "ready",
        tripName: trip?.name || "טיול",
        destination: trip?.destination || "",
        startDate: trip?.start_date || "",
        endDate: trip?.end_date || "",
        inviterName: inviter?.full_name || "מנהל הטיול",
        tripId: inv.trip_id,
        message: inv.message,
      });
    })();
  }, [token, router, supabase]);

  async function accept() {
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_trip_invitation", {
      p_token: token,
    });
    if (error || !data?.ok) {
      toast.error("שגיאה באישור ההזמנה", {
        description: error?.message || data?.error,
      });
      setAccepting(false);
      return;
    }

    // Check if the user has filled their family composition (onboarding)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("children")
      .eq("id", user!.id)
      .single();
    const hasFamily = Array.isArray(profile?.children) && profile!.children.length >= 0;
    const needsOnboarding = !profile || profile.children === null;

    toast.success("הצטרפת לטיול! 🎉");
    if (needsOnboarding) {
      router.push(`/onboarding?next=/trip/${data.trip_id}`);
    } else {
      router.push(`/trip/${data.trip_id}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Gold ambient halos */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(212,169,96,0.22), transparent 70%)" }} />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(139,46,60,0.18), transparent 70%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0)" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-[var(--gold-500)]/20 bg-card/90 backdrop-blur-xl rounded-3xl overflow-hidden">
          {state.kind === "loading" && (
            <CardContent className="py-16 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--gold-500)]" />
              <p className="text-sm text-muted-foreground">טוען הזמנה…</p>
            </CardContent>
          )}

          {state.kind === "invalid" && (
            <StateCard
              icon={<AlertTriangle className="h-8 w-8 text-[#E6B4BC]" />}
              title="הזמנה לא נמצאה"
              description="הקישור אינו תקין או שההזמנה נמחקה."
            />
          )}
          {state.kind === "expired" && (
            <StateCard
              icon={<AlertTriangle className="h-8 w-8 text-[#E6B4BC]" />}
              title="ההזמנה פגה"
              description="הקישור היה בתוקף 30 יום. פנה למנהל הטיול לקבלת הזמנה חדשה."
            />
          )}
          {state.kind === "cancelled" && (
            <StateCard
              icon={<AlertTriangle className="h-8 w-8 text-[#E6B4BC]" />}
              title="ההזמנה בוטלה"
              description="מנהל הטיול ביטל את ההזמנה הזו."
            />
          )}
          {state.kind === "already_accepted" && (
            <div className="p-8 text-center space-y-4">
              <Check className="h-12 w-12 text-[#C8D5A8] mx-auto" />
              <h2 className="font-serif text-2xl font-bold">כבר הצטרפת לטיול</h2>
              <Button
                onClick={() => router.push(`/trip/${state.tripId}`)}
                className="w-full rounded-full gradient-gold text-white border-0"
              >
                מעבר לטיול
              </Button>
            </div>
          )}
          {state.kind === "email_mismatch" && (
            <div className="p-8 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-[#E6B4BC] mx-auto" />
              <h2 className="font-serif text-xl font-bold">אימייל לא תואם</h2>
              <p className="text-sm text-muted-foreground">
                ההזמנה נשלחה ל-
                <strong dir="ltr" className="inline-block mx-1">{state.invitedEmail}</strong>
                אך התחברת עם אימייל אחר.
              </p>
              <Button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push(`/login?redirect=/invite/accept/${token}`);
                }}
                variant="outline"
                className="w-full rounded-full"
              >
                התחבר עם אימייל אחר
              </Button>
            </div>
          )}

          {state.kind === "ready" && (
            <>
              <CardHeader className="text-center space-y-4 pt-10">
                <div className="mx-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-[var(--gold-200)] font-serif italic">
                  <span className="h-px w-6 bg-[var(--gold-500)]" />
                  הזמנה לטיול
                  <span className="h-px w-6 bg-[var(--gold-500)]" />
                </div>
                <CardTitle className="font-serif text-4xl font-black leading-[1] tracking-tight">
                  {state.tripName}
                </CardTitle>
                <CardDescription className="text-base font-serif space-y-1">
                  <span className="flex items-center justify-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-[var(--gold-500)]" />
                    {state.destination}
                  </span>
                  <span className="flex items-center justify-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5 text-[var(--gold-500)]" />
                    {new Date(state.startDate).toLocaleDateString("he-IL")} — {new Date(state.endDate).toLocaleDateString("he-IL")}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pb-10 pt-2">
                <p className="text-center text-sm text-muted-foreground">
                  <strong className="text-foreground">{state.inviterName}</strong> הזמין/ה אותך להצטרף.
                </p>

                {state.message && (
                  <blockquote className="text-sm italic px-4 py-3 border-r-2 border-[var(--gold-500)] bg-[var(--gold-500)]/5 rounded-lg font-serif">
                    {state.message}
                  </blockquote>
                )}

                <Button
                  onClick={accept}
                  disabled={accepting}
                  className="w-full rounded-full gradient-gold text-white border-0 h-12 text-base font-medium shadow-[0_4px_20px_-6px_rgba(212,169,96,0.6)]"
                >
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="ml-1.5 h-4 w-4" />
                      אשר הצטרפות
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  לאחר האישור תתבקש למלא את הרכב המשפחה (שמות + גילאים) ותועבר לטיול.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

function StateCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      {icon}
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
