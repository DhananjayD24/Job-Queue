export interface CreateJobInput {
    type: string;
    payload: Record<string, unknown>;
    priority?: number;
    maxAttempts?: number;
    runAt?: Date;
  }
  
  export interface Job {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    status: string;
    priority: number;
    attempts: number;
    max_attempts: number;
    run_at: Date;
    locked_at: Date | null;
    locked_by: string | null;
    last_error: string | null;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }