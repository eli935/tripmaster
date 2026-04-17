"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Trash2,
  Save,
  Loader2,
  UserMinus,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Trip, TripParticipant, TripStatus, HolidayType } from "@/lib/supabase/types";

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "planning", label: "בתכנון" },
  { value: "active", label: "פעיל" },
  { value: "completed", label: "הסתיים" },
  { value: "review", label: "הפקת לקחים" },
];

interface TripSettingsProps {
  trip: Trip;
  participants: TripParticipant[];
  userId: string;
  isAdmin: boolean;
}

export function TripSettings({ trip, participants, userId, isAdmin }: TripSettingsProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination);
  const [status, setStatus] = useState<TripStatus>(trip.status as TripStatus);
  const [startDate, setStartDate] = useState(trip.start_date);
  const [endDate, setEndDate] = useState(trip.end_date);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("trips")
      .update({ name, destination, status, start_date: startDate, end_date: endDate })
      .eq("id", trip.id);

    setSaving(false);

    if (error) {
      toast.error("שגיאה בשמירה");
      return;
    }

    toast.success("הטיול עודכן!");
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    if (error) {
      toast.error("שגיאה במחיקה");
      setDeleting(false);
      return;
    }
    toast.success("הטיול נמחק");
    router.push("/dashboard");
  }

  async function removeParticipant(participantId: string, profileId: string) {
    if (profileId === trip.created_by) {
      toast.error("לא ניתן להסיר את יוצר הטיול");
      return;
    }

    const { error } = await supabase
      .from("trip_participants")
      .delete()
      .eq("id", participantId);

    if (error) {
      toast.error("שגיאה בהסרת משתתף");
      return;
    }

    toast.success("המשתתף הוסר");
    router.refresh();
  }

  async function updateParticipantCounts(
    participantId: string,
    adults: number,
    children: number
  ) {
    await supabase
      .from("trip_participants")
      .update({ adults, children })
      .eq("id", participantId);
    router.refresh();
  }

  async function leaveTrip() {
    await supabase
      .from("trip_participants")
      .delete()
      .eq("trip_id", trip.id)
      .eq("profile_id", userId);
    toast.success("עזבת את הטיול");
    router.push("/dashboard");
  }

  return (
    <div className="space-y-4">
      {/* Trip Details (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              הגדרות טיול
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>שם הטיול</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>יעד</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TripStatus)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v: unknown) => {
                        const opt = STATUS_OPTIONS.find((o) => o.value === v);
                        return opt ? opt.label : "בתכנון";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>תאריך התחלה</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך סיום</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {saving ? "שומר..." : "שמור שינויים"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Participant Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ניהול משתתפים</CardTitle>
          <CardDescription>עדכן מספר נפשות או הסר משתתפים</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {participants.map((p) => {
            const profile = p.profile as any;
            const isCreator = p.profile_id === trip.created_by;
            const isSelf = p.profile_id === userId;

            return (
              <div key={p.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-medium text-blue-400">
                      {profile?.full_name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{profile?.full_name}</span>
                      {isCreator && (
                        <Badge variant="outline" className="mr-1 text-xs">מנהל</Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin && !isCreator && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 h-8 w-8"
                      onClick={() => removeParticipant(p.id, p.profile_id)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Edit counts — admin or self */}
                {(isAdmin || isSelf) && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">מבוגרים</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={p.adults}
                        onChange={(e) =>
                          updateParticipantCounts(p.id, parseInt(e.target.value) || 1, p.children)
                        }
                        className="h-8 text-sm"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">ילדים</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={p.children}
                        onChange={(e) =>
                          updateParticipantCounts(p.id, p.adults, parseInt(e.target.value) || 0)
                        }
                        className="h-8 text-sm"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Leave Trip (non-admin) */}
      {!isAdmin && (
        <Card>
          <CardContent className="pt-4">
            <Button variant="outline" className="w-full text-red-400" onClick={leaveTrip}>
              עזיבת הטיול
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Trip (admin only) */}
      {isAdmin && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              אזור מסוכן
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!deleteConfirm ? (
              <Button
                variant="outline"
                className="w-full text-red-400 border-red-200"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="ml-2 h-4 w-4" />
                מחק טיול
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-400">
                  בטוח? הפעולה תמחק את הטיול וכל הנתונים שלו לצמיתות.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "מוחק..." : "כן, מחק"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
