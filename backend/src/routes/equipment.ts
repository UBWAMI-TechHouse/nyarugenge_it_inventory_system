import { Router } from "express";
import { body, query as vQuery } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uuidParam, uuidBodyOptional } from "../middleware/uuidParam";
import type { Equipment } from "../types";

const router = Router();

// GET /api/equipment?search=&status=&category=&condition=&assignedTo=&departmentId=&page=&limit=
router.get(
  "/",
  requireAuth,
  [
    vQuery("page").optional().isInt({ min: 1 }).toInt(),
    vQuery("limit").optional().isInt({ min: 1, max: 1000 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 100);
      const offset = (page - 1) * limit;
      const { search, status, category, condition, assignedTo, departmentId } =
        req.query as Record<string, string | undefined>;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (search) {
        conditions.push(
          `(e.name ILIKE $${idx} OR e.serial_number ILIKE $${idx} OR e.tag_number ILIKE $${idx} OR e.category ILIKE $${idx})`
        );
        values.push(`%${search}%`);
        idx++;
      }
      if (status) { conditions.push(`e.status = $${idx++}`); values.push(status); }
      if (category) { conditions.push(`e.category ILIKE $${idx++}`); values.push(`%${category}%`); }
      if (condition) { conditions.push(`e.condition = $${idx++}`); values.push(condition); }
      if (assignedTo) { conditions.push(`e.assigned_to = $${idx++}`); values.push(assignedTo); }
      // Filter by department — joins through assigned user
      if (departmentId) {
        conditions.push(`u.department_id = $${idx++}`);
        values.push(departmentId);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const totalResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text
         FROM equipment e
         LEFT JOIN users u ON u.id = e.assigned_to
         ${where}`,
        values
      );
      const total = parseInt(totalResult.rows[0].count);

      values.push(limit, offset);
      const result = await query<Equipment & { assigned_user_name: string | null; assigned_user_dept: string | null }>(
        `SELECT
           e.*,
           u.name AS assigned_user_name,
           d.name AS assigned_user_dept
         FROM equipment e
         LEFT JOIN users u ON u.id = e.assigned_to
         LEFT JOIN departments d ON d.id = u.department_id
         ${where}
         ORDER BY e.name
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

// GET /api/equipment/categories
router.get("/categories", requireAuth, async (_req, res, next) => {
  try {
    const result = await query<{ category: string; count: number }>(
      `SELECT category, COUNT(*)::int AS count
       FROM equipment
       GROUP BY category
       ORDER BY count DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/equipment/:id
router.get(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const result = await query<Equipment>(
        `SELECT e.*,
           u.name AS assigned_user_name,
           d.name AS assigned_user_dept
         FROM equipment e
         LEFT JOIN users u ON u.id = e.assigned_to
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE e.id = $1`,
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "Equipment not found");

      const handovers = await query(
        `SELECT
           h.*,
           fu.name AS from_user_name,
           tu.name AS to_user_name
         FROM handovers h
         LEFT JOIN users fu ON fu.id = h.from_user_id
         LEFT JOIN users tu ON tu.id = h.to_user_id
         WHERE h.equipment_id = $1
         ORDER BY h.date DESC`,
        [req.params.id]
      );

      res.json({
        success: true,
        data: { ...result.rows[0], handovers: handovers.rows },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/equipment
router.post(
  "/",
  requireAuth,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("serial_number").trim().notEmpty().withMessage("Serial number is required"),
    body("tag_number").trim().notEmpty().withMessage("Tag number is required"),
    body("status")
      .isIn(["assigned", "available", "maintenance", "retired"])
      .withMessage("Invalid status"),
    body("condition")
      .isIn(["excellent", "good", "fair", "poor"])
      .withMessage("Invalid condition"),
    body("purchase_date").isISO8601().withMessage("Valid purchase date required"),
    uuidBodyOptional("assigned_to"),
    body("notes").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        name, category, serial_number, tag_number,
        assigned_to, status, condition, purchase_date, notes,
      } = req.body as {
        name: string; category: string; serial_number: string; tag_number: string;
        assigned_to?: string | null; status: string; condition: string;
        purchase_date: string; notes?: string;
      };

      const id = uuidv4();
      const result = await query<Equipment>(
        `INSERT INTO equipment
           (id, name, category, serial_number, tag_number, assigned_to, status, condition, purchase_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [id, name, category, serial_number, tag_number, assigned_to ?? null, status, condition, purchase_date, notes ?? null]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/equipment/:id
router.patch(
  "/:id",
  requireAuth,
  [
    uuidParam("id"),
    body("name").optional().trim().notEmpty(),
    body("category").optional().trim().notEmpty(),
    body("serial_number").optional().trim().notEmpty(),
    body("tag_number").optional().trim().notEmpty(),
    body("status").optional().isIn(["assigned", "available", "maintenance", "retired"]),
    body("condition").optional().isIn(["excellent", "good", "fair", "poor"]),
    body("purchase_date").optional().isISO8601(),
    uuidBodyOptional("assigned_to"),
    body("notes").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ["name", "category", "serial_number", "tag_number", "assigned_to", "status", "condition", "purchase_date", "notes"] as const;
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${idx++}`);
          values.push(req.body[key] ?? null);
        }
      }
      if (!fields.length) throw new AppError(400, "No fields to update");

      values.push(req.params.id);
      const result = await query<Equipment>(
        `UPDATE equipment SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!result.rows.length) throw new AppError(404, "Equipment not found");
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/equipment/:id
router.delete(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const result = await query(
        "DELETE FROM equipment WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "Equipment not found");
      res.json({ success: true, message: "Equipment deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
