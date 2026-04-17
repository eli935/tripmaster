"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Shield, UserCog, Check } from "lucide-react";
import { toast } from "sonner";
import {
  ROLE_LABELS,
  PERMISSION_GROUPS,
  defaultPermissionsForRole,
  type Role,
  type TripPermission,
} from "@/lib/permissions";
import type { TripParticipant } from "@/lib/supabase/types";

interface PermissionsManagerProps {
  tripId: string;
  participants: TripParticipant[];
  permissions: TripPermission[];
}

export function PermissionsManager({ tripId, participants, permissions }: PermissionsManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Map permissions by profile_id
  const permsByProfile: Record<string, TripPermission | undefined> = {};
  permissions.forEach((p) => {
    permsByProfile[p.profile_id] = p;
  });

  async function updateRole(participantId: string, profileId: string, role: Role) {
    setSaving(profileId);

    // Update role
    await supabase
      .from("trip_participants")
      .update({ role })
      .eq("id", participantId);

    // Update or create permissions with defaults
    const defaults = defaultPermissionsForRole(role);
    const existing = permsByProfile[profileId];

    if (existing) {
      await supabase.from("trip_permissions").update(defaults).eq("id", existing.id);
    } else {
      await supabase.from("trip_permissions").insert({
        trip_id: tripId,
        profile_id: profileId,
        ...defaults,
      });
    }

    setSaving(null);
    toast.success("ההרשאה עודכנה");
    router.refresh();
  }

  async function togglePermission(profileId: string, key: string, value: boolean) {
    const existing = permsByProfile[profileId];
    if (!existing) return;

    setSaving(profileId);
    await supabase
      .from("trip_permissions")
      .update({ [key]: value })
      .eq("id", existing.id);
    setSaving(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-400" />
          ניהול הרשאות
        </CardTitle>
        <CardDescription>קבע מי רואה מה ומי יכול לערוך</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {participants.map((p) => {
          const profile = p.profile as any;
          const perms = permsByProfile[p.profile_id];
          const isOpen = expanded === p.profile_id;
          const roleInfo = ROLE_LABELS[p.role as Role] || ROLE_LABELS.member;

          return (
            <div key={p.id} className="rounded-2xl glass overflow-hidden">
              {/* Participant header */}
              <button
                onClick={() => setExpanded(isOpen ? null : p.profile_id)}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-semibold text-blue-400">
                    {profile?.full_name?.charAt(0) || "?"}
                  </div>
                  <div className="text-start">
                    <div className="text-sm font-medium">{profile?.full_name}</div>
                    <Badge className={`${roleInfo.color} border-0 text-xs`}>
                      {roleInfo.emoji} {roleInfo.label}
                    </Badge>
                  </div>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </button>

              {/* Expanded permissions */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-4 border-t border-border/50">
                      {/* Role selector */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">תפקיד</label>
                        <Select
                          value={p.role}
                          onValueChange={(v) => v && updateRole(p.id, p.profile_id, v as Role)}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue>
                              {(v: unknown) => {
                                const info = ROLE_LABELS[v as Role];
                                return info ? `${info.emoji} ${info.label}` : "משתתף";
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([key, val]) => (
                              <SelectItem key={key} value={key}>
                                {val.emoji} {val.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Granular permissions */}
                      {perms && (
                        <>
                          {PERMISSION_GROUPS.map((group) => (
                            <div key={group.title}>
                              <div className="text-xs text-muted-foreground mb-2 font-medium">
                                {group.title}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {group.perms.map((perm) => {
                                  const key = perm.key as keyof TripPermission;
                                  const value = (perms as any)[key] as boolean;
                                  return (
                                    <label
                                      key={perm.key}
                                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={value}
                                        onCheckedChange={(v) =>
                                          togglePermission(p.profile_id, perm.key, !!v)
                                        }
                                      />
                                      <span className="text-xs">{perm.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {saving === p.profile_id && (
                        <div className="text-xs text-green-400 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          נשמר
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
