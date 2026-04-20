import { Router } from "express";
import { body, query as vQuery } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { query, withTransaction } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uuidParam, uuidBody, uuidBodyOptional } from "../middleware/uuidParam";
import type { Handover, HandoverWithDetails } from "../types";

const router = Router();

// Allowed sort columns (whitelist to prevent SQL injection)
const SORT_COLUMNS: Record<string, string> = {
  date: "h.date",
  created_at: "h.created_at",
  activity_type: "h.activity_type",
  status: "h.status",
  equipment_name: "e.name",
  from_user: "fu.name",
  to_user: "tu.name",
};

// GET /api/handovers
// Filters: status, activityType, userId, equipmentId, search, dateFrom, dateTo
// Sort:    sortBy, sortDir (asc|desc)
// Pagination: page, limit
router.get(
  "/",
  requireAuth,
  [
    vQuery("page").optional().isInt({ min: 1 }).toInt(),
    vQuery("limit").optional().isInt({ min: 1, max: 1000 }).toInt(),
    vQuery("sortDir").optional().isIn(["asc", "desc"]),
  ],
  validate,
  async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const offset = (page - 1) * limit;

      const {
        status,
        activityType,
        userId,
        equipmentId,
        search,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
      } = req.query as Record<string, string | undefined>;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (status) { conditions.push(`h.status = $${idx++}`); values.push(status); }
      if (activityType) { conditions.push(`h.activity_type = $${idx++}`); values.push(activityType); }
      if (userId) {
        conditions.push(`(h.from_user_id = $${idx} OR h.to_user_id = $${idx})`);
        values.push(userId);
        idx++;
      }
      if (equipmentId) { conditions.push(`h.equipment_id = $${idx++}`); values.push(equipmentId); }
      if (search) {
        conditions.push(
          `(fu.name ILIKE $${idx} OR tu.name ILIKE $${idx} OR e.name ILIKE $${idx} OR e.tag_number ILIKE $${idx})`
        );
        values.push(`%${search}%`);
        idx++;
      }
      // Date range filters (inclusive)
      if (dateFrom) { conditions.push(`h.date >= $${idx++}`); values.push(dateFrom); }
      if (dateTo)   { conditions.push(`h.date <= $${idx++}`); values.push(dateTo); }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      // Determine ORDER BY
      const sortCol = (sortBy && SORT_COLUMNS[sortBy]) ? SORT_COLUMNS[sortBy] : "h.date";
      const sortDirection = sortDir === "asc" ? "ASC" : "DESC";
      const orderBy = `ORDER BY ${sortCol} ${sortDirection}, h.created_at DESC`;

      const totalResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text
         FROM handovers h
         LEFT JOIN users fu ON fu.id = h.from_user_id
         LEFT JOIN users tu ON tu.id = h.to_user_id
         JOIN equipment e ON e.id = h.equipment_id
         ${where}`,
        values
      );
      const total = parseInt(totalResult.rows[0].count);

      values.push(limit, offset);
      const result = await query<HandoverWithDetails>(
        `SELECT
           h.*,
           fu.name AS from_user_name,
           tu.name AS to_user_name,
           e.name AS equipment_name,
           e.category AS equipment_category,
           e.tag_number AS equipment_tag_number
         FROM handovers h
         LEFT JOIN users fu ON fu.id = h.from_user_id
         LEFT JOIN users tu ON tu.id = h.to_user_id
         JOIN equipment e ON e.id = h.equipment_id
         ${where}
         ${orderBy}
         LIMIT $${idx++} OFFSET $${idx}`,
        values
      );

      res.json({
        success: true,
        data: result.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/handovers/:id
router.get(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const result = await query<HandoverWithDetails>(
        `SELECT
           h.*,
           fu.name  AS from_user_name,
           fu.email AS from_user_email,
           fd.name  AS from_user_dept,
           tu.name  AS to_user_name,
           tu.email AS to_user_email,
           td.name  AS to_user_dept,
           e.name          AS equipment_name,
           e.category      AS equipment_category,
           e.serial_number AS equipment_serial,
           e.tag_number    AS equipment_tag_number,
           e.condition     AS equipment_condition
         FROM handovers h
         LEFT JOIN users fu        ON fu.id = h.from_user_id
         LEFT JOIN departments fd  ON fd.id = fu.department_id
         LEFT JOIN users tu        ON tu.id = h.to_user_id
         LEFT JOIN departments td  ON td.id = tu.department_id
         JOIN equipment e          ON e.id  = h.equipment_id
         WHERE h.id = $1`,
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "Handover not found");
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/handovers
router.post(
  "/",
  requireAuth,
  [
    uuidBody("equipment_id", "Valid equipment_id required"),
    body("activity_type")
      .isIn(["reassign", "return", "new_issue"])
      .withMessage("activity_type must be reassign, return, or new_issue"),
    uuidBodyOptional("from_user_id"),
    uuidBodyOptional("to_user_id"),
    body("notes").optional().trim(),
    body("date").optional().isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        equipment_id,
        activity_type,
        from_user_id = null,
        to_user_id = null,
        notes,
        date,
      } = req.body as {
        equipment_id: string;
        activity_type: "reassign" | "return" | "new_issue";
        from_user_id?: string | null;
        to_user_id?: string | null;
        notes?: string;
        date?: string;
      };

      if (activity_type === "reassign" && (!from_user_id || !to_user_id)) {
        throw new AppError(422, "Reassign requires both from_user_id and to_user_id");
      }
      if (activity_type === "return" && !from_user_id) {
        throw new AppError(422, "Return requires from_user_id");
      }
      if (activity_type === "new_issue" && !to_user_id) {
        throw new AppError(422, "New issue requires to_user_id");
      }

      const result = await withTransaction(async (client) => {
        const eqResult = await client.query<{ id: string; status: string; assigned_to: string | null }>(
          "SELECT id, status, assigned_to FROM equipment WHERE id = $1",
          [equipment_id]
        );
        if (!eqResult.rows.length) throw new AppError(404, "Equipment not found");

        let newStatus: string;
        let newAssignedTo: string | null;

        if (activity_type === "return") {
          newStatus = "available";
          newAssignedTo = null;
        } else {
          newStatus = "assigned";
          newAssignedTo = to_user_id;
        }

        await client.query(
          "UPDATE equipment SET assigned_to = $1, status = $2, updated_at = NOW() WHERE id = $3",
          [newAssignedTo, newStatus, equipment_id]
        );

        const id = uuidv4();
        const handoverDate = date ?? new Date().toISOString().slice(0, 10);

        const handoverResult = await client.query<Handover>(
          `INSERT INTO handovers
             (id, from_user_id, to_user_id, equipment_id, date, status, activity_type, notes)
           VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7)
           RETURNING *`,
          [id, from_user_id, to_user_id, equipment_id, handoverDate, activity_type, notes ?? null]
        );

        return handoverResult.rows[0];
      });

      const full = await query<HandoverWithDetails>(
        `SELECT
           h.*,
           fu.name AS from_user_name,
           tu.name AS to_user_name,
           e.name  AS equipment_name
         FROM handovers h
         LEFT JOIN users fu ON fu.id = h.from_user_id
         LEFT JOIN users tu ON tu.id = h.to_user_id
         JOIN equipment e   ON e.id  = h.equipment_id
         WHERE h.id = $1`,
        [result.id]
      );

      res.status(201).json({ success: true, data: full.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/handovers/:id/cancel
router.patch(
  "/:id/cancel",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const result = await query<Handover>(
        `UPDATE handovers SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [req.params.id]
      );
      if (!result.rows.length) {
        throw new AppError(404, "Handover not found or not in pending state");
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
