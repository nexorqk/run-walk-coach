import type { WorkoutPhase } from "@run-walk-coach/shared";

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let audioContext: AudioContext | undefined;

const phaseTones: Record<WorkoutPhase, number[]> = {
  WARMUP: [523, 659, 784],
  RUN: [660, 880, 988],
  WALK: [440, 554, 659],
  COOLDOWN: [523, 440, 349],
  DONE: [523, 659, 784]
};

const phaseVibrations: Record<WorkoutPhase, number[]> = {
  WARMUP: [80, 40, 80],
  RUN: [85, 35, 85],
  WALK: [80, 40, 80],
  COOLDOWN: [80, 40, 80],
  DONE: [100, 45, 100]
};

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextConstructor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextConstructor) {
    return undefined;
  }

  audioContext = new AudioContextConstructor();
  return audioContext;
}

export function primePhaseAudio() {
  const context = getAudioContext();

  if (!context || context.state !== "suspended") {
    return;
  }

  void context.resume().catch(() => undefined);
}

function scheduleTone(context: AudioContext, phase: WorkoutPhase) {
  const tones = phaseTones[phase];
  const duration = 0.1;
  const gap = 0.09;
  const volume = 0.075;
  const startAt = context.currentTime + 0.025;

  tones.forEach((frequency, index) => {
    const toneStart = startAt + index * gap;
    const toneEnd = toneStart + duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(volume, toneStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd + 0.03);
  });
}

export function playPhaseAudio(phase: WorkoutPhase) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    void context
      .resume()
      .then(() => scheduleTone(context, phase))
      .catch(() => undefined);
    return;
  }

  scheduleTone(context, phase);
}

export function triggerPhaseChangeFeedback(phase: WorkoutPhase) {
  navigator.vibrate?.(phaseVibrations[phase]);
  playPhaseAudio(phase);
}
