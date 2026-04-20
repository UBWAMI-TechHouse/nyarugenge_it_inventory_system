import { Router } from "express";
import { body } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db/pool";
import { validate } from "../middleware/validate";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { sendPasswordResetEmail } from "../services/mailer";
import type { AuthUser } from "../types";

const router = Router();

// POST /api/auth/register
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("department_id").notEmpty().withMessage("Department is required"),
    body("role").notEmpty().withMessage("Role is required"),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const { name, email, password, department_id, role } = req.body as {
        name: string; email: string; password: string; department_id: string; role: string;
      };

      const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        throw new AppError(409, "Email already registered");
      }

      const password_hash = await bcrypt.hash(password, 12);
      const id = uuidv4();

      await query(
        `INSERT INTO users (id, name, email, password_hash, department_id, role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, name, email, password_hash, department_id, role]
      );

      const result = await query<AuthUser>(
        `SELECT u.*, d.name AS department FROM users u
         JOIN departments d ON d.id = u.department_id
         WHERE u.id = $1`,
        [id]
      );

      const user = result.rows[0];
      const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
      });

      const { password_hash: _, ...safeUser } = user;
      res.status(201).json({ success: true, data: { user: safeUser, token } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const result = await query<AuthUser>(
        `SELECT u.*, d.name AS department FROM users u
         JOIN departments d ON d.id = u.department_id
         WHERE u.email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        throw new AppError(401, "Invalid email or password");
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new AppError(401, "Invalid email or password");
      }

      const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
      });

      const { password_hash: _, ...safeUser } = user;
      res.json({ success: true, data: { user: safeUser, token } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get("/me", requireAuth, (req: AuthRequest, res) => {
  const { password_hash: _, ...safeUser } = req.user!;
  res.json({ success: true, data: safeUser });
});

// POST /api/auth/forgot-password
// Body: { email }
// Generates a reset token, stores in DB, sends email
router.post(
  "/forgot-password",
  [
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const { email } = req.body as { email: string };

      // Always respond 200 so we don't reveal whether email exists
      const userResult = await query<AuthUser>(
        "SELECT id, name, email FROM users WHERE email = $1",
        [email]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];

        // Invalidate any existing unused tokens for this user
        await query(
          "UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE",
          [user.id]
        );

        // Create a new token (random 48-char hex)
        const token = crypto.randomBytes(32).toString("hex");
        const expiresMinutes = parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES ?? "60");
        const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

        await query(
          `INSERT INTO password_reset_tokens (user_id, token, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, token, expiresAt]
        );

        // Send email (fire-and-forget — we still return 200 even if email fails)
        const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/reset-password?token=${token}`;
        try {
          await sendPasswordResetEmail(user.email, user.name, resetUrl);
          console.info(`[mailer] Password reset email sent to ${user.email}`);
        } catch (mailErr: unknown) {
          // Log full error details to help diagnose SMTP issues
          console.error("Failed to send reset email:", mailErr);
          if (mailErr && typeof mailErr === "object") {
            const err = mailErr as Record<string, unknown>;
            console.error("[mailer] SMTP error details:", {
              code: err.code,
              command: err.command,
              response: err.response,
              responseCode: err.responseCode,
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT,
              user: process.env.SMTP_USER,
            });
          }
        }
      }

      res.json({
        success: true,
        message: "If that email exists in our system, a password reset link has been sent.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/reset-password
// Body: { token, password }
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Token is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  async (req: AuthRequest, res, next) => {
    try {
      const { token, password } = req.body as { token: string; password: string };

      const tokenResult = await query<{
        id: string;
        user_id: string;
        expires_at: string;
        used: boolean;
      }>(
        `SELECT id, user_id, expires_at, used
         FROM password_reset_tokens
         WHERE token = $1`,
        [token]
      );

      if (tokenResult.rows.length === 0) {
        throw new AppError(400, "Invalid or expired reset token");
      }

      const tokenRow = tokenResult.rows[0];

      if (tokenRow.used) {
        throw new AppError(400, "This reset link has already been used");
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        throw new AppError(400, "This reset link has expired. Please request a new one.");
      }

      // Hash the new password
      const password_hash = await bcrypt.hash(password, 12);

      // Update password and mark token as used (in parallel)
      await Promise.all([
        query(
          "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
          [password_hash, tokenRow.user_id]
        ),
        query(
          "UPDATE password_reset_tokens SET used = TRUE WHERE id = $1",
          [tokenRow.id]
        ),
      ]);

      res.json({ success: true, message: "Password reset successfully. You can now log in." });
    } catch (err) {
      next(err);
    }
  }
);

export default router;