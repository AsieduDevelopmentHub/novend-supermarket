import { describe, expect, it } from "vitest";
import { parseMobileDeepLink } from "@/lib/auth/mobile-deep-link";

const TRUSTED_ORIGIN = "https://novend-pos.vercel.app";

describe("mobile deep links", () => {
  it.each([
    ["novend://sale/abc_123", "/orders/abc_123"],
    ["novend://order/order-1", "/orders/order-1"],
    ["novend://product/product-1", "/products/product-1"],
    ["novend://dashboard", "/dashboard"],
    ["novend://sales", "/sales"],
    ["https://novend-pos.vercel.app/products/product-1", "/products/product-1"],
  ])("maps an approved link", (url, expected) => {
    expect(parseMobileDeepLink(url, TRUSTED_ORIGIN)).toBe(expected);
  });

  it.each([
    "//evil.example/products/1",
    "https://evil.example/products/1",
    "novend://unknown/products/1",
    "novend://sale",
    "novend://sale/a/b",
    "novend://sale/%2F%2Fevil.example",
    "novend://sale/../dashboard",
    "novend://product/id?redirect=https://evil.example",
    "novend://product/id#redirect",
    "javascript:alert(1)",
  ])("rejects an untrusted or malformed link", (url) => {
    expect(parseMobileDeepLink(url, TRUSTED_ORIGIN)).toBeNull();
  });
});
