import { pgTable, text, serial, integer, numeric, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { identityTable } from "./identity";

export const tokensTable = pgTable(
  "tokens",
  {
    id: serial("id").primaryKey(),
    identityId: integer("identity_id").references(() => identityTable.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    balance: numeric("balance", { precision: 28, scale: 8 }).notNull().default("0"),
    balanceUsd: numeric("balance_usd", { precision: 18, scale: 6 }).notNull().default("0"),
    priceUsd: numeric("price_usd", { precision: 18, scale: 6 }).notNull().default("0"),
    change24hPercent: real("change_24h_percent").notNull().default(0),
    iconUrl: text("icon_url"),
    contractAddress: text("contract_address"),
    chain: text("chain").notNull().default("worldchain"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("tokens_identity_symbol_idx").on(table.identityId, table.symbol),
  ]
);

export const insertTokenSchema = createInsertSchema(tokensTable).omit({ id: true, updatedAt: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokensTable.$inferSelect;
