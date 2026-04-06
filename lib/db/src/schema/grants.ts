import { pgTable, text, serial, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const grantsTable = pgTable("grants", {
  id: serial("id").primaryKey(),
  grantId: text("grant_id").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amountWld: real("amount_wld").notNull(),
  amountUsd: real("amount_usd").notNull(),
  status: text("status").notNull().default("available"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  requiresOrb: boolean("requires_orb").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGrantSchema = createInsertSchema(grantsTable).omit({ id: true, createdAt: true });
export type InsertGrant = z.infer<typeof insertGrantSchema>;
export type Grant = typeof grantsTable.$inferSelect;
