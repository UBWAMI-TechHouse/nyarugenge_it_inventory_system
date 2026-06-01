import { Router } from "express";
import { body } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { uuidParam } from "../middleware/uuidParam";
import { logActivity } from "../lib/activity";

const router = Router();

router.get(
  "/:equipmentId",
  requireAuth,
  uuidParam("equipmentId"),
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const result = await query(
        `SELECT ml.*, u.name AS logged_by_name
         FROM maintenance_logs ml
         LEFT JOIN users u ON u.id = ml.logged_by
         WHERE ml.equipment_id = $1
         ORDER BY ml.date DESC, ml.created_at DESC`,
        [req.params.equipmentId]
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireAuth,
  [
    body("equipment_id").isUUID().withMessage("Valid equipment ID required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("type").isIn(["repair", "inspection", "calibration", "cleaning", "upgrade", "other"]).withMessage("Invalid maintenance type"),
    body("cost").optional().isFloat({ min: 0 }),
    body("date").optional().isISO8601(),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const { equipment_id, description, type, cost, date } = req.body as {
        equipment_id: string; description: string; type: string;
        cost?: number; date?: string;
      };
      const id = uuidv4();
      const currentUser = (req as AuthRequest).user;
      const result = await query(
        `INSERT INTO maintenance_logs (id, equipment_id, type, description, cost, date, logged_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, equipment_id, type, description, cost ?? null, date ?? new Date().toISOString().slice(0, 10), currentUser?.id ?? null]
      );
      await logActivity({
        userId: currentUser?.id,
        action: "created",
        entityType: "maintenance",
        entityId: id,
        description: `Maintenance log: ${type} - ${description.slice(0, 100)}`,
        metadata: { equipment_id, type, cost },
      });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
