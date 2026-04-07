import { pgTable, text, serial, integer, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { identityTable } from "./identity";

export const grantsTable = pgTable("grants", {
  id: serial("id").primaryKey(),
  identityId: integer("identity_id").references(() => identityTable.id, { onDelete: "cascade" }),
  grantId: text("grant_id").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amountWld: numeric("amount_wld", { precision: 28, scale: 8 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 18, scale: 6 }).notNull(),
  status: text("status").notNull().default("available"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  requiresOrb: boolean("requires_orb").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGrantSchema = createInsertSchema(grantsTable).omit({ id: true, createdAt: true });
export type InsertGrant = z.infer<typeof insertGrantSchema>;
export type Grant = typeof grantsTable.$inferSelect;
