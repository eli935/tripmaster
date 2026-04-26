import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🚪</div>
        <h1 className="text-2xl font-bold">אין גישה כרגע</h1>
        <p className="text-muted-foreground leading-relaxed">
          הגישה למערכת פתוחה רק למי שיש לו טיול פעיל או טיול שהסתיים בשבעת
          הימים האחרונים. אם יש לך טיול שמתוכנן בעתיד — תקבל גישה אוטומטית
          ברגע שמנהל הטיול יוסיף אותך כמשתתף.
        </p>
        {user?.email && (
          <p className="text-xs text-muted-foreground">
            מחובר כ: <span dir="ltr">{user.email}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            חזרה לדף הבית
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
