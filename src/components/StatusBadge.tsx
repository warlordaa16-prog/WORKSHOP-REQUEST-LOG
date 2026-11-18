import React from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { Priority, RequestStatus } from '../types';
import { PRIORITY_META, STATUS_META } from '../services/workflowEngine';
import { cn } from '../utils/cn';

const STATUS_ICONS: Record<RequestStatus, React.ReactNode> = {
  [RequestStatus.OPEN]: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.ASSIGNED]: <UserCheck className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.IN_PROGRESS]: <Wrench className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.AWAITING_HOD_APPROVAL]: <Clock className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.AWAITING_FINANCE_APPROVAL]: <Clock className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.COMPLETED]: <ShieldCheck className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.CLOSED]: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.REJECTED]: <Ban className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.ON_HOLD]: <PauseCircle className="w-3.5 h-3.5 shrink-0" />,
  [RequestStatus.REOPENED]: <RotateCcw className="w-3.5 h-3.5 shrink-0" />,
};

const TONE_CLASSES: Record<'neutral' | 'info' | 'warning' | 'emerald' | 'danger', string> = {
  neutral:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700/80',
  info:
    'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
  warning:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  emerald:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  danger:
    'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
};

export const StatusBadge: React.FC<{ status: RequestStatus; compact?: boolean }> = ({
  status,
  compact = false,
}) => {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0',
        TONE_CLASSES[meta.tone]
      )}
      title={meta.description}
    >
      {STATUS_ICONS[status]}
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0',
        TONE_CLASSES[meta.tone]
      )}
    >
      {meta.label}
    </span>
  );
};
