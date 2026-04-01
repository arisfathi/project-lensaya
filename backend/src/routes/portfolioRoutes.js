import { Router } from "express";
import { photographerController } from "../controllers/photographerController.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenantContext.js";
import { validate } from "../middleware/validate.js";
import {
  basicListQuerySchema,
  portfolioCreateSchema,
  portfolioPatchSchema,
  featureSchema,
  itemIdParamSchema,
  emptySchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth, tenantContext);

router.get("/portfolio/items", validate(basicListQuerySchema, "query"), photographerController.listPortfolioItems);
router.post("/portfolio/items", validate(portfolioCreateSchema), photographerController.createPortfolioItem);
router.patch(
  "/portfolio/items/:itemId",
  validate(itemIdParamSchema, "params"),
  validate(portfolioPatchSchema),
  photographerController.updatePortfolioItem
);
router.patch(
  "/portfolio/items/:itemId/feature",
  validate(itemIdParamSchema, "params"),
  validate(featureSchema),
  photographerController.featurePortfolioItem
);
router.delete(
  "/portfolio/items/:itemId",
  validate(itemIdParamSchema, "params"),
  validate(emptySchema),
  photographerController.deletePortfolioItem
);

export default router;
