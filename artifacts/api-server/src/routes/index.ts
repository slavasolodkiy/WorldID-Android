import { Router, type IRouter } from "express";
import healthRouter from "./health";
import identityRouter from "./identity";
import walletRouter from "./wallet";
import transactionsRouter from "./transactions";
import miniAppsRouter from "./mini-apps";
import grantsRouter from "./grants";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/identity", identityRouter);
router.use("/wallet", walletRouter);
router.use("/transactions", transactionsRouter);
router.use("/mini-apps", miniAppsRouter);
router.use("/grants", grantsRouter);
router.use("/stats", statsRouter);

export default router;
