import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/boot/route";

describe("api/boot trampoline", () => {
  it("unregisters the service worker then opens a safe shell path", async () => {
    const response = await GET(
      new Request("https://novend-pos.vercel.app/api/boot?entry=/dashboard"),
    );
    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("location.replace(target)");
    expect(html).toContain("/dashboard?fromBoot=1");
    expect(html).toContain("serviceWorker");
  });

  it("ignores an external entry", async () => {
    const response = await GET(
      new Request("https://novend-pos.vercel.app/api/boot?entry=https://evil.example/phish"),
    );
    const html = await response.text();
    expect(html).toContain("/dashboard?fromBoot=1");
    expect(html).not.toContain("evil.example");
  });
});
