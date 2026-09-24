export type PlatformActionStatus = "idle" | "error" | "success" | "confirmed";

export type PlatformActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  retryMode?: "same-operation" | "new-operation";
  status: PlatformActionStatus;
};

export type PlatformIdentityActionState = PlatformActionState & {
  email?: string;
  identityExists?: boolean;
};
