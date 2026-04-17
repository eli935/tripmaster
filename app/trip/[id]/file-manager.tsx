"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload,
  Camera,
  FileText,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  Eye,
  ImagePlus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  uploadTripFile,
  uploadThumbnail,
  formatFileSize,
  FILE_CATEGORIES,
  type FileCategory,
  type TripFile,
} from "@/lib/file-upload";

interface FileManagerProps {
  files: TripFile[];
  tripId: string;
  userId: string;
}

export function FileManager({ files, tripId, userId }: FileManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<FileCategory>("document");
  const [description, setDescription] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const descTrimmed = description.trim();
  const hasFiles = pendingFiles.length > 0;
  const hasDesc = descTrimmed.length > 0;
  const hasThumb = thumbFile !== null;
  const canSubmit = hasFiles && hasDesc && hasThumb && !uploading;

  function handleMainFileSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      setPendingFiles([]);
      return;
    }
    setPendingFiles(Array.from(fileList));
  }

  function handleThumbSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const f = fileList[0];
    if (!f.type.startsWith("image/")) {
      toast.error("יש לבחור קובץ תמונה בלבד");
      return;
    }
    setThumbFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setThumbPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function resetForm() {
    setPendingFiles([]);
    setThumbFile(null);
    setThumbPreview(null);
    setDescription("");
    setShowErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }

  async function handleSubmit() {
    setShowErrors(true);
    if (!canSubmit || !thumbFile) {
      toast.error("יש למלא את כל השדות החובה");
      return;
    }

    setUploading(true);

    // 1) Upload thumbnail once, reuse URL for all files
    const thumbUrl = await uploadThumbnail(thumbFile, tripId);
    if (!thumbUrl) {
      setUploading(false);
      toast.error("שגיאה בהעלאת התמונה הממוזערת");
      return;
    }

    // 2) Upload each file with mandatory description + image_url
    let uploaded = 0;
    for (const file of pendingFiles) {
      const result = await uploadTripFile(
        file,
        tripId,
        userId,
        category,
        descTrimmed,
        thumbUrl
      );
      if (result) uploaded++;
    }

    setUploading(false);

    if (uploaded > 0) {
      toast.success(`${uploaded} קבצים הועלו בהצלחה`);
      resetForm();
      router.refresh();
    } else {
      toast.error("שגיאה בהעלאה");
    }
  }

  // Group files by category
  const grouped: Record<string, TripFile[]> = {};
  files.forEach((f) => {
    const cat = f.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(f);
  });

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card className="border-dashed border-2 border-border/50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <Upload className="h-7 w-7 text-blue-400" />
              </div>
              <h3 className="font-semibold">העלאת קבצים</h3>
              <p className="text-xs text-muted-foreground">
                כרטיסי טיסה, חוזי מלון, חשבוניות, תמונות
              </p>
              <p className="text-[11px] text-[var(--gold-500,#d4af37)]">
                כל השדות המסומנים ב-<span className="text-red-400 font-bold">*</span> הם חובה
              </p>
            </div>

            {/* Category */}
            <div className="max-w-md mx-auto space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">קטגוריה</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v as FileCategory)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue>
                      {(v: unknown) => {
                        const info = FILE_CATEGORIES[v as FileCategory];
                        return info ? `${info.emoji} ${info.label}` : "אחר";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FILE_CATEGORIES).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val.emoji} {val.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Required: File selection */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  קובץ <span className="text-red-400 font-bold">*</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-xl flex-1"
                  >
                    <Paperclip className="ml-2 h-4 w-4" />
                    בחר קובץ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-xl flex-1"
                  >
                    <Camera className="ml-2 h-4 w-4" />
                    צלם
                  </Button>
                </div>
                {hasFiles ? (
                  <p className="text-[11px] text-emerald-400">
                    נבחרו {pendingFiles.length} קבצים: {pendingFiles.map((f) => f.name).join(", ")}
                  </p>
                ) : showErrors ? (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> חובה לבחור קובץ אחד לפחות
                  </p>
                ) : null}
              </div>

              {/* Required: Description */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  תיאור / מה זה? <span className="text-red-400 font-bold">*</span>
                </Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="למשל: כרטיסי טיסה הלוך-חזור רומא ליולי 2026"
                  rows={2}
                  className="w-full rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-500,#d4af37)]/50"
                />
                {!hasDesc && showErrors && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> חובה להזין תיאור
                  </p>
                )}
              </div>

              {/* Required: Thumbnail image */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  תמונה ממוזערת <span className="text-red-400 font-bold">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={uploading}
                    className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-border/60 bg-background/40 flex items-center justify-center overflow-hidden hover:border-[var(--gold-500,#d4af37)]/60 transition"
                  >
                    {thumbPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbPreview} alt="thumb" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => thumbInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl w-full"
                    >
                      {thumbFile ? "החלפת תמונה" : "בחר תמונה"}
                    </Button>
                    {thumbFile ? (
                      <p className="text-[11px] text-emerald-400 mt-1 truncate">
                        {thumbFile.name}
                      </p>
                    ) : showErrors ? (
                      <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" /> חובה לצרף תמונה
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        התמונה תוצג בכרטיס הקובץ
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full rounded-xl gradient-gold text-black font-semibold"
              >
                {uploading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" /> מעלה...
                  </>
                ) : (
                  <>
                    <Upload className="ml-2 h-4 w-4" /> העלה קובץ
                  </>
                )}
              </Button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleMainFileSelect(e.target.files)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleMainFileSelect(e.target.files)}
            />
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleThumbSelect(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Files by Category */}
      {Object.entries(grouped).map(([cat, catFiles]) => {
        const catInfo = FILE_CATEGORIES[cat as FileCategory] || { label: cat, emoji: "📎" };
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{catInfo.emoji}</span>
                {catInfo.label}
                <Badge variant="secondary" className="text-xs">{catFiles.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-secondary rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail 64x64 with fallback icon */}
                    <div className="h-16 w-16 rounded-xl bg-card flex items-center justify-center shrink-0 overflow-hidden">
                      {file.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.image_url}
                          alt={file.file_name}
                          className="h-full w-full object-cover"
                        />
                      ) : file.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <ImageIcon className="h-6 w-6 text-blue-400" />
                      ) : (
                        <span className="text-2xl">{catInfo.emoji}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{file.file_name}</div>
                      {file.description && (
                        <div className="text-xs text-foreground/80 truncate">
                          {file.description}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(file.file_url, "_blank")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {files.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">עדיין לא הועלו קבצים</p>
        </div>
      )}
    </div>
  );
}
