import React from 'react';
import { Check, PauseCircle, RotateCcw, XCircle } from 'lucide-react';
import { RequestStatus } from '../types';
import { PRIMARY_WORKFLOW_STEPS, STATUS_META } from '../services/workflowEngine';
import { cn } from '../utils/cn';

interface WorkflowProgressProps {
  status: RequestStatus;
  needsPurchase: boolean;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ status, needsPurchase }) => {
  const steps = React.useMemo(() => {
    if (needsPurchase) return PRIMARY_WORKFLOW_STEPS;
    return PRIMARY_WORKFLOW_STEPS.filter(
      (s) => s.status !== RequestStatus.AWAITING_FINANCE_APPROVAL
    );
  }, [needsPurchase]);

  const currentIndex = steps.findIndex((s) => s.status === status);
  const isBranched =
    status === RequestStatus.ON_HOLD ||
    status === RequestStatus.REJECTED ||
    status === RequestStatus.REOPENED;

  const progressPct =
    currentIndex >= 0 ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Workflow Stage Progression
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {STATUS_META[status].description}
          </p>
        </div>
        {!isBranched ? (
          <span className="text-sm font-mono tabular-nums font-semibold text-[#10B981]">
            {progressPct}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {status === RequestStatus.REJECTED ? (
              <XCircle className="w-4 h-4 text-rose-500" />
            ) : status === RequestStatus.ON_HOLD ? (
              <PauseCircle className="w-4 h-4 text-slate-500" />
            ) : (
              <RotateCcw className="w-4 h-4 text-amber-500" />
            )}
            <span>{STATUS_META[status].label}</span>
          </span>
        )}
      </div>

      {/* Continuous progress track */}
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-5">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            status === RequestStatus.REJECTED
              ? 'bg-rose-500 w-full'
              : status === RequestStatus.ON_HOLD
              ? 'bg-slate-400 w-1/2'
              : status === RequestStatus.REOPENED
              ? 'bg-amber-500 w-1/3'
              : 'bg-[#10B981]'
          )}
          style={!isBranched ? { width: `${progressPct}%` } : undefined}
        />
      </div>

      {/* Step nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {steps.map((step, idx) => {
          const isCompleted = !isBranched && currentIndex > idx;
          const isCurrent = !isBranched && currentIndex === idx;
          return (
            <div key={step.status} className="flex items-start gap-2.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 border transition-colors',
                  isCompleted
                    ? 'bg-[#10B981] border-[#10B981] text-white'
                    : isCurrent
                    ? 'bg-emerald-500/15 border-[#10B981] text-[#10B981] font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-xs font-medium truncate',
                    isCurrent
                      ? 'text-slate-900 dark:text-white'
                      : isCompleted
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {step.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-500">
                  {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Queued'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
