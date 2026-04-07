import { Router } from "express";
import { SendTokensBody } from "@workspace/api-zod";
import { WalletService } from "../services/wallet.service";

const router = Router();

router.get("/", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting wallet");
    const wallet = await WalletService.getWallet(req.currentUser.id);
    res.json(wallet);
  } catch (err) {
    next(err);
  }
});

router.get("/tokens", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting tokens");
    const tokens = await WalletService.getTokens(req.currentUser.id);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post("/send", async (req, res, next): Promise<void> => {
  try {
    const parsed = SendTokensBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const { toAddress, amount, token, note } = parsed.data;
    const tx = await WalletService.send(
      req.currentUser.id,
      req.currentUser.walletAddress,
      toAddress,
      amount,
      token,
      note,
    );

    req.log.info({ txId: tx.id, amount, token }, "Transaction sent");
    res.json(tx);
  } catch (err) {
    next(err);
  }
});

router.get("/receive", async (req, res, next): Promise<void> => {
  try {
    req.log.info("Getting receive info");
    const info = await WalletService.getReceiveInfo(req.currentUser.id);
    res.json(info);
  } catch (err) {
    next(err);
  }
});

export default router;
