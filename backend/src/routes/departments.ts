import { Router } from "express";
import { body } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uuidParam } from "../middleware/uuidParam";
import type { Department } from "../types";

const router = Router();

// GET /api/departments
// Returns all departments with user_count and equipment_count
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const result = await query<Department & { user_count: number; equipment_count: number }>(
      `SELECT d.*,
        COUNT(DISTINCT u.id)::int AS user_count,
        COUNT(DISTINCT e.id) FILTER (WHERE e.status != 'retired')::int AS equipment_count
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id
       LEFT JOIN equipment e ON e.assigned_to = u.id
       GROUP BY d.id
       ORDER BY d.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/:id
// Returns department + its users + their equipment (for DepartmentDetail page)
router.get(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const deptResult = await query<Department & { user_count: number; equipment_count: number }>(
        `SELECT d.*,
          COUNT(DISTINCT u.id)::int AS user_count,
          COUNT(DISTINCT e.id) FILTER (WHERE e.status != 'retired')::int AS equipment_count
         FROM departments d
         LEFT JOIN users u ON u.department_id = d.id
         LEFT JOIN equipment e ON e.assigned_to = u.id
         WHERE d.id = $1
         GROUP BY d.id`,
        [req.params.id]
      );
      if (!deptResult.rows.length) throw new AppError(404, "Department not found");

      // Get all users in this department with their counts
      const usersResult = await query(
        `SELECT
           u.id, u.name, u.email, u.role, u.avatar, u.created_at,
           d.name AS department, d.id AS department_id,
           COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'assigned')::int AS equipment_count,
           COUNT(DISTINCT h.id)::int AS handover_count
         FROM users u
         JOIN departments d ON d.id = u.department_id
         LEFT JOIN equipment e ON e.assigned_to = u.id
         LEFT JOIN handovers h ON h.from_user_id = u.id OR h.to_user_id = u.id
         WHERE u.department_id = $1
         GROUP BY u.id, d.name, d.id
         ORDER BY u.name`,
        [req.params.id]
      );

      // Get all equipment assigned to users in this department
      const equipmentResult = await query(
        `SELECT
           e.*,
           u.name AS assigned_user_name,
           d.name AS assigned_user_dept
         FROM equipment e
         JOIN users u ON u.id = e.assigned_to
         JOIN departments d ON d.id = u.department_id
         WHERE u.department_id = $1
         ORDER BY e.name`,
        [req.params.id]
      );

      res.json({
        success: true,
        data: {
          ...deptResult.rows[0],
          users: usersResult.rows,
          equipment: equipmentResult.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/departments
router.post(
  "/",
  requireAuth,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("code").trim().toUpperCase().notEmpty().withMessage("Code is required"),
    body("description").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, code, description } = req.body as {
        name: string; code: string; description?: string;
      };

      const id = uuidv4();
      const result = await query<Department>(
        `INSERT INTO departments (id, name, code, description)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, name, code, description ?? null]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/departments/:id
router.patch(
  "/:id",
  requireAuth,
  [
    uuidParam("id"),
    body("name").optional().trim().notEmpty(),
    body("code").optional().trim().toUpperCase().notEmpty(),
    body("description").optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const key of ["name", "code", "description"] as const) {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(req.body[key]);
        }
      }

      if (!fields.length) throw new AppError(400, "No fields to update");

      values.push(req.params.id);
      const result = await query<Department>(
        `UPDATE departments SET ${fields.join(", ")}, updated_at = NOW()
         WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!result.rows.length) throw new AppError(404, "Department not found");
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/departments/:id
router.delete(
  "/:id",
  requireAuth,
  uuidParam("id"),
  validate,
  async (req, res, next) => {
    try {
      const usersInDept = await query(
        "SELECT 1 FROM users WHERE department_id = $1 LIMIT 1",
        [req.params.id]
      );
      if (usersInDept.rows.length) {
        throw new AppError(409, "Cannot delete department with existing users");
      }

      const result = await query(
        "DELETE FROM departments WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (!result.rows.length) throw new AppError(404, "Department not found");
      res.json({ success: true, message: "Department deleted" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
