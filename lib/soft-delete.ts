import { createClient } from "./supabase/client";

/**
 * Request a soft delete. If user is admin, approves immediately.
 * Else marks for review.
 */
export async function requestSoftDelete(
  table: string,
  recordId: string,
  tripId: string,
  userId: string,
  isAdmin: boolean,
  reason?: string
): Promise<{ success: boolean; pendingApproval: boolean; error?: string }> {
  const supabase = createClient();

  const patch = isAdmin
    ? {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_approved: true,
        deletion_approved_by: userId,
        deletion_reason: reason || null,
      }
    : {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_approved: false,
        deletion_reason: reason || null,
      };

  const { error: updateErr } = await supabase.from(table).update(patch).eq("id", recordId);
  if (updateErr) {
    console.error("[soft-delete] update failed", { table, recordId, updateErr });
    return {
      success: false,
      pendingApproval: !isAdmin,
      error: updateErr.message,
    };
  }

  // Audit log is best-effort — if RLS blocks the insert we still consider
  // the delete successful. The UI truth is in the row's deleted_at.
  const { error: auditErr } = await supabase.from("audit_log").insert({
    trip_id: tripId,
    table_name: table,
    record_id: recordId,
    action: isAdmin ? "delete_approve" : "delete_request",
    actor_id: userId,
    notes: reason,
  });
  if (auditErr) {
    console.warn("[soft-delete] audit log insert failed (non-fatal)", auditErr);
  }

  return { success: true, pendingApproval: !isAdmin };
}

/**
 * Admin approves a pending deletion
 */
export async function approveSoftDelete(
  table: string,
  recordId: string,
  tripId: string,
  adminId: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from(table)
    .update({ deletion_approved: true, deletion_approved_by: adminId })
    .eq("id", recordId);

  if (!error) {
    await supabase.from("audit_log").insert({
      trip_id: tripId,
      table_name: table,
      record_id: recordId,
      action: "delete_approve",
      actor_id: adminId,
    });
  }
  return !error;
}

/**
 * Admin rejects deletion (restores)
 */
export async function rejectSoftDelete(
  table: string,
  recordId: string,
  tripId: string,
  adminId: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from(table)
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_approved: null,
      deletion_reason: null,
    })
    .eq("id", recordId);

  if (!error) {
    await supabase.from("audit_log").insert({
      trip_id: tripId,
      table_name: table,
      record_id: recordId,
      action: "delete_reject",
      actor_id: adminId,
    });
  }
  return !error;
}
