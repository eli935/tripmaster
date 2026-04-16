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
  Download,
  Trash2,
  Loader2,
  Paperclip,
  Image,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  uploadTripFile,
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
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<FileCategory>("document");
  const [description, setDescription] = useState("");

  async function handleFileSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(fileList)) {
      const result = await uploadTripFile(file, tripId, userId, category, description);
      if (result) uploaded++;
    }

    setUploading(false);
    setDescription("");

    if (uploaded > 0) {
      toast.success(`${uploaded} קבצים הועלו בהצלחה`);
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
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <Upload className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">העלאת קבצים</h3>
              <p className="text-xs text-muted-foreground mt-1">
                כרטיסי טיסה, חוזי מלון, חשבוניות, תמונות
              </p>
            </div>

            {/* Category + Description */}
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              <Select value={category} onValueChange={(v) => v && setCategory(v as FileCategory)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FILE_CATEGORIES).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {val.emoji} {val.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="תיאור (אופציונלי)"
                className="h-9 text-sm"
              />
            </div>

            {/* Upload Buttons */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl"
              >
                {uploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Paperclip className="ml-2 h-4 w-4" />}
                בחר קובץ
              </Button>
              <Button
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl"
              >
                <Camera className="ml-2 h-4 w-4" />
                צלם
              </Button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
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
                    <div className="h-10 w-10 rounded-lg bg-card flex items-center justify-center shrink-0">
                      {file.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <Image className="h-5 w-5 text-blue-400" />
                      ) : (
                        <FileText className="h-5 w-5 text-purple-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{file.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString("he-IL")}
                        {file.description && ` · ${file.description}`}
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
