import type { VideoStyle } from "./minimax";

export interface Job {
  id: string;
  createdAt: number;
  userId?: string | null;
  userEmail?: string | null;
  chargedCents?: number;
  status: "uploading" | "processing" | "success" | "failed";
  style: VideoStyle;
  styleLabel: string;
  userNotes?: string;
  imageUrls: string[];
  coverImageUrl: string;
  minimaxTaskId?: string;
  videoUrl?: string;
  resolution: "768P" | "1080P";
  duration: 6 | 10;
  error?: string;
}
