import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Mail, MessageSquareText } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { MessageChannel } from '../types';
import { formatDateTime, formatRelativeTime } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';

export const NotificationsPage: React.FC = () => {
  const {
    db,
    currentUser,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'inbox' | 'messages'>('inbox');

  const userNotifications = useMemo(() => {
    if (!db || !currentUser) return [];
    return db.notifications.filter((n) => n.recipientUserId === currentUser.id);
  }, [db, currentUser]);

  const messageLogs = useMemo(() => db?.messageLogs || [], [db?.messageLogs]);

  if (!db || !currentUser) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Notifications Center
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            In-app workflow alerts and simulated SMS / email dispatch logs.
          </p>
        </div>

        {tab === 'inbox' && userNotifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={() => markAllNotificationsRead()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1F3A] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <CheckCheck className="w-4 h-4 text-[#10B981]" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={cn(
            'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
            tab === 'inbox'
              ? 'border-[#10B981] text-[#10B981]'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          In-App Alerts ({userNotifications.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('messages')}
          className={cn(
            'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
            tab === 'messages'
              ? 'border-[#10B981] text-[#10B981]'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          Simulated Email &amp; SMS Log ({messageLogs.length})
        </button>
      </div>

      {tab === 'inbox' && (
        <div className="space-y-3">
          {userNotifications.length === 0 ? (
            <EmptyState
              title="No notifications for this role"
              description="Assignments, status updates, and approval requests targeting your account will appear here."
              icon={<Bell className="w-5 h-5" />}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {userNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'p-4 flex flex-wrap items-center justify-between gap-4 transition-colors',
                    !notif.read && 'bg-emerald-500/5'
                  )}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      if (!notif.read) await markNotificationRead(notif.id);
                      navigate(`/requests/${notif.requestId}`);
                    }}
                    className="text-left flex-1 min-w-[240px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#10B981]">
                        {notif.referenceNumber}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {notif.title}
                      </span>
                      {!notif.read && (
                        <span className="text-[11px] font-semibold text-[#10B981]">New</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{notif.message}</p>
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(notif.id)}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'messages' && (
        <div>
          {messageLogs.length === 0 ? (
            <EmptyState
              title="Message log is empty"
              description="Simulated email and SMS notifications dispatched on workflow transitions appear here."
              icon={<Mail className="w-5 h-5" />}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {messageLogs.map((msg) => (
                <div key={msg.id} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      {msg.channel === MessageChannel.EMAIL ? (
                        <Mail className="w-3.5 h-3.5 text-sky-500" />
                      ) : (
                        <MessageSquareText className="w-3.5 h-3.5 text-[#10B981]" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {msg.channel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        To: {msg.recipientName} ({msg.recipientContact})
                      </span>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/requests/${msg.requestId}`)}
                        className="font-mono font-semibold text-[#10B981] hover:underline"
                      >
                        {msg.referenceNumber}
                      </button>
                    </div>
                    <time className="font-mono text-xs tabular-nums text-slate-500">
                      {formatDateTime(msg.sentAt)}
                    </time>
                  </div>
                  {msg.subject && (
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Subject: {msg.subject}
                    </div>
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
