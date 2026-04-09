import { Router } from "express";
import { db } from "@workspace/db";
import { miniAppsTable, miniAppLaunchesTable } from "@workspace/db";
import { GetMiniAppsQueryParams, GetMiniAppParams, LaunchMiniAppParams } from "@workspace/api-zod";
import { eq, ilike, or, sql } from "drizzle-orm";
import { AppError } from "../middlewares/error";

const router = Router();

function mapApp(a: typeof miniAppsTable.$inferSelect) {
  return {
    id: a.appId,
    name: a.name,
    description: a.description,
    iconUrl: a.iconUrl,
    category: a.category,
    categoryLabel: a.categoryLabel,
    developer: a.developer,
    rating: a.rating,
    ratingCount: a.ratingCount,
    userCount: a.userCount,
    isVerified: a.isVerified,
    isFeatured: a.isFeatured,
    tags: a.tags,
    url: a.url,
    screenshotUrls: a.screenshotUrls,
  };
}

router.get("/", async (req, res, next): Promise<void> => {
  try {
    const parsed = GetMiniAppsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const { category, featured, search } = parsed.data;
    let query = db.select().from(miniAppsTable).$dynamic();

    if (category) {
      query = query.where(eq(miniAppsTable.category, category));
    }

    if (featured === true || featured === ("true" as any)) {
      query = query.where(eq(miniAppsTable.isFeatured, true));
    }

    if (search) {
      query = query.where(
        or(
          ilike(miniAppsTable.name, `%${search}%`),
          ilike(miniAppsTable.description, `%${search}%`),
        ),
      );
    }

    const apps = await query;
    res.json(apps.map(mapApp));
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting mini app categories");
    const result = await db
      .select({
        category: miniAppsTable.category,
        categoryLabel: miniAppsTable.categoryLabel,
        count: sql<number>`count(*)`,
      })
      .from(miniAppsTable)
      .groupBy(miniAppsTable.category, miniAppsTable.categoryLabel);

    const categoryIcons: Record<string, string> = {
      finance: "wallet",
      social: "users",
      games: "gamepad-2",
      defi: "trending-up",
      nft: "image",
      dao: "landmark",
      tools: "wrench",
      identity: "shield",
    };

    res.json(
      result.map((r) => ({
        id: r.category,
        label: r.categoryLabel,
        icon: categoryIcons[r.category] ?? "grid",
        appCount: Number(r.count),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next): Promise<void> => {
  try {
    const parsed = GetMiniAppParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const [app] = await db
      .select()
      .from(miniAppsTable)
      .where(eq(miniAppsTable.appId, parsed.data.id));

    if (!app) {
      throw new AppError("Mini app not found", 404, "MINI_APP_NOT_FOUND");
    }

    res.json(mapApp(app));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/launch", async (req, res, next): Promise<void> => {
  try {
    const parsed = LaunchMiniAppParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const [app] = await db
      .select()
      .from(miniAppsTable)
      .where(eq(miniAppsTable.appId, parsed.data.id));

    if (!app) {
      throw new AppError("Mini app not found", 404, "MINI_APP_NOT_FOUND");
    }

    // User-scoped launch: identityId FK is now recorded
    await db.insert(miniAppLaunchesTable).values({
      appId: parsed.data.id,
      identityId: req.currentUser.id,
    });

    req.log.info({ appId: parsed.data.id, identityId: req.currentUser.id }, "Mini app launched");
    res.json({ success: true, url: app.url });
  } catch (err) {
    next(err);
  }
});

export default router;
