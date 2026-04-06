import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  balance: real("balance").notNull().default(0),
  balanceUsd: real("balance_usd").notNull().default(0),
  priceUsd: real("price_usd").notNull().default(0),
  change24hPercent: real("change_24h_percent").notNull().default(0),
  iconUrl: text("icon_url"),
  contractAddress: text("contract_address"),
  chain: text("chain").notNull().default("worldchain"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, updatedAt: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;
