import { describe, expect, it } from "vitest";
import { isMediaStoreUri, toNativeFilePath, toShareableFileUri } from "@novend/hardware";

describe("Capacitor file URIs", () => {
  it("unwraps hosted _capacitor_file_ URLs to a filesystem path", () => {
    expect(
      toNativeFilePath("https://localhost/_capacitor_file_/data/user/0/com.novend.pos/cache/r.pdf"),
    ).toBe("/data/user/0/com.novend.pos/cache/r.pdf");
  });

  it("builds a file:// URI Share and FileProvider can use", () => {
    expect(
      toShareableFileUri(
        "https://localhost/_capacitor_file_/data/user/0/com.novend.pos/cache/r.pdf",
      ),
    ).toBe("file:///data/user/0/com.novend.pos/cache/r.pdf");
    expect(toShareableFileUri("file:///data/user/0/com.novend.pos/cache/r.pdf")).toBe(
      "file:///data/user/0/com.novend.pos/cache/r.pdf",
    );
  });

  it("does not treat Downloads content URIs as shareable cache files", () => {
    expect(isMediaStoreUri("content://media/external/downloads/12")).toBe(true);
    expect(isMediaStoreUri("file:///data/user/0/com.novend.pos/cache/r.pdf")).toBe(false);
  });
});
