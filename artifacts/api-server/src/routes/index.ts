import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import utilisateursRouter from "./utilisateurs";
import etablissementsRouter from "./etablissements";
import statsRouter from "./stats";
import elevesRouter from "./eleves";
import classesRouter from "./classes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(utilisateursRouter);
router.use(etablissementsRouter);
router.use(statsRouter);
router.use(elevesRouter);
router.use(classesRouter);

export default router;
