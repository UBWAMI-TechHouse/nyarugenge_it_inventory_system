import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db/pool";
import type { AuthUser } from "../types";

export interface AuthRequest extends Request {
  user?: AuthUser & { department?: string };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    const result = await query<AuthUser & { department: string }>(
      `SELECT u.*, d.name AS department
       FROM users u
       JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1`,
      [payload.sub]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ success: false, message: "Admin access required" });
    return;
  }
  next();
}
