"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lightbulb,
  Plus,
  Trash2,
  PackagePlus,
  PackageMinus,
  TrendingUp,
  TrendingDown,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import type { LessonLearned } from "@/lib/supabase/types";

const CATEGORIES = [
  { value: "equipment", label: "ציוד", emoji: "🎒" },
  { value: "food", label: "אוכל", emoji: "🍽️" },
  { value: "logistics", label: "לוגיסטיקה", emoji: "🚗" },
  { value: "accommodation", label: "דירה/מלון", emoji: "🏠" },
  { value: "general", label: "כללי", emoji: "💡" },
];

const ACTIONS = [
  { value: "add", label: "להוסיף", icon: PackagePlus, color: "text-green-600" },
  { value: "remove", label: "להוריד", icon: PackageMinus, color: "text-red-600" },
  { value: "increase", label: "להגדיל כמות", icon: TrendingUp, color: "text-blue-600" },
  { value: "decrease", label: "להקטין כמות", icon: TrendingDown, color: "text-orange-600" },
  { value: "note", label: "הערה", icon: MessageSquare, color: "text-gray-600" },
];

interface LessonsLearnedProps {
  lessons: LessonLearned[];
  tripId: string;
  userId: string;
}

export function LessonsLearnedTab({ lessons, tripId, userId }: LessonsLearnedProps) {
  const router = useRouter();
  const supabase = createClient();
  const [adding, setAdding] = useState(false);

  const [category, setCategory] = useState("general");
  const [action, setAction] = useState("note");
  const [content, setContent] = useState("");
  const [itemRef, setItemRef] = useState("");

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("lessons_learned").insert({
      trip_id: tripId,
      created_by: userId,
      category,
      action,
      content,
      item_ref: itemRef || null,
    });
    setContent("");
    setItemRef("");
    setAdding(false);
    router.refresh();
    toast.success("לקח נשמר!");
  }

  async function deleteLesson(id: string) {
    await supabase.from("lessons_learned").delete().eq("id", id);
    router.refresh();
  }

  // Group by category
  const grouped: Record<string, LessonLearned[]> = {};
  lessons.forEach((l) => {
    if (!grouped[l.category]) grouped[l.category] = [];
    grouped[l.category].push(l);
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            הפקת לקחים
          </h2>
          <p className="text-xs text-muted-foreground">
            מה עבד? מה לשפר? הלקחים יעדכנו את התבניות לטיול הבא.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="ml-1 h-4 w-4" />
          הוסף לקח
        </Button>
      </div>

      {/* Add Form */}
      {adding && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={addLesson} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">קטגוריה</Label>
                  <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.emoji} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">פעולה</Label>
                  <Select value={action} onValueChange={(v) => v && setAction(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {action !== "note" && (
                <div className="space-y-1">
                  <Label className="text-xs">פריט (אופציונלי)</Label>
                  <Input
                    value={itemRef}
                    onChange={(e) => setItemRef(e.target.value)}
                    placeholder='למשל "תנור נייד", "חלות"'
                    className="h-9"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">תוכן הלקח</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="מה למדנו? מה לשנות בפעם הבאה?"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1">שמור</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  ביטול
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lessons by Category */}
      {Object.entries(grouped).map(([cat, catLessons]) => {
        const catInfo = CATEGORIES.find((c) => c.value === cat);
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{catInfo?.emoji || "💡"}</span>
                {catInfo?.label || cat}
                <Badge variant="secondary" className="text-xs">{catLessons.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catLessons.map((lesson) => {
                const actionInfo = ACTIONS.find((a) => a.value === lesson.action);
                const ActionIcon = actionInfo?.icon || MessageSquare;

                return (
                  <div key={lesson.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                    <ActionIcon className={`h-4 w-4 mt-0.5 shrink-0 ${actionInfo?.color || ""}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{lesson.content}</div>
                      {lesson.item_ref && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          פריט: {lesson.item_ref}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-red-400"
                      onClick={() => deleteLesson(lesson.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {lessons.length === 0 && !adding && (
        <Card className="text-center py-8">
          <CardContent>
            <Lightbulb className="mx-auto h-10 w-10 text-yellow-400 mb-3" />
            <p className="text-muted-foreground">
              עדיין לא נרשמו לקחים. אחרי הטיול, שבו יחד ורשמו מה עבד ומה לשפר!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
