import { redirect } from "next/navigation";

/** Millie's is a local till — no public download marketing page. */
export default function DownloadPage() {
  redirect("/login");
}
