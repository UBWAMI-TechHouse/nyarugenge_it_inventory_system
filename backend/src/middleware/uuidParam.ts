import { param, body } from "express-validator";

// express-validator v7 isUUID() strictly checks version/variant bits.
// Our seed IDs (e.g. aa100000-0000-0000-0000-000000000001) are valid UUID-format
// strings but don't have a standard version nibble, so they fail isUUID().
// This helper uses a plain hex pattern instead.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidParam = (name: string) =>
  param(name).matches(UUID_RE).withMessage(`${name} must be a valid UUID`);

export const uuidBody = (name: string, msg?: string) =>
  body(name).matches(UUID_RE).withMessage(msg ?? `${name} must be a valid UUID`);

export const uuidBodyOptional = (name: string) =>
  body(name).optional({ nullable: true }).matches(UUID_RE);
