/**
 * v8 types: multi-payer, soft delete, audit, messages, versions
 */

export interface ExpensePayer {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number;
  created_at: string;
  profile?: { full_name: string };
}

export interface AuditLog {
  id: string;
  trip_id: string | null;
  table_name: string;
  record_id: string;
  action: "insert" | "update" | "delete_request" | "delete_approve" | "delete_reject" | "restore";
  actor_id: string;
  old_data: any;
  new_data: any;
  notes: string | null;
  created_at: string;
  actor?: { full_name: string };
}

export interface TripMessage {
  id: string;
  trip_id: string;
  sender_id: string;
  content: string;
  reply_to: string | null;
  edited_at: string | null;
  created_at: string;
  sender?: { full_name: string };
}

export interface AppVersion {
  id: string;
  version: string;
  title: string;
  description: string;
  changes: string[];
  git_sha: string | null;
  deployed_at: string;
}

export interface SoftDeletable {
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_approved: boolean | null;
  deletion_reason?: string | null;
}
