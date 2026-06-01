import { Router } from "express";
import { query as vQuery } from "express-validator";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get(
  "/",
  requireAuth,
  [
    vQuery("page").optional().isInt({ min: 1 }).toInt(),
    vQuery("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const offset = (page - 1) * limit;

      let total = 0;
      let rows: Record<string, unknown>[] = [];
      try {
        const countResult = await query<{ count: string }>("SELECT COUNT(*)::text FROM activity_events");
        total = parseInt(countResult.rows[0].count);
        const result = await query(
          `SELECT ae.*, u.name AS user_name
           FROM activity_events ae
           LEFT JOIN users u ON u.id = ae.user_id
           ORDER BY ae.created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        rows = result.rows;
      } catch {
        // table may not exist yet
      }

      res.json({
        success: true,
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
