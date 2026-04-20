import { Router } from "express";
import { query as vQuery } from "express-validator";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import type { DashboardStats } from "../types";

const router = Router();

// ─── Helper: build date range SQL ────────────────────────────────────────────
function buildDateFilter(
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  column = "h.date",
  idx = 1
): { clause: string; values: unknown[]; nextIdx: number } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  // Explicit date range takes priority over period`
  if (dateFrom) {
    clauses.push(`${column} >= $${idx++}`);
    values.push(dateFrom);
  }
  if (dateTo) {
    clauses.push(`${column} <= $${idx++}`);
    values.push(dateTo);
  }

  // Only apply period if no explicit range given
  if (!dateFrom && !dateTo && period && period !== "all") {
    const intervals: Record<string, string> = {
      "7d":  "7 days",
      "30d": "30 days",
      "90d": "90 days",
      "3m":  "3 months",
      "6m":  "6 months",
      "1y":  "1 year",
    };
    if (intervals[period]) {
      clauses.push(`${column} >= NOW() - INTERVAL '${intervals[period]}'`);
    }
  }

  return {
    clause: clauses.length ? clauses.join(" AND ") : "",
    values,
    nextIdx: idx,
  };
}

// GET /api/reports/dashboard
router.get("/dashboard", requireAuth, async (_req, res, next) => {
  try {
    const [eqStats, userCount, handoverCount, recentHandovers, categoryBreakdown, statusBreakdown] =
      await Promise.all([
        query<{ status: string; count: number }>(
          "SELECT status, COUNT(*)::int AS count FROM equipment GROUP BY status"
        ),
        query<{ count: number }>("SELECT COUNT(*)::int AS count FROM users"),
        query<{ count: number }>("SELECT COUNT(*)::int AS count FROM handovers"),
        query(
          `SELECT h.*, fu.name AS from_user_name, tu.name AS to_user_name, e.name AS equipment_name
           FROM handovers h
           LEFT JOIN users fu ON fu.id = h.from_user_id
           LEFT JOIN users tu ON tu.id = h.to_user_id
           JOIN equipment e ON e.id = h.equipment_id
           ORDER BY h.date DESC, h.created_at DESC
           LIMIT 5`
        ),
        query<{ category: string; count: number }>(
          "SELECT category, COUNT(*)::int AS count FROM equipment GROUP BY category ORDER BY count DESC"
        ),
        query<{ status: string; count: number }>(
          "SELECT status, COUNT(*)::int AS count FROM equipment GROUP BY status"
        ),
      ]);

    const eqMap = Object.fromEntries(eqStats.rows.map((r) => [r.status, r.count]));

    const stats: DashboardStats = {
      totalEquipment:
        (eqMap.assigned ?? 0) +
        (eqMap.available ?? 0) +
        (eqMap.maintenance ?? 0) +
        (eqMap.retired ?? 0),
      assigned:   eqMap.assigned   ?? 0,
      available:  eqMap.available  ?? 0,
      maintenance: eqMap.maintenance ?? 0,
      retired:    eqMap.retired    ?? 0,
      totalUsers:     userCount.rows[0].count,
      totalHandovers: handoverCount.rows[0].count,
      recentHandovers:  recentHandovers.rows,
      categoryBreakdown: categoryBreakdown.rows,
      statusBreakdown:   statusBreakdown.rows,
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/equipment
// Filters: department, condition, category, period, dateFrom, dateTo, userId
router.get(
  "/equipment",
  requireAuth,
  [
    vQuery("period").optional().isIn(["7d", "30d", "90d", "3m", "6m", "1y", "all"]),
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        department,
        condition,
        category,
        period,
        dateFrom,
        dateTo,
        userId,
      } = req.query as Record<string, string | undefined>;

      // Build equipment filters
      const eqConditions: string[] = [];
      const eqValues: unknown[] = [];
      let idx = 1;

      if (department) {
        eqConditions.push(`d.name ILIKE $${idx++}`);
        eqValues.push(`%${department}%`);
      }
      if (condition) {
        eqConditions.push(`e.condition = $${idx++}`);
        eqValues.push(condition);
      }
      if (category) {
        eqConditions.push(`e.category ILIKE $${idx++}`);
        eqValues.push(`%${category}%`);
      }
      if (userId) {
        eqConditions.push(`e.assigned_to = $${idx++}`);
        eqValues.push(userId);
      }
      // Date filter applies to equipment purchase_date when dateFrom/dateTo provided
      if (dateFrom) {
        eqConditions.push(`e.purchase_date >= $${idx++}`);
        eqValues.push(dateFrom);
      }
      if (dateTo) {
        eqConditions.push(`e.purchase_date <= $${idx++}`);
        eqValues.push(dateTo);
      }
      if (!dateFrom && !dateTo && period && period !== "all") {
        const intervals: Record<string, string> = {
          "7d":  "7 days",
          "30d": "30 days",
          "90d": "90 days",
          "3m":  "3 months",
          "6m":  "6 months",
          "1y":  "1 year",
        };
        if (intervals[period]) {
          eqConditions.push(`e.purchase_date >= NOW() - INTERVAL '${intervals[period]}'`);
        }
      }

      const eqWhere = eqConditions.length
        ? `WHERE ${eqConditions.join(" AND ")}`
        : "";

      const [byDept, byCat, byCondition, topUsers, items] = await Promise.all([
        // Equipment count per department
        query<{ dept: string; count: number }>(
          `SELECT d.name AS dept, COUNT(e.id)::int AS count
           FROM departments d
           LEFT JOIN users u ON u.department_id = d.id
           LEFT JOIN equipment e ON e.assigned_to = u.id
           GROUP BY d.name ORDER BY count DESC`
        ),
        // By category (filtered)
        query<{ name: string; value: number }>(
          `SELECT e.category AS name, COUNT(*)::int AS value
           FROM equipment e
           LEFT JOIN users u ON u.id = e.assigned_to
           LEFT JOIN departments d ON d.id = u.department_id
           ${eqWhere}
           GROUP BY e.category ORDER BY value DESC`,
          eqValues
        ),
        // By condition (filtered)
        query<{ name: string; value: number }>(
          `SELECT INITCAP(e.condition) AS name, COUNT(*)::int AS value
           FROM equipment e
           LEFT JOIN users u ON u.id = e.assigned_to
           LEFT JOIN departments d ON d.id = u.department_id
           ${eqWhere}
           GROUP BY e.condition ORDER BY value DESC`,
          eqValues
        ),
        // Top users by equipment count
        query<{ name: string; count: number; department: string }>(
          `SELECT u.name, d.name AS department, COUNT(e.id)::int AS count
           FROM users u
           JOIN departments d ON d.id = u.department_id
           LEFT JOIN equipment e ON e.assigned_to = u.id AND e.status = 'assigned'
           GROUP BY u.id, u.name, d.name
           ORDER BY count DESC
           LIMIT 10`
        ),
        // Raw filtered equipment rows (for table display in Reports)
        query(
          `SELECT
             e.*,
             u.name AS assigned_user_name,
             d.name AS assigned_user_dept
           FROM equipment e
           LEFT JOIN users u ON u.id = e.assigned_to
           LEFT JOIN departments d ON d.id = u.department_id
           ${eqWhere}
           ORDER BY e.name
           LIMIT 500`,
          eqValues
        ),
      ]);

      res.json({
        success: true,
        data: {
          byDepartment: byDept.rows,
          byCategory:   byCat.rows,
          byCondition:  byCondition.rows,
          topUsers:     topUsers.rows,
          items:        items.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/handovers
// Filters: period, dateFrom, dateTo, userId, activityType
router.get(
  "/handovers",
  requireAuth,
  [vQuery("period").optional().isIn(["7d", "30d", "90d", "3m", "6m", "1y", "all"])],
  validate,
  async (req, res, next) => {
    try {
      const {
        period,
        dateFrom,
        dateTo,
        userId,
        activityType,
      } = req.query as Record<string, string | undefined>;

      const conditions: string[] = [];
      const baseValues: unknown[] = [];
      let idx = 1;

      // Date range
      const { clause: dateClause, values: dateValues, nextIdx } = buildDateFilter(
        period, dateFrom, dateTo, "h.date", idx
      );
      if (dateClause) { conditions.push(dateClause); baseValues.push(...dateValues); idx = nextIdx; }

      if (userId) {
        conditions.push(`(h.from_user_id = $${idx} OR h.to_user_id = $${idx})`);
        baseValues.push(userId);
        idx++;
      }
      if (activityType) {
        conditions.push(`h.activity_type = $${idx++}`);
        baseValues.push(activityType);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [monthly, byActivity, byUser, items] = await Promise.all([
        // Monthly trend
        query<{ month: string; count: number }>(
          `SELECT TO_CHAR(h.date, 'YYYY-MM') AS month, COUNT(*)::int AS count
           FROM handovers h ${where}
           GROUP BY month ORDER BY month`,
          baseValues
        ),
        // By activity type
        query<{ activity_type: string; count: number }>(
          `SELECT activity_type, COUNT(*)::int AS count
           FROM handovers h ${where}
           GROUP BY activity_type`,
          baseValues
        ),
        // Top users by involvement
        query<{ name: string; count: number }>(
          `SELECT u.name, COUNT(h.id)::int AS count
           FROM users u
           LEFT JOIN handovers h ON (h.from_user_id = u.id OR h.to_user_id = u.id)
             ${where ? where.replace("WHERE", "AND") : ""}
           GROUP BY u.id, u.name
           ORDER BY count DESC
           LIMIT 10`,
          baseValues
        ),
        // Raw rows for table display
        query(
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
           ORDER BY h.date DESC
           LIMIT 1000`,
          baseValues
        ),
      ]);

      res.json({
        success: true,
        data: {
          monthly:    monthly.rows,
          byActivity: byActivity.rows,
          topUsers:   byUser.rows,
          items:      items.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;