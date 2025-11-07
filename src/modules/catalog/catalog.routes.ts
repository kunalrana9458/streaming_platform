import { Router } from "express";
import {
  createTitleController,
  getAllTitlesController,
  getTitleByIdController,
  updateTitleController,
  deleteTitleController,
} from "./catalog.controller";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";

const router = Router();

// Admin-only
router.post("/title", requireAuth, requireRole("admin"), createTitleController);
router.put("/title/:id", requireAuth, requireRole("admin"), updateTitleController);
router.delete("/title/:id", requireAuth, requireRole("admin"), deleteTitleController);

// Public
router.get("/titles", getAllTitlesController);
router.get("/title/:id", getTitleByIdController);

export default router;
