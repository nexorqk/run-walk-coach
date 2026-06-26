import { describe, expect, it } from "vitest";
import {
  deriveAvgPaceSecPerKm,
  deriveAvgSpeedKmh,
  formatDistanceMeters,
  formatPaceSecPerKm,
  parseDistanceKmToMeters,
  parsePaceToSecPerKm
} from "../src/utils/running-metrics.js";

describe("running metrics helpers", () => {
  it("parses and formats pace as minutes per kilometer", () => {
    expect(parsePaceToSecPerKm("5:45")).toBe(345);
    expect(formatPaceSecPerKm(345)).toBe("5:45/km");
  });

  it("converts distance and derives pace and speed from duration", () => {
    const distanceMeters = parseDistanceKmToMeters("3.2");

    expect(distanceMeters).toBe(3200);
    expect(formatDistanceMeters(distanceMeters)).toBe("3.20 km");
    expect(deriveAvgPaceSecPerKm(distanceMeters, 1800)).toBe(563);
    expect(deriveAvgSpeedKmh(distanceMeters, 1800)).toBe(6.4);
  });
});
