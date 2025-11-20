export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  REVIEW = 'REVIEW',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface NoteSession {
  id: string;
  timestamp: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number; // in seconds
  notes: string | null;
  topic?: string;
}

export interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}