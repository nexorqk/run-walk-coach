import type { BreathingLevel, HeartRateZone, PainType } from "@run-walk-coach/shared";

export type CoachInsightSession = {
  date: string;
  completed: boolean;
  totalDurationSec: number;
  totalRunSec: number;
  avgHr?: number | null;
  maxHr?: number | null;
  stopwatchPulseBpm?: number | null;
  heartRateZone?: HeartRateZone | null;
  distanceMeters?: number | null;
  avgPaceSecPerKm?: number | null;
  avgSpeedKmh?: number | null;
  cadenceSpm?: number | null;
  difficulty: number;
  breathing: BreathingLevel;
  pain: PainType;
};

export type CoachInsightCode =
  | "no-data"
  | "pain"
  | "hard-load"
  | "hr-high"
  | "efficiency-up"
  | "efficiency-drift"
  | "cadence-low"
  | "cadence-good"
  | "distance-consistency";

export type CoachInsight = {
  code: CoachInsightCode;
  severity: "good" | "info" | "caution" | "danger";
  value?: number;
};

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pulseForSession(session: CoachInsightSession) {
  return session.maxHr ?? session.stopwatchPulseBpm ?? session.avgHr ?? null;
}

function sortRecent(sessions: CoachInsightSession[]) {
  return [...sessions]
    .filter((session) => session.completed)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function buildCoachInsights({
  easyHrMax,
  sessions
}: {
  easyHrMax: number;
  sessions: CoachInsightSession[];
}): CoachInsight[] {
  const recent = sortRecent(sessions);

  if (recent.length === 0) {
    return [{ code: "no-data", severity: "info" }];
  }

  const latest = recent[0];
  const insights: CoachInsight[] = [];
  const latestPulse = pulseForSession(latest);

  if (latest.pain !== "NONE") {
    insights.push({ code: "pain", severity: "danger" });
  }

  if (latest.difficulty >= 8 || latest.breathing === "VERY_HARD") {
    insights.push({ code: "hard-load", severity: "caution", value: latest.difficulty });
  }

  if (
    (latestPulse !== null && latestPulse > easyHrMax + 15) ||
    latest.heartRateZone === "ZONE_4" ||
    latest.heartRateZone === "ZONE_5"
  ) {
    insights.push({ code: "hr-high", severity: "caution", value: latestPulse ?? undefined });
  }

  const pacePulseSessions = recent.filter(
    (session) => session.avgPaceSecPerKm !== null && session.avgPaceSecPerKm !== undefined && pulseForSession(session) !== null
  );
  const latestThree = pacePulseSessions.slice(0, 3);
  const previousThree = pacePulseSessions.slice(3, 6);

  if (latestThree.length >= 2 && previousThree.length >= 2) {
    const latestPace = average(latestThree.map((session) => session.avgPaceSecPerKm as number));
    const previousPace = average(previousThree.map((session) => session.avgPaceSecPerKm as number));
    const latestHr = average(latestThree.map((session) => pulseForSession(session) as number));
    const previousHr = average(previousThree.map((session) => pulseForSession(session) as number));

    if (latestPace !== null && previousPace !== null && latestHr !== null && previousHr !== null) {
      const paceDelta = latestPace - previousPace;
      const hrDelta = latestHr - previousHr;

      if (paceDelta <= -10 && hrDelta <= 3) {
        insights.push({ code: "efficiency-up", severity: "good", value: Math.abs(Math.round(paceDelta)) });
      } else if (paceDelta <= 10 && hrDelta >= 8) {
        insights.push({ code: "efficiency-drift", severity: "caution", value: Math.round(hrDelta) });
      }
    }
  }

  if (latest.cadenceSpm !== null && latest.cadenceSpm !== undefined) {
    if (latest.cadenceSpm < 155) {
      insights.push({ code: "cadence-low", severity: "info", value: latest.cadenceSpm });
    } else if (latest.cadenceSpm <= 175) {
      insights.push({ code: "cadence-good", severity: "good", value: latest.cadenceSpm });
    }
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const distanceSessions = recent.filter(
    (session) =>
      new Date(session.date) >= twoWeeksAgo &&
      session.distanceMeters !== null &&
      session.distanceMeters !== undefined &&
      session.distanceMeters > 0
  );

  if (distanceSessions.length >= 3) {
    const totalDistanceMeters = distanceSessions.reduce((sum, session) => sum + (session.distanceMeters ?? 0), 0);
    insights.push({
      code: "distance-consistency",
      severity: "good",
      value: Math.round(totalDistanceMeters / 1000)
    });
  }

  return insights.slice(0, 4);
}
