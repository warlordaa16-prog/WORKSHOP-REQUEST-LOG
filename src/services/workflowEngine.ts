import {
  Priority,
  RequestStatus,
  TimelineEvent,
  User,
  UserRole,
  WorkflowActionOption,
  WorkshopRequest,
} from '../types';

export interface StatusMeta {
  label: string;
  shortLabel: string;
  description: string;
  tone: 'neutral' | 'info' | 'warning' | 'emerald' | 'danger';
}

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  [RequestStatus.OPEN]: {
    label: 'Open / Unassigned',
    shortLabel: 'Open',
    description: 'Submitted and awaiting workshop manager assignment',
    tone: 'info',
  },
  [RequestStatus.ASSIGNED]: {
    label: 'Assigned',
    shortLabel: 'Assigned',
    description: 'Technician assigned and scheduled for execution',
    tone: 'info',
  },
  [RequestStatus.IN_PROGRESS]: {
    label: 'In Progress',
    shortLabel: 'In Progress',
    description: 'Active workshop or field work underway',
    tone: 'warning',
  },
  [RequestStatus.AWAITING_HOD_APPROVAL]: {
    label: 'Awaiting HoD Approval',
    shortLabel: 'HoD Approval',
    description: 'Pending Head of Department verification or purchase sign-off',
    tone: 'warning',
  },
  [RequestStatus.AWAITING_FINANCE_APPROVAL]: {
    label: 'Awaiting Finance Approval',
    shortLabel: 'Finance Approval',
    description: 'Pending Finance purchase authorization',
    tone: 'warning',
  },
  [RequestStatus.COMPLETED]: {
    label: 'Completed',
    shortLabel: 'Completed',
    description: 'Work and approvals finished, awaiting final manager closure',
    tone: 'emerald',
  },
  [RequestStatus.CLOSED]: {
    label: 'Closed',
    shortLabel: 'Closed',
    description: 'Verified, filed, and closed',
    tone: 'emerald',
  },
  [RequestStatus.REJECTED]: {
    label: 'Rejected',
    shortLabel: 'Rejected',
    description: 'Declined during review or approval',
    tone: 'danger',
  },
  [RequestStatus.ON_HOLD]: {
    label: 'On Hold',
    shortLabel: 'On Hold',
    description: 'Temporarily paused awaiting parts, access, or scheduling',
    tone: 'neutral',
  },
  [RequestStatus.REOPENED]: {
    label: 'Reopened',
    shortLabel: 'Reopened',
    description: 'Reopened for follow-up inspection or rework',
    tone: 'warning',
  },
};

export const PRIORITY_META: Record<Priority, { label: string; tone: 'neutral' | 'info' | 'warning' | 'danger' }> = {
  [Priority.LOW]: { label: 'Low', tone: 'neutral' },
  [Priority.MEDIUM]: { label: 'Medium', tone: 'info' },
  [Priority.HIGH]: { label: 'High', tone: 'warning' },
  [Priority.URGENT]: { label: 'Urgent', tone: 'danger' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Administrator',
  [UserRole.REQUESTER]: 'Requester (Staff)',
  [UserRole.WORKSHOP_MANAGER]: 'Workshop Manager',
  [UserRole.TECHNICIAN]: 'Technician',
  [UserRole.HEAD_OF_DEPARTMENT]: 'Head of Department',
  [UserRole.FINANCE]: 'Finance',
};

export const PRIMARY_WORKFLOW_STEPS: Array<{ status: RequestStatus; label: string }> = [
  { status: RequestStatus.OPEN, label: 'Open' },
  { status: RequestStatus.ASSIGNED, label: 'Assigned' },
  { status: RequestStatus.IN_PROGRESS, label: 'In Progress' },
  { status: RequestStatus.AWAITING_HOD_APPROVAL, label: 'HoD Approval' },
  { status: RequestStatus.AWAITING_FINANCE_APPROVAL, label: 'Finance Approval' },
  { status: RequestStatus.COMPLETED, label: 'Completed' },
  { status: RequestStatus.CLOSED, label: 'Closed' },
];

export interface TransitionValidation {
  allowed: boolean;
  reason?: string;
}

/**
 * Pure, deterministic state machine & role-based permission guard.
 */
export function validateTransition(
  request: WorkshopRequest,
  targetStatus: RequestStatus,
  actor: User,
  options?: { technicianId?: string | null; note?: string }
): TransitionValidation {
  const from = request.status;

  if (from === targetStatus && targetStatus !== RequestStatus.ASSIGNED) {
    return { allowed: false, reason: `Request is already in ${STATUS_META[from].label}.` };
  }

  // Requesters can never perform workflow status transitions
  if (actor.role === UserRole.REQUESTER) {
    return { allowed: false, reason: 'Requesters cannot change workflow status.' };
  }

  const isAdmin = actor.role === UserRole.ADMIN;
  const isManager = actor.role === UserRole.WORKSHOP_MANAGER;
  const isTech = actor.role === UserRole.TECHNICIAN;
  const isHod = actor.role === UserRole.HEAD_OF_DEPARTMENT;
  const isFinance = actor.role === UserRole.FINANCE;

  const isAssignedTech = isTech && request.assignedTechnicianId === actor.id;
  const isDeptHod = isHod && request.departmentId === actor.departmentId;

  switch (targetStatus) {
    case RequestStatus.ASSIGNED: {
      if (!isManager && !isAdmin) {
        return { allowed: false, reason: 'Only Workshop Managers or Admins can assign technicians.' };
      }
      if (
        ![
          RequestStatus.OPEN,
          RequestStatus.ASSIGNED,
          RequestStatus.REOPENED,
          RequestStatus.ON_HOLD,
        ].includes(from)
      ) {
        return { allowed: false, reason: `Cannot assign technician from ${STATUS_META[from].label}.` };
      }
      const nextTech = options?.technicianId ?? request.assignedTechnicianId;
      if (!nextTech) {
        return { allowed: false, reason: 'A technician must be selected to assign this request.' };
      }
      return { allowed: true };
    }

    case RequestStatus.IN_PROGRESS: {
      if (from === RequestStatus.AWAITING_HOD_APPROVAL) {
        if (!isDeptHod && !isAdmin) {
          return {
            allowed: false,
            reason: 'Only the department Head of Department can return a request from HoD approval.',
          };
        }
        return { allowed: true };
      }
      if (!isAssignedTech && !isManager && !isAdmin) {
        return {
          allowed: false,
          reason: 'Only the assigned Technician, Workshop Manager, or Admin can move this job to In Progress.',
        };
      }
      if (![RequestStatus.ASSIGNED, RequestStatus.ON_HOLD, RequestStatus.REOPENED].includes(from)) {
        return { allowed: false, reason: `Cannot start work from ${STATUS_META[from].label}.` };
      }
      if (!request.assignedTechnicianId && !options?.technicianId) {
        return { allowed: false, reason: 'Assign a technician before starting work.' };
      }
      return { allowed: true };
    }

    case RequestStatus.AWAITING_HOD_APPROVAL: {
      if (!isAssignedTech && !isManager && !isAdmin) {
        return {
          allowed: false,
          reason: 'Only the assigned Technician, Workshop Manager, or Admin can submit for HoD approval.',
        };
      }
      if (from !== RequestStatus.IN_PROGRESS) {
        return { allowed: false, reason: 'Request must be In Progress before submitting for HoD approval.' };
      }
      return { allowed: true };
    }

    case RequestStatus.AWAITING_FINANCE_APPROVAL: {
      if (!isDeptHod && !isAdmin) {
        return {
          allowed: false,
          reason: 'Only the Head of Department for this department (or Admin) can approve to Finance.',
        };
      }
      if (from !== RequestStatus.AWAITING_HOD_APPROVAL) {
        return { allowed: false, reason: 'Request must be Awaiting HoD Approval first.' };
      }
      if (!request.needsPurchase) {
        return {
          allowed: false,
          reason: 'Finance approval is only required when purchase is flagged as needed.',
        };
      }
      return { allowed: true };
    }

    case RequestStatus.COMPLETED: {
      if (from === RequestStatus.AWAITING_HOD_APPROVAL) {
        if (!isDeptHod && !isAdmin) {
          return {
            allowed: false,
            reason: 'Only the Head of Department for this department (or Admin) can approve this request.',
          };
        }
        if (request.needsPurchase) {
          return {
            allowed: false,
            reason: 'Requests requiring purchase must go through Finance Approval after HoD approval.',
          };
        }
        return { allowed: true };
      }
      if (from === RequestStatus.AWAITING_FINANCE_APPROVAL) {
        if (!isFinance && !isAdmin) {
          return { allowed: false, reason: 'Only Finance or Admin can approve purchase requests.' };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Cannot complete directly from ${STATUS_META[from].label}.`,
      };
    }

    case RequestStatus.CLOSED: {
      if (!isManager && !isAdmin) {
        return { allowed: false, reason: 'Only Workshop Managers or Admins can close requests.' };
      }
      if (from !== RequestStatus.COMPLETED) {
        return { allowed: false, reason: 'Only Completed requests can be closed.' };
      }
      return { allowed: true };
    }

    case RequestStatus.REJECTED: {
      if (from === RequestStatus.AWAITING_HOD_APPROVAL) {
        if (!isDeptHod && !isAdmin) {
          return {
            allowed: false,
            reason: 'Only the Head of Department for this department can reject at HoD stage.',
          };
        }
        return { allowed: true };
      }
      if (from === RequestStatus.AWAITING_FINANCE_APPROVAL) {
        if (!isFinance && !isAdmin) {
          return { allowed: false, reason: 'Only Finance or Admin can reject at Finance stage.' };
        }
        return { allowed: true };
      }
      if (from === RequestStatus.OPEN && isDeptHod) {
        return { allowed: true };
      }
      if (!isManager && !isAdmin) {
        return { allowed: false, reason: 'Insufficient permission to reject this request.' };
      }
      if ([RequestStatus.CLOSED, RequestStatus.REJECTED].includes(from)) {
        return { allowed: false, reason: `Cannot reject a request that is ${STATUS_META[from].label}.` };
      }
      return { allowed: true };
    }

    case RequestStatus.ON_HOLD: {
      if ([RequestStatus.CLOSED, RequestStatus.REJECTED, RequestStatus.COMPLETED, RequestStatus.ON_HOLD].includes(from)) {
        return { allowed: false, reason: `Cannot put ${STATUS_META[from].label} request on hold.` };
      }
      if (from === RequestStatus.AWAITING_FINANCE_APPROVAL && isFinance) {
        return { allowed: true };
      }
      if (!isManager && !isAdmin && !isAssignedTech) {
        return { allowed: false, reason: 'Only Workshop Manager, assigned Technician, or Admin can place on hold.' };
      }
      return { allowed: true };
    }

    case RequestStatus.REOPENED: {
      if (!isManager && !isAdmin) {
        return { allowed: false, reason: 'Only Workshop Managers or Admins can reopen requests.' };
      }
      if (![RequestStatus.CLOSED, RequestStatus.COMPLETED, RequestStatus.REJECTED].includes(from)) {
        return { allowed: false, reason: 'Only Completed, Closed, or Rejected requests can be reopened.' };
      }
      return { allowed: true };
    }

    default:
      return { allowed: false, reason: 'Unsupported workflow transition.' };
  }
}

/**
 * Returns the exact context-sensitive action buttons available to the actor for a given request.
 */
export function getAvailableActions(request: WorkshopRequest, actor: User): WorkflowActionOption[] {
  const actions: WorkflowActionOption[] = [];

  const tryAdd = (option: WorkflowActionOption, techOverride?: string) => {
    const check = validateTransition(request, option.targetStatus, actor, {
      technicianId: techOverride ?? request.assignedTechnicianId ?? 'pending-select',
    });
    if (check.allowed) {
      actions.push(option);
    }
  };

  if (request.status === RequestStatus.OPEN || request.status === RequestStatus.REOPENED) {
    tryAdd({
      id: 'assign',
      label: request.assignedTechnicianId ? 'Reassign Technician' : 'Assign Technician',
      targetStatus: RequestStatus.ASSIGNED,
      variant: 'primary',
      requiresTechnician: true,
      description: 'Assign a technician and schedule workshop execution.',
    }, 'select-required');
  }

  if (request.status === RequestStatus.ASSIGNED) {
    tryAdd({
      id: 'reassign',
      label: 'Reassign Technician',
      targetStatus: RequestStatus.ASSIGNED,
      variant: 'secondary',
      requiresTechnician: true,
      description: 'Transfer this job to a different technician.',
    }, 'select-required');
  }

  if ([RequestStatus.ASSIGNED, RequestStatus.ON_HOLD, RequestStatus.REOPENED].includes(request.status)) {
    tryAdd({
      id: 'start-work',
      label: request.status === RequestStatus.ON_HOLD ? 'Resume Work' : 'Start Work',
      targetStatus: RequestStatus.IN_PROGRESS,
      variant: 'primary',
      description: 'Begin active workshop or field work on this request.',
    });
  }

  if (request.status === RequestStatus.IN_PROGRESS) {
    tryAdd({
      id: 'submit-hod',
      label: 'Submit for HoD Approval',
      targetStatus: RequestStatus.AWAITING_HOD_APPROVAL,
      variant: 'primary',
      requiresNote: true,
      description: 'Route completed work or purchase estimate to Head of Department.',
    });
  }

  if (request.status === RequestStatus.AWAITING_HOD_APPROVAL) {
    if (request.needsPurchase) {
      tryAdd({
        id: 'hod-approve-purchase',
        label: 'HoD Approve & Forward to Finance',
        targetStatus: RequestStatus.AWAITING_FINANCE_APPROVAL,
        variant: 'primary',
        requiresNote: true,
        description: 'Approve department request and route purchase to Finance.',
      });
    } else {
      tryAdd({
        id: 'hod-approve-complete',
        label: 'HoD Approve & Complete',
        targetStatus: RequestStatus.COMPLETED,
        variant: 'primary',
        requiresNote: true,
        description: 'Approve department sign-off and mark job completed.',
      });
    }
    tryAdd({
      id: 'hod-return',
      label: 'Return to Technician',
      targetStatus: RequestStatus.IN_PROGRESS,
      variant: 'secondary',
      requiresNote: true,
      description: 'Send back to In Progress for revision or additional work.',
    });
  }

  if (request.status === RequestStatus.AWAITING_FINANCE_APPROVAL) {
    tryAdd({
      id: 'finance-approve',
      label: 'Approve Purchase & Complete',
      targetStatus: RequestStatus.COMPLETED,
      variant: 'primary',
      requiresNote: true,
      description: 'Authorize purchase spend and mark request completed.',
    });
  }

  if (request.status === RequestStatus.COMPLETED) {
    tryAdd({
      id: 'close',
      label: 'Close Request',
      targetStatus: RequestStatus.CLOSED,
      variant: 'primary',
      description: 'Verify completion and close out the worksheet.',
    });
  }

  if ([RequestStatus.CLOSED, RequestStatus.COMPLETED, RequestStatus.REJECTED].includes(request.status)) {
    tryAdd({
      id: 'reopen',
      label: 'Reopen Request',
      targetStatus: RequestStatus.REOPENED,
      variant: 'warning',
      requiresNote: true,
      description: 'Reopen request for follow-up inspection or corrective work.',
    });
  }

  if (
    ![
      RequestStatus.CLOSED,
      RequestStatus.REJECTED,
      RequestStatus.COMPLETED,
      RequestStatus.ON_HOLD,
    ].includes(request.status)
  ) {
    tryAdd({
      id: 'hold',
      label: 'Put On Hold',
      targetStatus: RequestStatus.ON_HOLD,
      variant: 'secondary',
      requiresNote: true,
      description: 'Pause work temporarily (e.g., awaiting spare parts or site access).',
    });
  }

  if (![RequestStatus.CLOSED, RequestStatus.REJECTED].includes(request.status)) {
    tryAdd({
      id: 'reject',
      label: 'Reject',
      targetStatus: RequestStatus.REJECTED,
      variant: 'danger',
      requiresNote: true,
      description: 'Decline this request and record a rejection reason.',
    });
  }

  return actions;
}

/**
 * Pure transition executor returning a new immutable WorkshopRequest or throwing on invalid transition.
 */
export function applyTransition(
  request: WorkshopRequest,
  targetStatus: RequestStatus,
  actor: User,
  params: { note: string; technicianId?: string | null; nowIso?: string }
): WorkshopRequest {
  const validation = validateTransition(request, targetStatus, actor, {
    technicianId: params.technicianId,
    note: params.note,
  });
  if (!validation.allowed) {
    throw new Error(validation.reason || 'Transition not permitted.');
  }

  const now = params.nowIso ?? new Date().toISOString();
  const nextTechId =
    targetStatus === RequestStatus.ASSIGNED && params.technicianId !== undefined
      ? params.technicianId
      : request.assignedTechnicianId;

  const event: TimelineEvent = {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requestId: request.id,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action:
      request.status === RequestStatus.ASSIGNED && targetStatus === RequestStatus.ASSIGNED
        ? 'Reassigned Technician'
        : `Status changed to ${STATUS_META[targetStatus].label}`,
    fromStatus: request.status,
    toStatus: targetStatus,
    note: params.note.trim() || `Transitioned to ${STATUS_META[targetStatus].label}`,
    timestamp: now,
  };

  return {
    ...request,
    status: targetStatus,
    assignedTechnicianId: nextTechId,
    updatedAt: now,
    closedAt: targetStatus === RequestStatus.CLOSED ? now : targetStatus === RequestStatus.REOPENED ? null : request.closedAt,
    timeline: [event, ...request.timeline],
  };
}

/**
 * Role-based visibility check for requests.
 */
export function canUserViewRequest(request: WorkshopRequest, user: User): boolean {
  switch (user.role) {
    case UserRole.ADMIN:
    case UserRole.WORKSHOP_MANAGER:
      return true;
    case UserRole.REQUESTER:
      return request.requesterId === user.id;
    case UserRole.TECHNICIAN:
      return request.assignedTechnicianId === user.id;
    case UserRole.HEAD_OF_DEPARTMENT:
      return request.departmentId === user.departmentId;
    case UserRole.FINANCE:
      return (
        request.needsPurchase ||
        request.status === RequestStatus.AWAITING_FINANCE_APPROVAL ||
        (request.approvedCost ?? 0) > 0
      );
    default:
      return false;
  }
}

export function canUserAddComment(request: WorkshopRequest, user: User, kind: 'USER' | 'MANAGER'): boolean {
  if (kind === 'MANAGER') {
    return user.role === UserRole.WORKSHOP_MANAGER || user.role === UserRole.ADMIN;
  }
  // User comments: requester (own), manager, admin, hod (dept), tech (assigned)
  if (user.role === UserRole.REQUESTER) {
    return request.requesterId === user.id;
  }
  return canUserViewRequest(request, user);
}

export function canUserSubmitTechReport(request: WorkshopRequest, user: User): boolean {
  if (user.role === UserRole.ADMIN || user.role === UserRole.WORKSHOP_MANAGER) {
    return true;
  }
  if (user.role === UserRole.TECHNICIAN) {
    return request.assignedTechnicianId === user.id;
  }
  return false;
}
