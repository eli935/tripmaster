import { createClient } from "./supabase/client";

export type FileCategory =
  | "flight_ticket"
  | "hotel_contract"
  | "attraction_booking"
  | "receipt"
  | "insurance"
  | "photo"
  | "document"
  | "other";

export const FILE_CATEGORIES: Record<FileCategory, { label: string; emoji: string }> = {
  flight_ticket: { label: "כרטיס טיסה", emoji: "✈️" },
  hotel_contract: { label: "הסכם מלון/דירה", emoji: "🏨" },
  attraction_booking: { label: "הזמנת אטרקציה", emoji: "🎡" },
  receipt: { label: "חשבונית/קבלה", emoji: "🧾" },
  insurance: { label: "ביטוח", emoji: "🛡️" },
  photo: { label: "תמונה", emoji: "📷" },
  document: { label: "מסמך", emoji: "📄" },
  other: { label: "אחר", emoji: "📎" },
};

export interface TripFile {
  id: string;
  trip_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number;
  category: FileCategory;
  description: string;
  image_url: string | null;
  created_at: string;
}

/**
 * Upload a thumbnail image to Supabase Storage under <tripId>/thumbs/.
 * Returns the public URL, or null on failure.
 */
export async function uploadThumbnail(
  imageFile: File,
  tripId: string
): Promise<string | null> {
  const supabase = createClient();
  const ext = imageFile.name.split(".").pop() || "jpg";
  const thumbPath = `${tripId}/thumbs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: thumbErr } = await supabase.storage
    .from("trip-files")
    .upload(thumbPath, imageFile, { cacheControl: "3600", upsert: false });

  if (thumbErr) {
    console.error("Thumb upload error:", thumbErr);
    return null;
  }

  const { data: thumbUrl } = supabase.storage
    .from("trip-files")
    .getPublicUrl(thumbPath);

  return thumbUrl.publicUrl;
}

/**
 * Upload a file to Supabase Storage and create a DB record.
 * Strict: description and image_url are MANDATORY.
 */
export async function uploadTripFile(
  file: File,
  tripId: string,
  userId: string,
  category: FileCategory,
  description: string,
  imageUrl: string
): Promise<TripFile | null> {
  // Server-side-ish validation (runs in the browser before DB insert)
  if (!description || description.trim().length === 0) {
    console.error("Upload blocked: description is required");
    return null;
  }
  if (!imageUrl || imageUrl.trim().length === 0) {
    console.error("Upload blocked: image_url is required");
    return null;
  }

  const supabase = createClient();

  // Generate unique filename
  const ext = file.name.split(".").pop();
  const fileName = `${tripId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  // Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from("trip-files")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("trip-files")
    .getPublicUrl(fileName);

  // Insert record in DB
  const { data, error } = await supabase
    .from("trip_files")
    .insert({
      trip_id: tripId,
      uploaded_by: userId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      category,
      description: description.trim(),
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error) {
    console.error("DB error:", error);
    return null;
  }

  return data;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
