/** Why an account cannot be set inactive. Null means the change is allowed. */
export function deactivateAccountBlockReason(args: {
  actorUserId: string;
  targetUserId: string;
  ownerUserId?: string | null;
  presence: "online" | "offline";
}): string | null {
  if (args.targetUserId === args.actorUserId) {
    return "You cannot deactivate your own account.";
  }
  if (args.ownerUserId && args.targetUserId === args.ownerUserId) {
    return "The organization owner cannot be deactivated.";
  }
  if (args.presence === "online") {
    return "This user is signed in. Ask them to sign out before setting the account inactive.";
  }
  return null;
}
