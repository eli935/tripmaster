"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Plane className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">TripMaster</CardTitle>
          <CardDescription>מנהל טיולים משפחתיים</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h3 className="text-lg font-semibold">בדוק את המייל!</h3>
              <p className="text-muted-foreground">
                שלחנו לינק כניסה ל-<strong>{email}</strong>
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
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שולח...
                  </>
                ) : (
                  "שלח לינק כניסה"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                נשלח לינק חד פעמי למייל — בלי סיסמה
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
