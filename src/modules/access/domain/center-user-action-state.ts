export type CenterUserActionStatus = "idle" | "error" | "success" | "confirmed";

export type CenterUserActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  retryMode?: "same-operation" | "new-operation";
  status: CenterUserActionStatus;
};

export type CenterUserIdentityActionState = CenterUserActionState & {
  email?: string;
  identityExists?: boolean;
  firstName?: string;
  lastName?: string;
  membershipExists?: boolean;
  membershipIsActive?: boolean;
};
