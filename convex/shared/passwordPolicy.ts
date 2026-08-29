/** Server + client password rules. Keep in sync with signup/reset UI meters. */

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 12 characters and include uppercase, lowercase, and a number";

export function passwordMeetsPolicy(password: string): boolean {
  return (
    Boolean(password) &&
    password.length >= PASSWORD_MIN_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function assertPasswordPolicy(password: string): void {
  if (!passwordMeetsPolicy(password)) {
    throw new Error(PASSWORD_POLICY_MESSAGE);
  }
}

export type PasswordCheck = {
  id: "length" | "upper" | "lower" | "number";
  label: string;
  ok: boolean;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  accepted: boolean;
  checks: PasswordCheck[];
};

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Strong", "Excellent"] as const;

export function passwordStrength(password: string): PasswordStrength {
  const checks: PasswordCheck[] = [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: "upper", label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { id: "lower", label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
  ];
  const passed = checks.filter((check) => check.ok).length;
  const bonus = passed === 4 && (password.length >= 16 || /[^A-Za-z0-9]/.test(password));
  const score = (bonus ? 4 : Math.min(passed, 3)) as PasswordStrength["score"];
  return {
    score,
    label: STRENGTH_LABELS[score],
    accepted: passed === 4,
    checks,
  };
}
