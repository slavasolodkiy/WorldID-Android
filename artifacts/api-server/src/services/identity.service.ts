import { db, identityTable, credentialsTable, verificationSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { AppError } from "../middlewares/error";

export type VerificationLevel = "none" | "device" | "orb";

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

  static async initiateVerification(identityId: number, level: VerificationLevel) {
    const validLevels: VerificationLevel[] = ["device", "orb"];
    if (!validLevels.includes(level)) {
      throw new AppError(`Invalid verification level: ${level}`, 400, "INVALID_LEVEL");
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(verificationSessionsTable).values({
      sessionId,
      identityId,
      status: "pending",
      level,
      expiresAt,
    });

    return { sessionId, status: "pending", level, expiresAt };
  }
}
