import {
  AppDatabase,
  ApprovalDecision,
  ApprovalStage,
  AuditLogEntry,
  Category,
  CommentEntry,
  CommentKind,
  Department,
  MessageChannel,
  MessageLogEntry,
  NotificationItem,
  Reason,
  RequestStatus,
  TechnicianReport,
  User,
  UserRole,
  WorkshopRequest,
} from '../types';
import { createSeedDatabase } from './seedData';
import {
  applyTransition,
  canUserAddComment,
  canUserSubmitTechReport,
  STATUS_META,
} from './workflowEngine';

const DB_NAME = 'workshoplog_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const RECORD_KEY = 'primary_db';
const LS_FALLBACK_KEY = 'workshoplog_fallback_db_v1';

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function readDbRaw(): Promise<AppDatabase | null> {
  try {
    const db = await openIndexedDb();
    return await new Promise<AppDatabase | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(RECORD_KEY);
      getReq.onsuccess = () => resolve((getReq.result as AppDatabase) ?? null);
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      return raw ? (JSON.parse(raw) as AppDatabase) : null;
    } catch {
      return null;
    }
  }
}

async function writeDbRaw(data: AppDatabase): Promise<void> {
  try {
    const db = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(data, RECORD_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(data));
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createAudit(
  actor: User,
  entityType: AuditLogEntry['entityType'],
  entityId: string,
  action: string,
  details: string
): AuditLogEntry {
  return {
    id: makeId('aud'),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    entityType,
    entityId,
    action,
    details,
    timestamp: new Date().toISOString(),
  };
}

export const repository = {
  async loadDatabase(): Promise<AppDatabase> {
    const existing = await readDbRaw();
    if (existing && Array.isArray(existing.requests) && existing.requests.length > 0) {
      return existing;
    }
    const seeded = createSeedDatabase();
    await writeDbRaw(seeded);
    return seeded;
  },

  async resetDemoData(actor?: User): Promise<AppDatabase> {
    const fresh = createSeedDatabase();
    if (actor) {
      fresh.auditLogs.unshift(
        createAudit(actor, 'SYSTEM', 'reset', 'Reset Demo Data', 'Restored default 60 seeded requests and configuration.')
      );
    }
    await writeDbRaw(fresh);
    return fresh;
  },

  async createRequest(
    input: Omit<
      WorkshopRequest,
      | 'id'
      | 'referenceNumber'
      | 'status'
      | 'assignedTechnicianId'
      | 'approvedCost'
      | 'createdAt'
      | 'updatedAt'
      | 'closedAt'
      | 'technicianReports'
      | 'comments'
      | 'approvals'
      | 'timeline'
    >,
    actor: User
  ): Promise<{ db: AppDatabase; created: WorkshopRequest }> {
    const db = await this.loadDatabase();
    const now = new Date().toISOString();
    const seq = db.nextReferenceSeq;
    const ref = `WR-2026-${String(seq).padStart(5, '0')}`;
    const id = makeId('req');

    const created: WorkshopRequest = {
      ...input,
      id,
      referenceNumber: ref,
      status: RequestStatus.OPEN,
      assignedTechnicianId: null,
      approvedCost: null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      technicianReports: [],
      comments: [],
      approvals: [],
      timeline: [
        {
          id: makeId('tl'),
          requestId: id,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'Request Submitted',
          toStatus: RequestStatus.OPEN,
          note: `Submitted worksheet ${ref} (${input.location}).`,
          timestamp: now,
        },
      ],
    };

    // Notify workshop managers
    const managers = db.users.filter((u) => u.role === UserRole.WORKSHOP_MANAGER && u.active);
    const newNotifs: NotificationItem[] = managers.map((m) => ({
      id: makeId('notif'),
      recipientUserId: m.id,
      requestId: created.id,
      referenceNumber: created.referenceNumber,
      title: `New Request ${created.referenceNumber}`,
      message: `${actor.name} submitted "${created.title}" (${created.priority}).`,
      read: false,
      createdAt: now,
    }));

    const newMessages: MessageLogEntry[] = managers.map((m) => ({
      id: makeId('msg'),
      requestId: created.id,
      referenceNumber: created.referenceNumber,
      recipientName: m.name,
      recipientContact: m.email,
      channel: MessageChannel.EMAIL,
      subject: `[WorkshopLog] New request ${created.referenceNumber}`,
      body: `A new worksheet "${created.title}" has been submitted by ${actor.name} at ${created.location}.`,
      sentAt: now,
    }));

    const nextDb: AppDatabase = {
      ...db,
      requests: [created, ...db.requests],
      notifications: [...newNotifs, ...db.notifications],
      messageLogs: [...newMessages, ...db.messageLogs],
      auditLogs: [
        createAudit(actor, 'REQUEST', created.id, 'Create Request', `Created ${created.referenceNumber}: ${created.title}`),
        ...db.auditLogs,
      ],
      nextReferenceSeq: seq + 1,
    };

    await writeDbRaw(nextDb);
    return { db: nextDb, created };
  },

  async updateRequest(
    requestId: string,
    patch: Partial<
      Pick<
        WorkshopRequest,
        | 'title'
        | 'description'
        | 'departmentId'
        | 'categoryId'
        | 'reasonId'
        | 'priority'
        | 'location'
        | 'needsPurchase'
        | 'estimatedCost'
        | 'dueDate'
        | 'attachments'
      >
    >,
    actor: User
  ): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const existing = db.requests.find((r) => r.id === requestId);
    if (!existing) throw new Error('Request not found.');

    const canEdit =
      actor.role === UserRole.ADMIN ||
      actor.role === UserRole.WORKSHOP_MANAGER ||
      (actor.role === UserRole.REQUESTER &&
        existing.requesterId === actor.id &&
        [RequestStatus.OPEN, RequestStatus.REOPENED].includes(existing.status));

    if (!canEdit) {
      throw new Error('You do not have permission to edit this request in its current state.');
    }

    const now = new Date().toISOString();
    const updated: WorkshopRequest = {
      ...existing,
      ...patch,
      updatedAt: now,
      timeline: [
        {
          id: makeId('tl'),
          requestId: existing.id,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'Worksheet Updated',
          note: 'Request details modified.',
          timestamp: now,
        },
        ...existing.timeline,
      ],
    };

    const nextDb: AppDatabase = {
      ...db,
      requests: db.requests.map((r) => (r.id === requestId ? updated : r)),
      auditLogs: [
        createAudit(actor, 'REQUEST', requestId, 'Update Request', `Updated ${existing.referenceNumber}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async transitionRequest(
    requestId: string,
    targetStatus: RequestStatus,
    actor: User,
    params: {
      note: string;
      technicianId?: string | null;
      approvedAmount?: number;
      customEmailSubject?: string;
      customEmailBody?: string;
      customSmsText?: string;
    }
  ): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const existing = db.requests.find((r) => r.id === requestId);
    if (!existing) throw new Error('Request not found.');

    const transitioned = applyTransition(existing, targetStatus, actor, {
      note: params.note,
      technicianId: params.technicianId,
    });

    const now = transitioned.updatedAt;
    const approvals = [...transitioned.approvals];
    let approvedCost = transitioned.approvedCost;

    // Record formal approval/rejection decision when leaving HoD or Finance stage
    if (existing.status === RequestStatus.AWAITING_HOD_APPROVAL) {
      const decision =
        targetStatus === RequestStatus.REJECTED
          ? ApprovalDecision.REJECTED
          : targetStatus === RequestStatus.IN_PROGRESS
          ? ApprovalDecision.RETURNED
          : ApprovalDecision.APPROVED;
      approvals.unshift({
        id: makeId('app'),
        requestId: existing.id,
        stage: ApprovalStage.HOD,
        decision,
        actorId: actor.id,
        actorName: actor.name,
        amountApproved: decision === ApprovalDecision.APPROVED ? existing.estimatedCost : undefined,
        note: params.note || `HoD decision: ${decision}`,
        createdAt: now,
      });
    } else if (existing.status === RequestStatus.AWAITING_FINANCE_APPROVAL) {
      const decision =
        targetStatus === RequestStatus.REJECTED ? ApprovalDecision.REJECTED : ApprovalDecision.APPROVED;
      const amt = params.approvedAmount ?? existing.estimatedCost;
      if (decision === ApprovalDecision.APPROVED) {
        approvedCost = amt;
      }
      approvals.unshift({
        id: makeId('app'),
        requestId: existing.id,
        stage: ApprovalStage.FINANCE,
        decision,
        actorId: actor.id,
        actorName: actor.name,
        amountApproved: decision === ApprovalDecision.APPROVED ? amt : undefined,
        note: params.note || `Finance decision: ${decision}`,
        createdAt: now,
      });
    }

    const finalRequest: WorkshopRequest = {
      ...transitioned,
      approvals,
      approvedCost,
    };

    // Determine target notification recipients
    const recipients: User[] = [];
    const reqUser = db.users.find((u) => u.id === finalRequest.requesterId);
    if (reqUser && reqUser.id !== actor.id) recipients.push(reqUser);

    if (finalRequest.assignedTechnicianId) {
      const techUser = db.users.find((u) => u.id === finalRequest.assignedTechnicianId);
      if (techUser && techUser.id !== actor.id) recipients.push(techUser);
    }

    if (targetStatus === RequestStatus.AWAITING_HOD_APPROVAL) {
      db.users
        .filter((u) => u.role === UserRole.HEAD_OF_DEPARTMENT && u.departmentId === finalRequest.departmentId && u.active)
        .forEach((u) => {
          if (!recipients.some((r) => r.id === u.id)) recipients.push(u);
        });
    }

    if (targetStatus === RequestStatus.AWAITING_FINANCE_APPROVAL) {
      db.users
        .filter((u) => u.role === UserRole.FINANCE && u.active)
        .forEach((u) => {
          if (!recipients.some((r) => r.id === u.id)) recipients.push(u);
        });
    }

    if (targetStatus === RequestStatus.COMPLETED) {
      db.users
        .filter((u) => u.role === UserRole.WORKSHOP_MANAGER && u.active)
        .forEach((u) => {
          if (!recipients.some((r) => r.id === u.id) && u.id !== actor.id) recipients.push(u);
        });
    }

    const statusLabel = STATUS_META[targetStatus].label;
    const notifs: NotificationItem[] = recipients.map((rec) => ({
      id: makeId('notif'),
      recipientUserId: rec.id,
      requestId: finalRequest.id,
      referenceNumber: finalRequest.referenceNumber,
      title: `${finalRequest.referenceNumber} → ${statusLabel}`,
      message: params.note || `${actor.name} updated status to ${statusLabel}.`,
      read: false,
      createdAt: now,
    }));

    const messages: MessageLogEntry[] = [];
    recipients.forEach((rec) => {
      messages.push({
        id: makeId('msg'),
        requestId: finalRequest.id,
        referenceNumber: finalRequest.referenceNumber,
        recipientName: rec.name,
        recipientContact: rec.email,
        channel: MessageChannel.EMAIL,
        subject:
          params.customEmailSubject ||
          `[WorkshopLog] ${finalRequest.referenceNumber} is now ${statusLabel}`,
        body:
          params.customEmailBody ||
          `Hello ${rec.name}, worksheet ${finalRequest.referenceNumber} ("${finalRequest.title}") moved to ${statusLabel} by ${actor.name}. Note: ${params.note || '—'}`,
        sentAt: now,
      });
      if (params.customSmsText || targetStatus === RequestStatus.ASSIGNED || targetStatus === RequestStatus.COMPLETED) {
        messages.push({
          id: makeId('msg'),
          requestId: finalRequest.id,
          referenceNumber: finalRequest.referenceNumber,
          recipientName: rec.name,
          recipientContact: rec.phone,
          channel: MessageChannel.SMS,
          body:
            params.customSmsText ||
            `WorkshopLog: ${finalRequest.referenceNumber} (${finalRequest.title.slice(0, 32)}) is now ${statusLabel}.`,
          sentAt: now,
        });
      }
    });

    const nextDb: AppDatabase = {
      ...db,
      requests: db.requests.map((r) => (r.id === requestId ? finalRequest : r)),
      notifications: [...notifs, ...db.notifications],
      messageLogs: [...messages, ...db.messageLogs],
      auditLogs: [
        createAudit(
          actor,
          'REQUEST',
          requestId,
          `Transition → ${statusLabel}`,
          `${existing.referenceNumber}: ${existing.status} → ${targetStatus}. ${params.note}`
        ),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async addTechnicianReport(
    requestId: string,
    actor: User,
    input: {
      workDone: string;
      partsUsed: string;
      labourHours: number;
      partsCost: number;
      labourCost: number;
      recommendations?: string;
    }
  ): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const existing = db.requests.find((r) => r.id === requestId);
    if (!existing) throw new Error('Request not found.');
    if (!canUserSubmitTechReport(existing, actor)) {
      throw new Error('Only the assigned technician, workshop manager, or admin can file a technician report.');
    }

    const now = new Date().toISOString();
    const report: TechnicianReport = {
      id: makeId('rep'),
      requestId,
      technicianId: actor.id,
      technicianName: actor.name,
      workDone: input.workDone.trim(),
      partsUsed: input.partsUsed.trim(),
      labourHours: Number(input.labourHours) || 0,
      partsCost: Number(input.partsCost) || 0,
      labourCost: Number(input.labourCost) || 0,
      totalCost: (Number(input.partsCost) || 0) + (Number(input.labourCost) || 0),
      recommendations: input.recommendations?.trim() || undefined,
      createdAt: now,
    };

    const updated: WorkshopRequest = {
      ...existing,
      updatedAt: now,
      technicianReports: [report, ...existing.technicianReports],
      timeline: [
        {
          id: makeId('tl'),
          requestId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'Technician Report Filed',
          note: `Logged ${report.labourHours}h labour, $${report.totalCost.toFixed(2)} total cost.`,
          timestamp: now,
        },
        ...existing.timeline,
      ],
    };

    const nextDb: AppDatabase = {
      ...db,
      requests: db.requests.map((r) => (r.id === requestId ? updated : r)),
      auditLogs: [
        createAudit(actor, 'REQUEST', requestId, 'Add Tech Report', `Filed report on ${existing.referenceNumber}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async addComment(
    requestId: string,
    actor: User,
    kind: CommentKind,
    body: string
  ): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const existing = db.requests.find((r) => r.id === requestId);
    if (!existing) throw new Error('Request not found.');
    if (!canUserAddComment(existing, actor, kind)) {
      throw new Error(`Your role does not have permission to post ${kind.toLowerCase()} comments on this request.`);
    }

    const now = new Date().toISOString();
    const entry: CommentEntry = {
      id: makeId('cmt'),
      requestId,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      kind,
      body: body.trim(),
      createdAt: now,
    };

    const updated: WorkshopRequest = {
      ...existing,
      updatedAt: now,
      comments: [entry, ...existing.comments],
      timeline: [
        {
          id: makeId('tl'),
          requestId,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: kind === CommentKind.MANAGER ? 'Manager Comment Added' : 'Comment Added',
          note: entry.body.slice(0, 120),
          timestamp: now,
        },
        ...existing.timeline,
      ],
    };

    const nextDb: AppDatabase = {
      ...db,
      requests: db.requests.map((r) => (r.id === requestId ? updated : r)),
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async markNotificationRead(notificationId: string): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const nextDb: AppDatabase = {
      ...db,
      notifications: db.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async markAllNotificationsRead(userId: string): Promise<AppDatabase> {
    const db = await this.loadDatabase();
    const nextDb: AppDatabase = {
      ...db,
      notifications: db.notifications.map((n) => (n.recipientUserId === userId ? { ...n, read: true } : n)),
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  // Admin CRUD operations (strictly guarded)
  async saveUser(user: User, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const exists = db.users.some((u) => u.id === user.id);
    const nextUsers = exists ? db.users.map((u) => (u.id === user.id ? user : u)) : [...db.users, user];
    const nextDb: AppDatabase = {
      ...db,
      users: nextUsers,
      auditLogs: [
        createAudit(actor, 'USER', user.id, exists ? 'Update User' : 'Create User', `${user.name} (${user.role})`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async deleteUser(userId: string, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    if (actor.id === userId) throw new Error('Cannot delete your own active admin account.');
    const db = await this.loadDatabase();
    const target = db.users.find((u) => u.id === userId);
    const nextDb: AppDatabase = {
      ...db,
      users: db.users.filter((u) => u.id !== userId),
      auditLogs: [
        createAudit(actor, 'USER', userId, 'Delete User', `Removed user ${target?.name ?? userId}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async saveDepartment(dept: Department, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const exists = db.departments.some((d) => d.id === dept.id);
    const nextDepts = exists
      ? db.departments.map((d) => (d.id === dept.id ? dept : d))
      : [...db.departments, dept];
    const nextDb: AppDatabase = {
      ...db,
      departments: nextDepts,
      auditLogs: [
        createAudit(actor, 'DEPARTMENT', dept.id, exists ? 'Update Department' : 'Create Department', dept.name),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async deleteDepartment(deptId: string, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const inUse = db.requests.some((r) => r.departmentId === deptId);
    if (inUse) throw new Error('Cannot delete department while requests reference it. Mark it inactive instead.');
    const nextDb: AppDatabase = {
      ...db,
      departments: db.departments.filter((d) => d.id !== deptId),
      auditLogs: [
        createAudit(actor, 'DEPARTMENT', deptId, 'Delete Department', `Deleted department ${deptId}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async saveCategory(cat: Category, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const exists = db.categories.some((c) => c.id === cat.id);
    const nextCats = exists
      ? db.categories.map((c) => (c.id === cat.id ? cat : c))
      : [...db.categories, cat];
    const nextDb: AppDatabase = {
      ...db,
      categories: nextCats,
      auditLogs: [
        createAudit(actor, 'CATEGORY', cat.id, exists ? 'Update Category' : 'Create Category', cat.name),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async deleteCategory(catId: string, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const inUse = db.requests.some((r) => r.categoryId === catId);
    if (inUse) throw new Error('Cannot delete category while requests reference it. Mark it inactive instead.');
    const nextDb: AppDatabase = {
      ...db,
      categories: db.categories.filter((c) => c.id !== catId),
      auditLogs: [
        createAudit(actor, 'CATEGORY', catId, 'Delete Category', `Deleted category ${catId}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async saveReason(reason: Reason, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const exists = db.reasons.some((r) => r.id === reason.id);
    const nextReasons = exists
      ? db.reasons.map((r) => (r.id === reason.id ? reason : r))
      : [...db.reasons, reason];
    const nextDb: AppDatabase = {
      ...db,
      reasons: nextReasons,
      auditLogs: [
        createAudit(actor, 'REASON', reason.id, exists ? 'Update Reason' : 'Create Reason', reason.name),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },

  async deleteReason(reasonId: string, actor: User): Promise<AppDatabase> {
    if (actor.role !== UserRole.ADMIN) throw new Error('Admin role required.');
    const db = await this.loadDatabase();
    const inUse = db.requests.some((r) => r.reasonId === reasonId);
    if (inUse) throw new Error('Cannot delete reason while requests reference it. Mark it inactive instead.');
    const nextDb: AppDatabase = {
      ...db,
      reasons: db.reasons.filter((r) => r.id !== reasonId),
      auditLogs: [
        createAudit(actor, 'REASON', reasonId, 'Delete Reason', `Deleted reason ${reasonId}`),
        ...db.auditLogs,
      ],
    };
    await writeDbRaw(nextDb);
    return nextDb;
  },
};
