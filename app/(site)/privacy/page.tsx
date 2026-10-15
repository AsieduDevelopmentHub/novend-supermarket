import { redirect } from "next/navigation";

/** Millie's is a local till — no public privacy marketing page. */
export default function PrivacyPage() {
  redirect("/login");
}
