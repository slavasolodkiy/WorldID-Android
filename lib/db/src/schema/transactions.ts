import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { identityTable } from "./identity";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  identityId: integer("identity_id").references(() => identityTable.id, { onDelete: "set null" }),
  txId: text("tx_id").notNull().unique(),
  type: text("type").notNull(),
  status: text("status").notNull().default("confirmed"),
  amount: numeric("amount", { precision: 28, scale: 8 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 18, scale: 6 }).notNull(),
  token: text("token").notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  toUsername: text("to_username"),
  fromUsername: text("from_username"),
  txHash: text("tx_hash"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
