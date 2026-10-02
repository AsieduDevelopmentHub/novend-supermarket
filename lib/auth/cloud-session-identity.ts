export type CloudSessionIdentity = {
  userId: string;
  organizationId?: string | null;
};

export type CloudSessionIdentityState = "not-required" | "checking" | "matched" | "mismatch";

/**
 * A remembered offline identity remains authoritative until the cloud proves
 * that its current session belongs to the same user and organization.
 */
export function getCloudSessionIdentityState(input: {
  online: boolean;
  isAuthenticated: boolean;
  localIdentity: CloudSessionIdentity | null;
  /** undefined means users.me is still loading; null means it resolved empty. */
  cloudIdentity: CloudSessionIdentity | null | undefined;
}): CloudSessionIdentityState {
  if (!input.online || !input.isAuthenticated || !input.localIdentity?.userId) {
    return "not-required";
  }
  if (input.cloudIdentity === undefined) return "checking";
  if (!input.cloudIdentity?.userId) return "mismatch";
  if (String(input.cloudIdentity.userId) !== String(input.localIdentity.userId)) {
    return "mismatch";
  }

  const localOrganizationId = input.localIdentity.organizationId
    ? String(input.localIdentity.organizationId)
    : null;
  if (
    localOrganizationId &&
    String(input.cloudIdentity.organizationId ?? "") !== localOrganizationId
  ) {
    return "mismatch";
  }
  return "matched";
}
