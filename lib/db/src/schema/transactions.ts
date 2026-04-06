import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  txId: text("tx_id").notNull().unique(),
  type: text("type").notNull(),
  status: text("status").notNull().default("confirmed"),
  amount: real("amount").notNull(),
  amountUsd: real("amount_usd").notNull(),
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
