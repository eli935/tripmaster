/**
 * Permissions system
 * Hierarchy: super_admin > admin > manager > member > viewer
 */

export type Role = "admin" | "manager" | "member" | "viewer";

export interface TripPermission {
  id: string;
  trip_id: string;
  profile_id: string;
  can_see_destination: boolean;
  can_see_overview: boolean;
  can_see_meals: boolean;
  can_see_equipment: boolean;
  can_see_shopping: boolean;
  can_see_expenses: boolean;
  can_see_files: boolean;
  can_see_lessons: boolean;
  can_see_other_expenses: boolean;
  can_edit_trip: boolean;
  can_edit_participants: boolean;
  can_edit_meals: boolean;
  can_edit_equipment: boolean;
  can_edit_shopping: boolean;
  can_edit_expenses: boolean;
  can_upload_files: boolean;
}

export const ROLE_LABELS: Record<Role, { label: string; color: string; emoji: string }> = {
  admin: { label: "מנהל טיול", color: "bg-purple-500/20 text-purple-400", emoji: "👑" },
  manager: { label: "מנהל משני", color: "bg-blue-500/20 text-blue-400", emoji: "🔧" },
  member: { label: "משתתף", color: "bg-green-500/20 text-green-400", emoji: "👤" },
  viewer: { label: "צפייה בלבד", color: "bg-gray-500/20 text-gray-400", emoji: "👁️" },
};

/**
 * Default permissions by role
 */
export function defaultPermissionsForRole(role: Role): Partial<TripPermission> {
  switch (role) {
    case "admin":
      return {
        can_see_destination: true,
        can_see_overview: true,
        can_see_meals: true,
        can_see_equipment: true,
        can_see_shopping: true,
        can_see_expenses: true,
        can_see_files: true,
        can_see_lessons: true,
        can_see_other_expenses: true,
        can_edit_trip: true,
        can_edit_participants: true,
        can_edit_meals: true,
        can_edit_equipment: true,
        can_edit_shopping: true,
        can_edit_expenses: true,
        can_upload_files: true,
      };
    case "manager":
      return {
        can_see_destination: true,
        can_see_overview: true,
        can_see_meals: true,
        can_see_equipment: true,
        can_see_shopping: true,
        can_see_expenses: true,
        can_see_files: true,
        can_see_lessons: true,
        can_see_other_expenses: true,
        can_edit_trip: false,
        can_edit_participants: false,
        can_edit_meals: true,
        can_edit_equipment: true,
        can_edit_shopping: true,
        can_edit_expenses: true,
        can_upload_files: true,
      };
    case "member":
      return {
        can_see_destination: true,
        can_see_overview: true,
        can_see_meals: true,
        can_see_equipment: true,
        can_see_shopping: true,
        can_see_expenses: true,
        can_see_files: true,
        can_see_lessons: true,
        can_see_other_expenses: false, // only own expenses
        can_edit_trip: false,
        can_edit_participants: false,
        can_edit_meals: false,
        can_edit_equipment: false,
        can_edit_shopping: true,
        can_edit_expenses: true,
        can_upload_files: true,
      };
    case "viewer":
      return {
        can_see_destination: true,
        can_see_overview: true,
        can_see_meals: true,
        can_see_equipment: true,
        can_see_shopping: true,
        can_see_expenses: false,
        can_see_files: true,
        can_see_lessons: true,
        can_see_other_expenses: false,
        can_edit_trip: false,
        can_edit_participants: false,
        can_edit_meals: false,
        can_edit_equipment: false,
        can_edit_shopping: false,
        can_edit_expenses: false,
        can_upload_files: false,
      };
  }
}

export const PERMISSION_GROUPS = [
  {
    title: "הרשאות צפייה",
    perms: [
      { key: "can_see_destination", label: "יעד ומידע מקומי" },
      { key: "can_see_overview", label: "סקירת טיול" },
      { key: "can_see_meals", label: "ארוחות" },
      { key: "can_see_equipment", label: "ציוד" },
      { key: "can_see_shopping", label: "קניות" },
      { key: "can_see_expenses", label: "הוצאות" },
      { key: "can_see_other_expenses", label: "הוצאות של משפחות אחרות" },
      { key: "can_see_files", label: "קבצים ומסמכים" },
      { key: "can_see_lessons", label: "הפקת לקחים" },
    ],
  },
  {
    title: "הרשאות עריכה",
    perms: [
      { key: "can_edit_trip", label: "עריכת פרטי טיול" },
      { key: "can_edit_participants", label: "ניהול משתתפים" },
      { key: "can_edit_meals", label: "עריכת ארוחות" },
      { key: "can_edit_equipment", label: "עריכת ציוד" },
      { key: "can_edit_shopping", label: "הוספת קניות" },
      { key: "can_edit_expenses", label: "הוספת הוצאות" },
      { key: "can_upload_files", label: "העלאת קבצים" },
    ],
  },
] as const;
