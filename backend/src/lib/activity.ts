import { query } from "../db/pool";
import { v4 as uuidv4 } from "uuid";

export async function logActivity(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO activity_events (id, user_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), params.userId ?? null, params.action, params.entityType, params.entityId ?? null, params.description, params.metadata ? JSON.stringify(params.metadata) : null]
    );
  } catch {
    // silently fail — activity logging should never break the main flow
  }
}
