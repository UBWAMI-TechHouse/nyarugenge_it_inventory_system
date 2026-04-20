import { Router } from "express";
import { body, query as vQuery } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uuidParam, uuidBody, uuidBodyOptional } from "../middleware/uuidParam";
import type { User } from "../types";

const router = Router();

// GET /api/users?search=&department=&page=&limit=
router.get(
  "/",
  requireAuth,
  [
    vQuery("page").optional().isInt({ min: 1 }).toInt(),
    vQuery("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const offset = (page - 1) * limit;
      const search = req.query.search as string | undefined;
      const department = req.query.department as string | undefined;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (search) {
        conditions.push(
          `(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR d.name ILIKE $${idx})`
        );
        values.push(`%${search}%`);
        idx++;
      }
      if (department) {
        conditions.push(`d.name ILIKE $${idx++}`);
        values.push(`%${department}%`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const totalResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text FROM users u JOIN departments d ON d.id = u.department_id ${where}`,
        values
      );
      const total = parseInt(totalResult.rows[0].count);

      values.push(limit, offset);
      const result = await query<User & { equipment_count: number; handover_count: number }>(
        `SELECT
           u.id, u.name, u.email, u.role, u.avatar, u.created_at,
           d.name AS department, d.id AS department_id,
           COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'assigned')::int AS equipment_count,
           COUNT(DISTINCT h.id)::int AS handover_count
         FROM users u
         JOIN departments d ON d.id = u.department_id
         LEFT JOIN equipment e ON e.assigned_to = u.id
         LEFT JOIN handovers h ON h.from_user_id = u.id OR h.to_user_id = u.id
         ${where}
         GROUP BY u.id, d.name, d.id
         ORDER BY u.name
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

// GET /api/users/:id
router.get(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const result = await query<User>(
        `SELECT u.*, d.name AS department
         FROM users u
         JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1`,
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "User not found");

      const equipment = await query(
        `SELECT * FROM equipment WHERE assigned_to = $1 AND status = 'assigned'
         ORDER BY name`,
        [req.params.id]
      );

      const handovers = await query(
        `SELECT
           h.*,
           fu.name AS from_user_name,
           tu.name AS to_user_name,
           e.name AS equipment_name
         FROM handovers h
         LEFT JOIN users fu ON fu.id = h.from_user_id
         LEFT JOIN users tu ON tu.id = h.to_user_id
         JOIN equipment e ON e.id = h.equipment_id
         WHERE h.from_user_id = $1 OR h.to_user_id = $1
         ORDER BY h.date DESC`,
        [req.params.id]
      );

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          equipment: equipment.rows,
          handovers: handovers.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/users
router.post(
  "/",
  requireAuth,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    uuidBody("department_id", "Valid department_id required"),
    body("role").trim().notEmpty().withMessage("Role is required"),
    body("password").optional().isLength({ min: 6 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, department_id, role, password } = req.body as {
        name: string; email: string; department_id: string; role: string; password?: string;
      };

      const exists = await query("SELECT 1 FROM users WHERE email = $1", [email]);
      if (exists.rows.length) throw new AppError(409, "Email already in use");

      const id = uuidv4();
      const password_hash = password
        ? await bcrypt.hash(password, 12)
        : await bcrypt.hash(uuidv4(), 12);

      await query(
        `INSERT INTO users (id, name, email, password_hash, department_id, role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, name, email, password_hash, department_id, role]
      );

      const fullUser = await query<User>(
        `SELECT u.*, d.name AS department FROM users u
         JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
        [id]
      );

      res.status(201).json({ success: true, data: fullUser.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/users/:id
router.patch(
  "/:id",
  requireAuth,
  [
    uuidParam("id"),
    body("name").optional().trim().notEmpty(),
    body("email").optional().isEmail().normalizeEmail(),
    uuidBodyOptional("department_id"),
    body("role").optional().trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const allowed = ["name", "email", "department_id", "role", "avatar"] as const;
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(req.body[key]);
        }
      }
      if (!fields.length) throw new AppError(400, "No fields to update");

      values.push(req.params.id);
      const result = await query(
        `UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx} RETURNING id`,
        values
      );
      if (!result.rows.length) throw new AppError(404, "User not found");

      const updated = await query<User>(
        `SELECT u.*, d.name AS department FROM users u
         JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
        [req.params.id]
      );
      res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id
router.delete(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      await query(
        "UPDATE equipment SET assigned_to = NULL, status = 'available' WHERE assigned_to = $1",
        [req.params.id]
      );
      const result = await query(
        "DELETE FROM users WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "User not found");
      res.json({ success: true, message: "User deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
