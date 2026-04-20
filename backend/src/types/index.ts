// ─── Enums ────────────────────────────────────────────────────────────────────

export type EquipmentStatus    = "assigned" | "available" | "maintenance" | "retired";
export type EquipmentCondition = "excellent" | "good" | "fair" | "poor";
export type HandoverStatus     = "completed" | "pending" | "cancelled";
export type HandoverActivityType = "reassign" | "return" | "new_issue";

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department_id: string;
  department?: string;   // joined department name
  role: string;
  avatar?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser extends User {
  password_hash: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  serial_number: string;
  tag_number: string;
  assigned_to: string | null;
  status: EquipmentStatus;
  purchase_date: string;
  condition: EquipmentCondition;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  assigned_user_name?: string | null;
  assigned_user_dept?: string | null;
}

export interface Handover {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  equipment_id: string;
  date: string;
  status: HandoverStatus;
  activity_type: HandoverActivityType;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HandoverWithDetails extends Handover {
  from_user_name?:    string | null;
  from_user_email?:   string | null;
  from_user_dept?:    string | null;
  to_user_name?:      string | null;
  to_user_email?:     string | null;
  to_user_dept?:      string | null;
  equipment_name?:    string | null;
  equipment_category?: string | null;
  equipment_serial?:  string | null;
  equipment_tag_number?: string | null;
  equipment_condition?: string | null;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// ─── API Shapes ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface DashboardStats {
  totalEquipment: number;
  assigned: number;
  available: number;
  maintenance: number;
  retired: number;
  totalUsers: number;
  totalHandovers: number;
  recentHandovers: HandoverWithDetails[];
  categoryBreakdown: { category: string; count: number }[];
  statusBreakdown:   { status: string;   count: number }[];
}

export interface ReportFilters {
  department?:   string;
  condition?:    string;
  category?:     string;
  period?:       "3m" | "6m" | "1y" | "all";
  dateFrom?:     string;
  dateTo?:       string;
  userId?:       string;
  activityType?: string;
}
