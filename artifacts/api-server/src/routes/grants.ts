import { Router } from "express";
import { ClaimGrantBody } from "@workspace/api-zod";
import { GrantsService } from "../services/grants.service";

const router = Router();

router.get("/", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting grants");
    const grants = await GrantsService.getGrants(req.currentUser.id);
    res.json(grants);
  } catch (err) {
    next(err);
  }
});

router.post("/claim", async (req, res, next): Promise<void> => {
  try {
    const parsed = ClaimGrantBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const result = await GrantsService.claim(
      req.currentUser.id,
      req.currentUser.walletAddress,
      req.currentUser.verificationLevel,
      parsed.data.grantId,
    );

    req.log.info({ grantId: parsed.data.grantId, amountWld: result.amountWld }, "Grant claimed");
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
