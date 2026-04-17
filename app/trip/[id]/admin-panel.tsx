"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Trash2,
  RotateCcw,
  Check,
  X,
  FileText,
  Clock,
  GitBranch,
  ChevronDown,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { approveSoftDelete, rejectSoftDelete } from "@/lib/soft-delete";
import type { AuditLog, AppVersion } from "@/lib/types-v8";
import { InviteManager } from "./invite-manager";

interface AdminPanelProps {
  tripId: string;
  userId: string;
  tripName: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  insert: { label: "נוסף", color: "bg-green-500/20 text-green-400", icon: Check },
  update: { label: "עודכן", color: "bg-blue-500/20 text-blue-400", icon: RotateCcw },
  delete_request: { label: "בקשת מחיקה", color: "bg-amber-500/20 text-amber-400", icon: Clock },
  delete_approve: { label: "מחיקה אושרה", color: "bg-red-500/20 text-red-400", icon: Trash2 },
  delete_reject: { label: "מחיקה נדחתה", color: "bg-gray-500/20 text-gray-400", icon: X },
  restore: { label: "שוחזר", color: "bg-green-500/20 text-green-400", icon: RotateCcw },
};

const TABLE_LABELS: Record<string, string> = {
  expenses: "הוצאות",
  shopping_items: "קניות",
  trip_equipment: "ציוד",
  meals: "ארוחות",
  trip_files: "קבצים",
  trips: "טיול",
};

export function AdminPanel({ tripId, userId, tripName }: AdminPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [pendingDeletes, setPendingDeletes] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<"pending" | "audit" | "versions">("pending");

  useEffect(() => {
    loadData();
  }, [tripId]);

  async function loadData() {
    setLoading(true);

    // Pending delete requests across all tables
    const tables = ["expenses", "shopping_items", "trip_equipment", "meals", "trip_files"];
    const pending: any[] = [];

    for (const tbl of tables) {
      try {
        const { data } = await supabase
          .from(tbl)
          .select("*, deleter:profiles!deleted_by(full_name)")
          .eq(tbl === "meals" ? "trip_id" : "trip_id", tripId)
          .eq("deletion_approved", false)
          .not("deleted_at", "is", null);

        if (data) {
          pending.push(...data.map((d: any) => ({ ...d, _table: tbl })));
        }
      } catch {}
    }
    setPendingDeletes(pending);

    // Audit log
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*, actor:profiles!actor_id(full_name)")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(100);
    setAuditLogs(logs || []);

    // Versions
    const { data: vers } = await supabase
      .from("app_versions")
      .select("*")
      .order("deployed_at", { ascending: false });
    setVersions(vers || []);

    setLoading(false);
  }

  async function handleApprove(item: any) {
    const ok = await approveSoftDelete(item._table, item.id, tripId, userId);
    if (ok) {
      toast.success("המחיקה אושרה");
      loadData();
      router.refresh();
    } else {
      toast.error("שגיאה");
    }
  }

  async function handleReject(item: any) {
    const ok = await rejectSoftDelete(item._table, item.id, tripId, userId);
    if (ok) {
      toast.success("המחיקה נדחתה והפריט שוחזר");
      loadData();
      router.refresh();
    } else {
      toast.error("שגיאה");
    }
  }

  const getItemLabel = (item: any) => {
    if (item.description) return item.description;
    if (item.name) return item.name;
    if (item.ingredient) return item.ingredient;
    if (item.file_name) return item.file_name;
    return "פריט";
  };

  return (
    <div className="space-y-4">
      {/* Section: Invitations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 font-serif">
            <Shield className="h-4 w-4 text-[var(--gold-500)]" />
            הזמנות משתתפים
          </CardTitle>
          <CardDescription className="text-xs">
            הזמן אחרים באימייל להצטרף לטיול. הם יקבלו מייל עם קישור, וייכנסו כמשתתפים לאחר אישור.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteManager tripId={tripId} tripName={tripName} />
        </CardContent>
      </Card>

      {/* Section: Pending Deletions */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpandedSection(expandedSection === "pending" ? "versions" : "pending")}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              מחיקות ממתינות לאישור
              {pendingDeletes.length > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border-0">
                  {pendingDeletes.length}
                </Badge>
              )}
            </CardTitle>
            <motion.div animate={{ rotate: expandedSection === "pending" ? 180 : 0 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {expandedSection === "pending" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent className="space-y-2">
                {pendingDeletes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    אין מחיקות ממתינות
                  </p>
                ) : (
                  pendingDeletes.map((item) => (
                    <motion.div
                      key={`${item._table}-${item.id}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass rounded-xl p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge variant="secondary" className="text-xs mb-1">
                            {TABLE_LABELS[item._table]}
                          </Badge>
                          <div className="text-sm font-medium truncate">
                            {getItemLabel(item)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ביקש: {item.deleter?.full_name} ·{" "}
                            {new Date(item.deleted_at).toLocaleDateString("he-IL")}
                          </div>
                          {item.deletion_reason && (
                            <div className="text-xs text-amber-400 mt-1">
                              💬 {item.deletion_reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleApprove(item)}
                        >
                          <Trash2 className="ml-1 h-3 w-3" />
                          אשר מחיקה
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleReject(item)}
                        >
                          <RotateCcw className="ml-1 h-3 w-3" />
                          שחזר
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Section: Audit Log */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpandedSection(expandedSection === "audit" ? "pending" : "audit")}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              לוג פעולות
              <Badge variant="secondary" className="text-xs">
                {auditLogs.length}
              </Badge>
            </CardTitle>
            <motion.div animate={{ rotate: expandedSection === "audit" ? 180 : 0 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {expandedSection === "audit" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => {
                    const info = ACTION_LABELS[log.action] || { label: log.action, color: "", icon: FileText };
                    return (
                      <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 text-xs">
                        <div className={`${info.color} p-1 rounded`}>
                          <info.icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">{(log as any).actor?.full_name || "מערכת"}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {info.label}
                            </Badge>
                            <span className="text-muted-foreground">
                              {TABLE_LABELS[log.table_name] || log.table_name}
                            </span>
                          </div>
                          {log.notes && <div className="text-muted-foreground mt-0.5">💬 {log.notes}</div>}
                          <div className="text-muted-foreground text-[10px] mt-0.5">
                            {new Date(log.created_at).toLocaleString("he-IL")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Section: Version History */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpandedSection(expandedSection === "versions" ? "audit" : "versions")}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-400" />
              היסטוריית גרסאות
              <Badge variant="secondary" className="text-xs">
                {versions.length}
              </Badge>
            </CardTitle>
            <motion.div animate={{ rotate: expandedSection === "versions" ? 180 : 0 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {expandedSection === "versions" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent>
                <div className="relative pl-6 space-y-4">
                  {/* Timeline line */}
                  <div className="absolute top-2 bottom-2 right-2 w-0.5 bg-border" />
                  {versions.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="relative"
                    >
                      {/* Dot */}
                      <div className="absolute -right-[22px] top-1 h-3 w-3 rounded-full gradient-blue" />
                      <div className="glass rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">{v.version}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.deployed_at).toLocaleDateString("he-IL")}
                          </span>
                        </div>
                        <div className="font-medium text-sm mt-1">{v.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{v.description}</div>
                        {v.changes && Array.isArray(v.changes) && v.changes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {v.changes.map((c: string, j: number) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
