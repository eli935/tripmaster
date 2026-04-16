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
): Promise<{ success: boolean; pendingApproval: boolean }> {
  const supabase = createClient();

  if (isAdmin) {
    // Direct delete (soft) + approve
    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_approved: true,
        deletion_approved_by: userId,
        deletion_reason: reason || null,
      })
      .eq("id", recordId);

    if (!error) {
      await supabase.from("audit_log").insert({
        trip_id: tripId,
        table_name: table,
        record_id: recordId,
        action: "delete_approve",
        actor_id: userId,
        notes: reason,
      });
    }

    return { success: !error, pendingApproval: false };
  } else {
    // Request — not approved yet
    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_approved: false,
        deletion_reason: reason || null,
      })
      .eq("id", recordId);

    if (!error) {
      await supabase.from("audit_log").insert({
        trip_id: tripId,
        table_name: table,
        record_id: recordId,
        action: "delete_request",
        actor_id: userId,
        notes: reason,
      });
    }

    return { success: !error, pendingApproval: true };
  }
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
