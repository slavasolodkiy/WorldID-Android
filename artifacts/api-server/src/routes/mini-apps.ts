import { Router } from "express";
import { db } from "@workspace/db";
import { miniAppsTable, miniAppLaunchesTable } from "@workspace/db";
import { GetMiniAppsQueryParams, GetMiniAppParams, LaunchMiniAppParams } from "@workspace/api-zod";
import { eq, ilike, or, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  const parsed = GetMiniAppsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, featured, search } = parsed.data;
  let query = db.select().from(miniAppsTable).$dynamic();

  if (category) {
    query = query.where(eq(miniAppsTable.category, category));
  }

  if (featured === true || featured === "true" as any) {
    query = query.where(eq(miniAppsTable.isFeatured, true));
  }

  if (search) {
    query = query.where(
      or(
        ilike(miniAppsTable.name, `%${search}%`),
        ilike(miniAppsTable.description, `%${search}%`)
      )
    );
  }

  const apps = await query;
  res.json(
    apps.map((a) => ({
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
    }))
  );
});

router.get("/categories", async (req, res): Promise<void> => {
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
    }))
  );
});

router.get("/:id", async (req, res): Promise<void> => {
  const parsed = GetMiniAppParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [app] = await db
    .select()
    .from(miniAppsTable)
    .where(eq(miniAppsTable.appId, parsed.data.id));

  if (!app) {
    res.status(404).json({ error: "Mini app not found" });
    return;
  }

  res.json({
    id: app.appId,
    name: app.name,
    description: app.description,
    iconUrl: app.iconUrl,
    category: app.category,
    categoryLabel: app.categoryLabel,
    developer: app.developer,
    rating: app.rating,
    ratingCount: app.ratingCount,
    userCount: app.userCount,
    isVerified: app.isVerified,
    isFeatured: app.isFeatured,
    tags: app.tags,
    url: app.url,
    screenshotUrls: app.screenshotUrls,
  });
});

router.post("/:id/launch", async (req, res): Promise<void> => {
  const parsed = LaunchMiniAppParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [app] = await db
    .select()
    .from(miniAppsTable)
    .where(eq(miniAppsTable.appId, parsed.data.id));

  if (!app) {
    res.status(404).json({ error: "Mini app not found" });
    return;
  }

  await db.insert(miniAppLaunchesTable).values({ appId: parsed.data.id });
  req.log.info({ appId: parsed.data.id }, "Mini app launched");

  res.json({
    success: true,
    url: app.url,
  });
});

export default router;
