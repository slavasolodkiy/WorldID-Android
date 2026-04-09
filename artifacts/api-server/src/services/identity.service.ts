import { db, identityTable, credentialsTable, verificationSessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AppError } from "../middlewares/error";

export type VerificationLevel = "none" | "device" | "orb";

const LEVEL_RANK: Record<VerificationLevel, number> = { none: 0, device: 1, orb: 2 };

export class IdentityService {
  static async getIdentity(identityId: number) {
    const [identity] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, identityId))
      .limit(1);

    if (!identity) throw new AppError("Identity not found", 404, "IDENTITY_NOT_FOUND");
    return identity;
  }

  static async getCredentials(identityId: number) {
    return db
      .select()
      .from(credentialsTable)
      .where(eq(credentialsTable.identityId, identityId))
      .orderBy(credentialsTable.issuedAt);
  }

  /**
   * Initiate a new verification session.
   *
   * Idempotent: if the user already has a pending, non-expired session at the
   * requested level, the existing session is returned rather than creating a
   * duplicate (aligned with Apple's lifecycle model).
   */
  static async initiateVerification(identityId: number, level: VerificationLevel) {
    const validLevels: VerificationLevel[] = ["device", "orb"];
    if (!validLevels.includes(level)) {
      throw new AppError(`Invalid verification level: ${level}`, 400, "INVALID_LEVEL");
    }

    const now = new Date();

    // Return existing pending, non-expired session if one exists
    const [existing] = await db
      .select()
      .from(verificationSessionsTable)
      .where(
        and(
          eq(verificationSessionsTable.identityId, identityId),
          eq(verificationSessionsTable.level, level),
          eq(verificationSessionsTable.status, "pending"),
          gt(verificationSessionsTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (existing) {
      return {
        sessionId: existing.sessionId,
        status: existing.status,
        level: existing.level,
        expiresAt: existing.expiresAt,
        reused: true,
      };
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await db.insert(verificationSessionsTable).values({
      sessionId,
      identityId,
      status: "pending",
      level,
      expiresAt,
    });

    return { sessionId, status: "pending" as const, level, expiresAt, reused: false };
  }

  /**
   * Complete a verification session (Apple-aligned lifecycle).
   *
   * Apple invariants implemented:
   *   1. Session must exist and belong to the caller
   *   2. Session must be pending and not expired
   *   3. Idempotent: if session already completed, return success without re-writing
   *   4. Atomic: credential insert + level upgrade + session status all in one transaction
   *   5. Monotonic: can only upgrade level (orb > device > none), never downgrade
   *
   * Proof validation is mocked — in production, call the World ID verifier
   * SDK with merkleRoot + nullifierHash + proof.
   */
  static async completeVerification(
    identityId: number,
    sessionId: string,
    proof: { nullifierHash?: string; merkleRoot?: string; proof?: string },
  ) {
    const [session] = await db
      .select()
      .from(verificationSessionsTable)
      .where(
        and(
          eq(verificationSessionsTable.sessionId, sessionId),
          eq(verificationSessionsTable.identityId, identityId),
        ),
      )
      .limit(1);

    if (!session) {
      throw new AppError("Verification session not found or belongs to a different user.", 404, "SESSION_NOT_FOUND");
    }

    // Idempotent: already completed → return success
    if (session.status === "completed") {
      const [identity] = await db
        .select()
        .from(identityTable)
        .where(eq(identityTable.id, identityId))
        .limit(1);
      return {
        success: true,
        level: session.level,
        verificationLevel: identity?.verificationLevel ?? session.level,
        alreadyCompleted: true,
      };
    }

    if (session.status === "expired" || new Date() > session.expiresAt) {
      // Mark as expired if not already
      if (session.status !== "expired") {
        await db
          .update(verificationSessionsTable)
          .set({ status: "expired" })
          .where(eq(verificationSessionsTable.sessionId, sessionId));
      }
      throw new AppError("Verification session has expired.", 400, "SESSION_EXPIRED");
    }

    if (session.status !== "pending") {
      throw new AppError(`Cannot complete session in status: ${session.status}`, 409, "INVALID_SESSION_STATE");
    }

    const [currentIdentity] = await db
      .select()
      .from(identityTable)
      .where(eq(identityTable.id, identityId))
      .limit(1);

    const currentLevel = (currentIdentity?.verificationLevel ?? "none") as VerificationLevel;
    const newLevel = session.level as VerificationLevel;
    const shouldUpgrade = LEVEL_RANK[newLevel] > LEVEL_RANK[currentLevel];

    const nullifierHash = proof.nullifierHash ?? `0x${randomUUID().replace(/-/g, "")}`;

    await db.transaction(async (trx) => {
      // Mark session completed
      await trx
        .update(verificationSessionsTable)
        .set({ status: "completed" })
        .where(eq(verificationSessionsTable.sessionId, sessionId));

      // Monotonic level upgrade only
      if (shouldUpgrade) {
        await trx
          .update(identityTable)
          .set({
            verificationLevel: newLevel,
            isVerified: true,
            nullifierHash,
            updatedAt: new Date(),
          })
          .where(eq(identityTable.id, identityId));

        // Issue credential
        await trx.insert(credentialsTable).values({
          identityId,
          type: newLevel,
          label: newLevel === "orb" ? "Orb Verification" : "Device Verification",
          isActive: true,
        });
      }
    });

    return {
      success: true,
      level: newLevel,
      verificationLevel: shouldUpgrade ? newLevel : currentLevel,
      alreadyCompleted: false,
    };
  }

  /**
   * Get all verification sessions for the user (most recent first).
   */
  static async getVerificationSessions(identityId: number) {
    return db
      .select()
      .from(verificationSessionsTable)
      .where(eq(verificationSessionsTable.identityId, identityId))
      .orderBy(verificationSessionsTable.createdAt);
  }
}
