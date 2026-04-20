"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/lib/supabase/types";

interface Child {
  name: string;
  age: number;
}

interface ProfileFormProps {
  profile: Profile | null;
  userId: string;
}

export function ProfileForm({ profile, userId }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [adults, setAdults] = useState(profile?.adults || 2);
  const [children, setChildren] = useState<Child[]>(
    (profile?.children as Child[]) || []
  );

  function addChild() {
    setChildren([...children, { name: "", age: 0 }]);
  }

  function removeChild(index: number) {
    setChildren(children.filter((_, i) => i !== index));
  }

  function updateChild(index: number, field: keyof Child, value: string | number) {
    const updated = [...children];
    updated[index] = { ...updated[index], [field]: value };
    setChildren(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/[^\d+]/g, "");
    if (cleanPhone.length < 9) {
      toast.error("טלפון חובה — לפחות 9 ספרות");
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: cleanPhone,
        adults,
        children: children.filter((c) => c.name.trim()),
      })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast.error("שגיאה בשמירה", { description: error.message });
      return;
    }

    toast.success("הפרופיל עודכן!");
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowRight className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">הפרופיל שלי</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">פרטים אישיים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>שם מלא</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון (וואטסאפ) *</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+972501234567"
                dir="ltr"
                required
                className="text-left"
              />
              <p className="text-[11px] text-muted-foreground">
                חובה — נשלח לכם וואטסאפ עם סדר היום היומי בזמן הטיול.
              </p>
            </div>
            <div className="space-y-2">
              <Label>מספר מבוגרים במשפחה</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>

        {/* Children */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ילדים</CardTitle>
            <CardDescription>
              הוסף את הילדים שמשתתפים בטיולים (עוזר לחישוב כמויות)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {children.map((child, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">שם</Label>
                  <Input
                    value={child.name}
                    onChange={(e) => updateChild(idx, "name", e.target.value)}
                    placeholder="שם הילד/ה"
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">גיל</Label>
                  <Input
                    type="number"
                    min="0"
                    max="18"
                    value={child.age}
                    onChange={(e) =>
                      updateChild(idx, "age", parseInt(e.target.value) || 0)
                    }
                    dir="ltr"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChild(idx)}
                  className="text-red-500 hover:text-red-700 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addChild}
              className="w-full"
            >
              <Plus className="ml-1 h-4 w-4" />
              הוסף ילד/ה
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              שמור שינויים
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
