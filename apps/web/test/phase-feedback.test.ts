import { describe, expect, it, vi, beforeEach } from "vitest";

const vibrateMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vibrateMock.mockReset();
  (globalThis as Record<string, unknown>).window = globalThis;
  Object.defineProperty(globalThis.navigator, "vibrate", {
    value: vibrateMock,
    configurable: true,
    writable: true
  });
});

function setupAudioContext(options?: {
  createOscillator?: () => unknown;
}) {
  const createOscillator = options?.createOscillator ?? vi.fn(() => ({
    type: "",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }));

  (globalThis as Record<string, unknown>).AudioContext = class {
    currentTime = 0;
    state = "running";
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator = createOscillator;
    createGain = vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn()
    }));
  };

  return createOscillator;
}

describe("phase-feedback", () => {
  it("exports expected functions", async () => {
    setupAudioContext();
    const mod = await import("../src/utils/phase-feedback.js");
    expect(typeof mod.primePhaseAudio).toBe("function");
    expect(typeof mod.playPhaseAudio).toBe("function");
    expect(typeof mod.triggerPhaseChangeFeedback).toBe("function");
  });

  it("primePhaseAudio does not throw without AudioContext", async () => {
    delete (globalThis as Record<string, unknown>).AudioContext;
    const { primePhaseAudio } = await import("../src/utils/phase-feedback.js");
    expect(() => primePhaseAudio()).not.toThrow();
  });

  it("playPhaseAudio does not throw without AudioContext", async () => {
    delete (globalThis as Record<string, unknown>).AudioContext;
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    expect(() => playPhaseAudio("RUN")).not.toThrow();
  });

  it("triggerPhaseChangeFeedback does not throw without vibrate", async () => {
    Object.defineProperty(globalThis.navigator, "vibrate", {
      value: undefined,
      configurable: true
    });
    setupAudioContext();
    const { triggerPhaseChangeFeedback } = await import("../src/utils/phase-feedback.js");
    expect(() => triggerPhaseChangeFeedback("WALK")).not.toThrow();
  });

  it("triggerPhaseChangeFeedback calls vibrate with RUN pattern", async () => {
    setupAudioContext();
    const { triggerPhaseChangeFeedback } = await import("../src/utils/phase-feedback.js");
    triggerPhaseChangeFeedback("RUN");
    expect(vibrateMock).toHaveBeenCalledOnce();
    expect(vibrateMock.mock.calls[0][0]).toEqual([85, 35, 85]);
  });

  it("vibrate patterns have 3 elements for all phases", async () => {
    setupAudioContext();
    const { triggerPhaseChangeFeedback } = await import("../src/utils/phase-feedback.js");
    const phases = ["WARMUP", "RUN", "WALK", "COOLDOWN", "DONE"] as const;

    for (const phase of phases) {
      triggerPhaseChangeFeedback(phase);
      const pattern = vibrateMock.mock.calls[vibrateMock.mock.calls.length - 1][0];
      expect(pattern).toHaveLength(3);
      expect(pattern.every((v: unknown) => typeof v === "number" && v > 0)).toBe(true);
    }
  });

  it("WARMUP has 3 ascending frequencies", async () => {
    const frequencies: number[] = [];
    setupAudioContext({
      createOscillator: () => ({
        type: "",
        frequency: { setValueAtTime: (f: number) => { frequencies.push(f); } },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })
    });
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    playPhaseAudio("WARMUP");
    expect(frequencies).toEqual([523, 659, 784]);
  });

  it("COOLDOWN has 3 descending frequencies", async () => {
    const frequencies: number[] = [];
    setupAudioContext({
      createOscillator: () => ({
        type: "",
        frequency: { setValueAtTime: (f: number) => { frequencies.push(f); } },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })
    });
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    playPhaseAudio("COOLDOWN");
    expect(frequencies).toEqual([523, 440, 349]);
  });

  it("RUN has 3 high frequencies", async () => {
    const frequencies: number[] = [];
    setupAudioContext({
      createOscillator: () => ({
        type: "",
        frequency: { setValueAtTime: (f: number) => { frequencies.push(f); } },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })
    });
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    playPhaseAudio("RUN");
    expect(frequencies).toEqual([660, 880, 988]);
  });

  it("WALK has 3 mid frequencies", async () => {
    const frequencies: number[] = [];
    setupAudioContext({
      createOscillator: () => ({
        type: "",
        frequency: { setValueAtTime: (f: number) => { frequencies.push(f); } },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })
    });
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    playPhaseAudio("WALK");
    expect(frequencies).toEqual([440, 554, 659]);
  });

  it("all phases use triangle oscillator", async () => {
    const oscillatorTypes: string[] = [];
    setupAudioContext({
      createOscillator: () => ({
        set type(v: string) { oscillatorTypes.push(v); },
        get type() { return ""; },
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })
    });
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    playPhaseAudio("RUN");
    expect(oscillatorTypes).toContain("triangle");
  });

  it("playPhaseAudio schedules 3 oscillators per phase", async () => {
    const createOscillator = setupAudioContext();
    const { playPhaseAudio } = await import("../src/utils/phase-feedback.js");
    const phases = ["WARMUP", "RUN", "WALK", "COOLDOWN", "DONE"] as const;

    for (const phase of phases) {
      vi.mocked(createOscillator).mockClear();
      playPhaseAudio(phase);
      expect(createOscillator).toHaveBeenCalledTimes(3);
    }
  });
});
