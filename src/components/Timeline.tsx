import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TimelineEvent } from '../types';
import { ROLE_LABELS, STATUS_META } from '../services/workflowEngine';
import { formatDateTime } from '../utils/formatters';

export const Timeline: React.FC<{ events: TimelineEvent[] }> = ({ events }) => {
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
      {events.map((ev) => (
        <li key={ev.id} className="relative pl-8">
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-[#10B981] bg-white dark:bg-[#0B1F3A]"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {ev.action}
            </div>
            <time className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {formatDateTime(ev.timestamp)}
            </time>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{ev.actorName}</span>
            <span aria-hidden="true">·</span>
            <span>{ROLE_LABELS[ev.actorRole]}</span>
            {ev.fromStatus && ev.toStatus && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  <span>{STATUS_META[ev.fromStatus].shortLabel}</span>
                  <ArrowRight className="w-3 h-3 text-[#10B981]" />
                  <span>{STATUS_META[ev.toStatus].shortLabel}</span>
                </span>
              </>
            )}
          </div>
          {ev.note && (
            <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {ev.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};
