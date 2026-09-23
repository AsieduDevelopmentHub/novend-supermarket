import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_IMAGES_POLICY,
  PRODUCT_IMAGES_DISABLED_MESSAGE,
  PRODUCT_IMAGES_SETTINGS_KEY,
  assertProductImageUploadsEnabled,
  canAttachProductImage,
  parseProductImagesPolicy,
} from "@/convex/shared/productImagesPolicy";

describe("productImagesPolicy", () => {
  it("defaults to uploads enabled", () => {
    expect(DEFAULT_PRODUCT_IMAGES_POLICY).toEqual({ enabled: true });
    expect(PRODUCT_IMAGES_SETTINGS_KEY).toBe("catalog.productImages");
  });

  it("parses missing or invalid JSON as enabled", () => {
    expect(parseProductImagesPolicy(undefined).enabled).toBe(true);
    expect(parseProductImagesPolicy("{").enabled).toBe(true);
    expect(parseProductImagesPolicy("{}").enabled).toBe(true);
  });

  it("parses explicit enabled flags", () => {
    expect(parseProductImagesPolicy(JSON.stringify({ enabled: false })).enabled).toBe(false);
    expect(parseProductImagesPolicy(JSON.stringify({ enabled: true })).enabled).toBe(true);
  });

  it("gates attaching new images while allowing clear", () => {
    expect(canAttachProductImage({ enabled: true })).toBe(true);
    expect(canAttachProductImage({ enabled: false })).toBe(false);
    expect(() => assertProductImageUploadsEnabled({ enabled: true })).not.toThrow();
    expect(() => assertProductImageUploadsEnabled({ enabled: false })).toThrow(
      PRODUCT_IMAGES_DISABLED_MESSAGE,
    );
  });
});
