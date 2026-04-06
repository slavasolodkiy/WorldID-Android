import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const identityTable = pgTable("identity", {
  id: serial("id").primaryKey(),
  worldId: text("world_id").notNull().unique(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatar_url"),
  verificationLevel: text("verification_level").notNull().default("none"),
  isVerified: boolean("is_verified").notNull().default(false),
  nullifierHash: text("nullifier_hash"),
  walletAddress: text("wallet_address").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIdentitySchema = createInsertSchema(identityTable).omit({ id: true, joinedAt: true, updatedAt: true });
export type InsertIdentity = z.infer<typeof insertIdentitySchema>;
export type Identity = typeof identityTable.$inferSelect;

export const credentialsTable = pgTable("credentials", {
  id: serial("id").primaryKey(),
  identityId: serial("identity_id").notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertCredentialSchema = createInsertSchema(credentialsTable).omit({ id: true });
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentialsTable.$inferSelect;

export const verificationSessionsTable = pgTable("verification_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  identityId: serial("identity_id").notNull(),
  status: text("status").notNull().default("pending"),
  level: text("level").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVerificationSessionSchema = createInsertSchema(verificationSessionsTable).omit({ id: true });
export type InsertVerificationSession = z.infer<typeof insertVerificationSessionSchema>;
export type VerificationSession = typeof verificationSessionsTable.$inferSelect;
