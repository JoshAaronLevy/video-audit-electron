export type JobStatus = 'idle' | 'starting' | 'running' | 'complete' | 'error' | 'canceled';

export interface JobStartResponse {
  jobId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
}

export interface JobProgress {
  jobId: string | null;
  status: JobStatus;
  phase: string | null;
  message: string | null;
  currentFile?: string | null;
  totalItems?: number | null;
  processedItems?: number;
  error?: string | null;
}

export interface JobResultBase {
  jobId: string;
  status: Extract<JobStatus, 'complete' | 'error' | 'canceled'>;
  message?: string;
}

export interface JobError {
  status: 'invalid_request' | 'not_found' | 'error' | string;
  message: string;
  jobId?: string;
}
