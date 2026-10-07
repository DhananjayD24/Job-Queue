export interface JobData {
  id: string;
  name: string;
  data: Record<string, unknown>;

  attemptsMade: number;
  maxAttempts: number;

  priority: number;

  createdAt: number;
  scheduledAt: number;

  failedReason?: string;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;

  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
}