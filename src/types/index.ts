export enum UserRole {
  ADMIN = 'ADMIN',
  REQUESTER = 'REQUESTER',
  WORKSHOP_MANAGER = 'WORKSHOP_MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  HEAD_OF_DEPARTMENT = 'HEAD_OF_DEPARTMENT',
  FINANCE = 'FINANCE',
}

export enum RequestStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_HOD_APPROVAL = 'AWAITING_HOD_APPROVAL',
  AWAITING_FINANCE_APPROVAL = 'AWAITING_FINANCE_APPROVAL',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
  ON_HOLD = 'ON_HOLD',
  REOPENED = 'REOPENED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum CommentKind {
  USER = 'USER',
  MANAGER = 'MANAGER',
}

export enum ApprovalStage {
  HOD = 'HOD',
  FINANCE = 'FINANCE',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
}

export enum MessageChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  title: string;
  active: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  costCenter: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Reason {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string; // base64 data URL
  uploadedById: string;
  uploadedAt: string;
}

export interface TechnicianReport {
  id: string;
  requestId: string;
  technicianId: string;
  technicianName: string;
  workDone: string;
  partsUsed: string;
  labourHours: number;
  partsCost: number;
  labourCost: number;
  totalCost: number;
  recommendations?: string;
  createdAt: string;
}

export interface CommentEntry {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  kind: CommentKind;
  body: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  requestId: string;
  stage: ApprovalStage;
  decision: ApprovalDecision;
  actorId: string;
  actorName: string;
  amountApproved?: number;
  note: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  requestId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  fromStatus?: RequestStatus;
  toStatus?: RequestStatus;
  note: string;
  timestamp: string;
}

export interface WorkshopRequest {
  id: string;
  referenceNumber: string; // e.g., WR-2026-00042
  title: string;
  description: string;
  departmentId: string;
  categoryId: string;
  reasonId: string;
  priority: Priority;
  location: string;
  status: RequestStatus;
  requesterId: string;
  assignedTechnicianId: string | null;
  needsPurchase: boolean;
  estimatedCost: number;
  approvedCost: number | null;
  dueDate: string; // ISO date string
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  attachments: Attachment[];
  technicianReports: TechnicianReport[];
  comments: CommentEntry[];
  approvals: ApprovalRecord[];
  timeline: TimelineEvent[];
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  requestId: string;
  referenceNumber: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface MessageLogEntry {
  id: string;
  requestId: string;
  referenceNumber: string;
  recipientName: string;
  recipientContact: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
  sentAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  entityType: 'REQUEST' | 'USER' | 'DEPARTMENT' | 'CATEGORY' | 'REASON' | 'SYSTEM';
  entityId: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AppDatabase {
  users: User[];
  departments: Department[];
  categories: Category[];
  reasons: Reason[];
  requests: WorkshopRequest[];
  notifications: NotificationItem[];
  messageLogs: MessageLogEntry[];
  auditLogs: AuditLogEntry[];
  nextReferenceSeq: number;
}

export interface WorkflowActionOption {
  id: string;
  label: string;
  targetStatus: RequestStatus;
  variant: 'primary' | 'secondary' | 'danger' | 'warning';
  requiresTechnician?: boolean;
  requiresNote?: boolean;
  description: string;
}
