import { describe, expect, it } from "vitest";

describe("isAllowedOrigin", () => {
  it("allows only configured origins", async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
    const { isAllowedOrigin } = await import("../src/security.js");

    expect(isAllowedOrigin("https://app.example.com", ["https://app.example.com"])).toBe(true);
    expect(isAllowedOrigin("https://evil.example.com", ["https://app.example.com"])).toBe(false);
    expect(isAllowedOrigin(undefined, ["https://app.example.com"])).toBe(false);
  });
});
