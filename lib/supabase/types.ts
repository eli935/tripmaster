export type HolidayType = "pesach" | "sukkot" | "rosh_hashana" | "shavuot" | "regular";
export type TripStatus = "planning" | "active" | "completed" | "review";
export type ParticipantRole = "admin" | "member";
export type EquipmentStatus = "pending" | "packed" | "loaded" | "arrived";
export type DayType = "erev_chag" | "chag" | "shabbat" | "shabbat_chol_hamoed" | "chol_hamoed" | "chol";
export type MealType = "breakfast" | "lunch" | "dinner" | "seuda_1" | "seuda_2" | "seuda_3";
export type FoodCategory = "meat" | "dairy" | "vegetables" | "dry" | "frozen" | "parve" | "other";
export type SplitType = "equal" | "per_person" | "custom" | "private";
export type ExpenseCategory = "flights" | "accommodation" | "car" | "food" | "equipment" | "attractions" | "other";
export type TripType = "private" | "family" | "friends" | "client";
export type LocationType = "domestic" | "international";
export type MarkupType = "none" | "percent" | "fixed";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  adults: number;
  children: { name: string; age: number }[];
  created_at: string;
}

export type TripPace = "slow" | "balanced" | "packed";
export type TripTransport = "rental_car" | "taxi" | "walking" | "mixed";
export type MealStyle = "restaurant" | "self_cooking" | "mixed";

export interface TripPreferences {
  pace?: TripPace;
  interests?: string[];
  transport?: TripTransport;
  daily_start?: string;
  daily_end?: string;
  siesta?: boolean;
  meals?: {
    style?: MealStyle;
    cuisines?: string[];
    kosher_level?: string;
  };
  budget_per_day?: number;
  generated_at?: string;
}

export type PlanItemType = "attraction" | "meal" | "travel" | "rest";

export interface PlanItem {
  time: string;
  type: PlanItemType;
  title: string;
  duration_min?: number;
  attraction_id?: string | null;
  description?: string | null;
  vendor?: { name?: string; phone?: string; whatsapp?: string; maps_url?: string; notes?: string } | null;
  verified?: boolean;
  notes?: string | null;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  country_code: string;
  start_date: string;
  end_date: string;
  holiday_type: HolidayType;
  status: TripStatus;
  created_by: string;
  created_at: string;
  trip_type?: TripType;
  location_type?: LocationType;
  admin_participates?: boolean;
  markup_type?: MarkupType | null;
  markup_value?: number | null;
  accommodation_name?: string | null;
  accommodation_address?: string | null;
  accommodation_lat?: number | null;
  accommodation_lng?: number | null;
  outbound_flight_number?: string | null;
  outbound_flight_datetime?: string | null;
  outbound_airport?: string | null;
  outbound_terminal?: string | null;
  return_flight_number?: string | null;
  return_flight_datetime?: string | null;
  return_airport?: string | null;
  return_terminal?: string | null;
  preferences?: TripPreferences | null;
}

export interface TripParticipant {
  id: string;
  trip_id: string;
  profile_id: string;
  role: ParticipantRole;
  adults: number;
  children: number;
  joined_at: string;
  profile?: Profile;
}

export interface EquipmentTemplate {
  id: string;
  holiday_type: HolidayType;
  name: string;
  category: string;
  quantity_per_person: number;
  unit: string;
  is_shared: boolean;
  notes: string | null;
}

export interface TripEquipment {
  id: string;
  trip_id: string;
  template_id: string | null;
  name: string;
  quantity: number;
  assigned_to: string | null;
  status: EquipmentStatus;
  notes: string | null;
  template?: EquipmentTemplate;
  assignee?: Profile;
}

export interface DayBooking {
  booking_id: string;
  attraction_id: string | null;
  attraction_name: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  website_url?: string | null;
  waze_url?: string | null;
  gmaps_url?: string | null;
  time?: string | null;
  duration_minutes?: number | null;
  order_index?: number;
  user_notes?: string | null;
  created_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  date: string;
  hebrew_date: string;
  day_type: DayType;
  notes: string | null;
  bookings?: DayBooking[];
  generated_plan?: PlanItem[];
  meals?: Meal[];
}

export interface Meal {
  id: string;
  trip_day_id: string;
  meal_type: MealType;
  name: string;
  description: string | null;
  servings: number;
  attendees_count?: number | null;
  recipe_id?: string | null;
  time?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  items?: MealItem[];
}

export interface MealRecipe {
  id: string;
  name: string;
  description: string | null;
  ingredients: Array<{ name: string; quantity_per_person: number; unit: string }>;
  instructions: string | null;
  source: "ai" | "manual" | "library";
  created_by: string | null;
  trip_id: string | null;
  content_hash: string | null;
  created_at: string;
}

export interface MealItem {
  id: string;
  meal_id: string;
  ingredient: string;
  quantity: number;
  unit: string;
  category: FoodCategory;
}

export interface ShoppingItem {
  id: string;
  trip_id: string;
  ingredient: string;
  total_quantity: number;
  unit: string;
  category: FoodCategory;
  is_purchased: boolean;
  purchased_by: string | null;
  price: number | null;
  purchased_at: string | null;
}

export interface Expense {
  id: string;
  trip_id: string;
  paid_by: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  split_type: SplitType;
  receipt_url: string | null;
  created_at: string;
  payer?: Profile;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  profile_id: string;
  amount: number;
  profile?: Profile;
}

export interface LessonLearned {
  id: string;
  trip_id: string;
  category: string;
  content: string;
  action: string;
  item_ref: string | null;
  created_by: string;
  created_at: string;
}

// Use `any` for the Database generic until `supabase gen types` generates the real type.
// Run: npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
// Then replace this alias.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
