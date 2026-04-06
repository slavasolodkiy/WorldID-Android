import { Router } from "express";

const router = Router();

router.get("/", async (req, res): Promise<void> => {
  req.log.info("Getting global stats");
  res.json({
    totalVerifiedHumans: 11247893,
    totalCountries: 160,
    totalMiniApps: 847,
    totalWldDistributed: 74200000,
    monthlyActiveUsers: 3840000,
  });
});

export default router;
