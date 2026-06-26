import { heartRateZoneValues, type HeartRateZone } from "@run-walk-coach/shared";
import { text, type AppLanguage } from "./language.js";

export { heartRateZoneValues };

export function parseOptionalFloat(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalInt(value: string) {
  const parsed = parseOptionalFloat(value);
  return parsed === null ? null : Math.round(parsed);
}

export function parseDistanceKmToMeters(value: string) {
  const km = parseOptionalFloat(value);
  return km === null ? null : Math.round(km * 1000);
}

export function distanceMetersToKmInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(Number((value / 1000).toFixed(2)));
}

export function parsePaceToSecPerKm(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(":")) {
    const [minutesRaw, secondsRaw] = trimmed.split(":");
    const minutes = Number(minutesRaw);
    const seconds = Number(secondsRaw);

    if (
      Number.isInteger(minutes) &&
      Number.isFinite(seconds) &&
      minutes >= 0 &&
      seconds >= 0 &&
      seconds < 60
    ) {
      const paceSec = Math.round(minutes * 60 + seconds);
      return paceSec >= 60 && paceSec <= 3600 ? paceSec : null;
    }

    return null;
  }

  const decimalMinutes = parseOptionalFloat(trimmed);
  if (decimalMinutes === null) {
    return null;
  }

  const paceSec = Math.round(decimalMinutes * 60);
  return paceSec >= 60 && paceSec <= 3600 ? paceSec : null;
}

export function paceSecPerKmToInput(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return formatPaceSecPerKm(value).replace("/km", "");
}

export function deriveAvgPaceSecPerKm(distanceMeters: number | null | undefined, totalDurationSec: number) {
  if (!distanceMeters || distanceMeters <= 0 || totalDurationSec <= 0) {
    return null;
  }

  return Math.round(totalDurationSec / (distanceMeters / 1000));
}

export function deriveAvgSpeedKmh(distanceMeters: number | null | undefined, totalDurationSec: number) {
  if (!distanceMeters || distanceMeters <= 0 || totalDurationSec <= 0) {
    return null;
  }

  const km = distanceMeters / 1000;
  return Number((km / (totalDurationSec / 3600)).toFixed(1));
}

export function formatDistanceMeters(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  const km = value / 1000;
  return `${km >= 10 ? km.toFixed(1) : km.toFixed(2)} km`;
}

export function formatPaceSecPerKm(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

export function formatSpeedKmh(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value.toFixed(1)} km/h`;
}

export function formatCadenceSpm(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${value} spm`;
}

export function heartRateZoneLabel(value: HeartRateZone, language: AppLanguage) {
  const labels: Record<HeartRateZone, Record<AppLanguage, string>> = {
    ZONE_1: { en: "Zone 1 · recovery", ru: "Зона 1 · восстановление" },
    ZONE_2: { en: "Zone 2 · aerobic", ru: "Зона 2 · аэробная" },
    ZONE_3: { en: "Zone 3 · steady", ru: "Зона 3 · умеренная" },
    ZONE_4: { en: "Zone 4 · hard", ru: "Зона 4 · тяжёлая" },
    ZONE_5: { en: "Zone 5 · max", ru: "Зона 5 · максимум" }
  };

  return text(language, labels[value]);
}

export function heartRateZoneShortLabel(value: HeartRateZone | null | undefined, language: AppLanguage) {
  if (!value) {
    return "-";
  }

  const labels: Record<HeartRateZone, Record<AppLanguage, string>> = {
    ZONE_1: { en: "Z1", ru: "З1" },
    ZONE_2: { en: "Z2", ru: "З2" },
    ZONE_3: { en: "Z3", ru: "З3" },
    ZONE_4: { en: "Z4", ru: "З4" },
    ZONE_5: { en: "Z5", ru: "З5" }
  };

  return text(language, labels[value]);
}
