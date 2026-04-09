import { pgTable, text, serial, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { identityTable } from "./identity";

export const miniAppsTable = pgTable("mini_apps", {
  id: serial("id").primaryKey(),
  appId: text("app_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  iconUrl: text("icon_url"),
  category: text("category").notNull(),
  categoryLabel: text("category_label").notNull(),
  developer: text("developer").notNull(),
  rating: real("rating").notNull().default(4.5),
  ratingCount: integer("rating_count").notNull().default(0),
  userCount: integer("user_count").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  tags: text("tags").array().notNull().default([]),
  url: text("url").notNull(),
  screenshotUrls: text("screenshot_urls").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMiniAppSchema = createInsertSchema(miniAppsTable).omit({ id: true, createdAt: true });
export type InsertMiniApp = z.infer<typeof insertMiniAppSchema>;
export type MiniApp = typeof miniAppsTable.$inferSelect;

export const miniAppLaunchesTable = pgTable("mini_app_launches", {
  id: serial("id").primaryKey(),
  appId: text("app_id").notNull(),
  identityId: integer("identity_id").references(() => identityTable.id, { onDelete: "set null" }),
  launchedAt: timestamp("launched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMiniAppLaunchSchema = createInsertSchema(miniAppLaunchesTable).omit({ id: true, launchedAt: true });
export type InsertMiniAppLaunch = z.infer<typeof insertMiniAppLaunchSchema>;
export type MiniAppLaunch = typeof miniAppLaunchesTable.$inferSelect;
