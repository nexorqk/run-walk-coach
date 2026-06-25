import { describe, expect, it } from "vitest";
import { normalizeImportedSession, type ImportedSession } from "../src/utils/session-import.js";

const importedSession: ImportedSession = {
  date: "2026-06-25T04:00:00.000Z",
  completed: true,
  totalDurationSec: 1800,
  totalRunSec: 600,
  totalWalkSec: 900,
  difficulty: 5,
  breathing: "MEDIUM",
  pain: "NONE"
};

describe("normalizeImportedSession", () => {
  it("keeps server export sessions synced when importing with Google enabled", () => {
    const session = normalizeImportedSession(
      {
        ...importedSession,
        id: "server-session-id",
        template: {
          id: "template-1",
          userId: null,
          name: "Level 1 - 30 sec run / 90 sec walk",
          level: 1,
          type: "RUN_WALK",
          warmupSec: 600,
          runSec: 30,
          walkSec: 90,
          repeats: 12,
          cooldownSec: 300,
          isDefault: true,
          createdAt: "2026-06-25T04:00:00.000Z"
        }
      },
      "pending",
      () => "11111111-1111-4111-8111-111111111111"
    );

    expect(session.syncStatus).toBe("synced");
    expect(session.remoteId).toBe("server-session-id");
    expect(session.localId).toBe("11111111-1111-4111-8111-111111111111");
    expect(session.templateLevel).toBe(1);
  });

  it("keeps browser-only UUID sessions pending for Google sync", () => {
    const session = normalizeImportedSession(
      {
        ...importedSession,
        localId: "22222222-2222-4222-8222-222222222222"
      },
      "pending",
      () => "33333333-3333-4333-8333-333333333333"
    );

    expect(session.syncStatus).toBe("pending");
    expect(session.localId).toBe("22222222-2222-4222-8222-222222222222");
    expect(session.remoteId).toBeUndefined();
  });

  it("generates a UUID-compatible id for pending sessions with legacy ids", () => {
    const session = normalizeImportedSession(
      {
        ...importedSession,
        localId: "legacy-local-id"
      },
      "pending",
      () => "44444444-4444-4444-8444-444444444444"
    );

    expect(session.syncStatus).toBe("pending");
    expect(session.localId).toBe("44444444-4444-4444-8444-444444444444");
  });
});
