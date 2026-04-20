import { validationResult } from "express-validator";
import type { Request, Response, NextFunction } from "express";

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => e.msg),
    });
    return;
  }
  next();
}
