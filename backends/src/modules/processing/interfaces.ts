export interface TranscodeJobData {
  materialId: string;
  fileUrl: string;
  courseId: string;
  originalMimeType: string;
  autoTranscribe?: boolean;
}

export interface CaptionsJobData {
  materialId: string;
  fileUrl: string;
  courseId: string;
  autoTranscribe?: boolean;
}

export interface TranscriptJobData {
  materialId: string;
  captionsText: string;
  courseId: string;
}

export interface WcagJobData {
  materialId: string;
  materialType: string;
  courseId: string;
  hasVideo: boolean;
  hasCaptions: boolean;
  hasTranscript: boolean;
  fileUrl: string | null;
  mimeType?: string;
}
