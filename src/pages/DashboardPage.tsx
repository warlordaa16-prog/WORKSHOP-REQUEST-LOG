import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { RequestStatus, UserRole } from '../types';
import {
  canUserViewRequest,
  ROLE_LABELS,
  STATUS_META,
} from '../services/workflowEngine';
import {
  formatCurrency,
  formatDate,
  getRequestAgeDays,
  isRequestOverdue,
} from '../utils/formatters';
import { aiService, DashboardInsightObservation } from '../services/aiService';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';

const CHART_COLORS = ['#10B981', '#0EA5E9', '#F59E0B', '#6366F1', '#EC4899', '#64748B'];

export const DashboardPage: React.FC = () => {
  const { db, loading, error, currentUser } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [insights, setInsights] = useState<DashboardInsightObservation[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const visibleRequests = useMemo(() => {
    if (!db || !currentUser) return [];
    return db.requests.filter((r) => canUserViewRequest(r, currentUser));
  }, [db, currentUser]);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const openStatuses = [
      RequestStatus.OPEN,
      RequestStatus.ASSIGNED,
      RequestStatus.IN_PROGRESS,
      RequestStatus.AWAITING_HOD_APPROVAL,
      RequestStatus.AWAITING_FINANCE_APPROVAL,
      RequestStatus.ON_HOLD,
      RequestStatus.REOPENED,
    ];

    const openCount = visibleRequests.filter((r) => openStatuses.includes(r.status)).length;
    const unassignedCount = visibleRequests.filter((r) => r.status === RequestStatus.OPEN).length;
    const overdueCount = visibleRequests.filter((r) => isRequestOverdue(r, now)).length;

    const closedThisMonth = visibleRequests.filter((r) => {
      if (r.status !== RequestStatus.CLOSED || !r.closedAt) return false;
      const d = new Date(r.closedAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const closedAll = visibleRequests.filter((r) => r.status === RequestStatus.CLOSED && r.closedAt);
    const avgTurnaroundDays =
      closedAll.length > 0
        ? Math.round(
            (closedAll.reduce((sum, r) => sum + getRequestAgeDays(r), 0) / closedAll.length) * 10
          ) / 10
        : 0;

    const totalApprovedSpend = visibleRequests.reduce(
      (sum, r) => sum + (r.approvedCost ?? 0),
      0
    );

    return {
      openCount,
      unassignedCount,
      overdueCount,
      closedThisMonth,
      avgTurnaroundDays,
      totalApprovedSpend,
      totalVisible: visibleRequests.length,
    };
  }, [visibleRequests]);

  const statusChartData = useMemo(() => {
    const counts = new Map<RequestStatus, number>();
    visibleRequests.forEach((r) => {
      counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    });
    return Object.values(RequestStatus)
      .map((st) => ({
        name: STATUS_META[st].shortLabel,
        count: counts.get(st) ?? 0,
      }))
      .filter((d) => d.count > 0);
  }, [visibleRequests]);

  const departmentChartData = useMemo(() => {
    if (!db) return [];
    return db.departments.map((dept) => ({
      name: dept.code,
      fullName: dept.name,
      count: visibleRequests.filter((r) => r.departmentId === dept.id).length,
    }));
  }, [db, visibleRequests]);

  const categoryChartData = useMemo(() => {
    if (!db) return [];
    return db.categories
      .map((cat) => ({
        name: cat.name.length > 16 ? `${cat.name.slice(0, 15)}…` : cat.name,
        fullName: cat.name,
        count: visibleRequests.filter((r) => r.categoryId === cat.id).length,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [db, visibleRequests]);

  const techWorkloadData = useMemo(() => {
    if (!db) return [];
    const techs = db.users.filter((u) => u.role === UserRole.TECHNICIAN && u.active);
    return techs.map((tech) => {
      const assigned = visibleRequests.filter((r) => r.assignedTechnicianId === tech.id);
      const active = assigned.filter(
        (r) => ![RequestStatus.CLOSED, RequestStatus.COMPLETED, RequestStatus.REJECTED].includes(r.status)
      ).length;
      const done = assigned.filter((r) =>
        [RequestStatus.CLOSED, RequestStatus.COMPLETED].includes(r.status)
      ).length;
      return {
        name: tech.name.split(' ')[0],
        fullName: tech.name,
        active,
        completed: done,
      };
    });
  }, [db, visibleRequests]);

  const focusQueue = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === UserRole.HEAD_OF_DEPARTMENT) {
      return visibleRequests.filter((r) => r.status === RequestStatus.AWAITING_HOD_APPROVAL).slice(0, 6);
    }
    if (currentUser.role === UserRole.FINANCE) {
      return visibleRequests.filter((r) => r.status === RequestStatus.AWAITING_FINANCE_APPROVAL).slice(0, 6);
    }
    if (currentUser.role === UserRole.TECHNICIAN) {
      return visibleRequests
        .filter((r) =>
          [RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS, RequestStatus.REOPENED].includes(r.status)
        )
        .slice(0, 6);
    }
    if (currentUser.role === UserRole.WORKSHOP_MANAGER || currentUser.role === UserRole.ADMIN) {
      return visibleRequests
        .filter((r) => r.status === RequestStatus.OPEN || isRequestOverdue(r))
        .slice(0, 6);
    }
    return visibleRequests.slice(0, 6);
  }, [visibleRequests, currentUser]);

  const fetchInsights = useCallback(async () => {
    if (!currentUser || visibleRequests.length === 0) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const payload = {
        role: currentUser.role,
        metrics,
        byStatus: statusChartData,
        byDepartment: departmentChartData,
        byCategory: categoryChartData,
        technicianWorkload: techWorkloadData,
      };
      const res = await aiService.dashboardInsights(payload);
      setInsights(res.observations || []);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Unable to load Gemini insights.');
    } finally {
      setInsightsLoading(false);
    }
  }, [currentUser, visibleRequests.length, metrics, statusChartData, departmentChartData, categoryChartData, techWorkloadData]);

  useEffect(() => {
    if (db && currentUser && insights === null && !insightsLoading && !insightsError) {
      fetchInsights();
    }
  }, [db, currentUser, insights, insightsLoading, insightsError, fetchInsights]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white dark:bg-[#0B1F3A] border border-slate-200 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !db || !currentUser) {
    return (
      <EmptyState
        title="Unable to load dashboard"
        description={error || 'Workspace data could not be initialized.'}
        actionLabel="Retry"
        onAction={() => window.location.reload()}
      />
    );
  }

  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#475569';
  const gridStroke = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0B1F3A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#1E293B' : '#E2E8F0',
    borderRadius: '0.5rem',
    fontSize: '12px',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
            Operations Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Viewing {metrics.totalVisible} accessible worksheets as {currentUser.name} ·{' '}
            {ROLE_LABELS[currentUser.role]}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/requests"
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0B1F3A] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Browse All Requests
          </Link>
        </div>
      </div>

      {/* KPI Strip (5 columns on xl) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Open Worksheets</div>
          <div className="mt-2 text-2xl font-display font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.openCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active across workflow stages</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Unassigned</div>
          <div className="mt-2 text-2xl font-display font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {metrics.unassignedCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Awaiting technician dispatch</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue</div>
          <div className="mt-2 text-2xl font-display font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {metrics.overdueCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Past scheduled due date</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Closed This Month</div>
          <div className="mt-2 text-2xl font-display font-bold tabular-nums text-[#10B981]">
            {metrics.closedThisMonth}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Verified &amp; archived</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Turnaround</div>
          <div className="mt-2 text-2xl font-display font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.avgTurnaroundDays}d
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Approved spend {formatCurrency(metrics.totalApprovedSpend)}
          </div>
        </div>
      </section>

      {/* Main Split: Charts + Gemini Insights Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 8 cols: 2x2 Charts Grid */}
        <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1: By Status */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Requests by Status
            </h2>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 4, right: 8, left: -18, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                    {statusChartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: By Department */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Requests by Department
            </h2>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [value, 'Requests']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: By Category */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Requests by Category
            </h2>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 24, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fill: axisTickColor, fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="count" name="Requests" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Technician Workload */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Technician Workload
            </h2>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techWorkloadData} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="active" name="Active Jobs" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed / Closed" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right 4 cols: Gemini Insights Panel + Action Queue */}
        <div className="xl:col-span-4 space-y-6">
          {/* Gemini Insights Panel */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#10B981]" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Workshop Intelligence
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchInsights}
                disabled={insightsLoading}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', insightsLoading && 'animate-spin')} />
                <span>Refresh</span>
              </button>
            </div>

            {insightsLoading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 dark:bg-[#071121] space-y-2">
                    <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            ) : insightsError ? (
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071121] text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Gemini insights unavailable
                </div>
                <p>{insightsError}</p>
                <p className="text-slate-500">
                  Core metrics remain live: {metrics.unassignedCount} unassigned, {metrics.overdueCount}{' '}
                  overdue, average turnaround {metrics.avgTurnaroundDays} days.
                </p>
              </div>
            ) : insights && insights.length > 0 ? (
              <ul className="space-y-2.5">
                {insights.map((obs, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#071121]/70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {obs.title}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-medium px-1.5 py-0.5 rounded',
                          obs.severity === 'critical'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : obs.severity === 'warning'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        )}
                      >
                        {obs.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {obs.detail}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click Refresh to generate observations from current workshop data.
              </p>
            )}
          </section>

          {/* Role-Specific Priority Queue */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {currentUser.role === UserRole.HEAD_OF_DEPARTMENT
                  ? 'Pending HoD Approvals'
                  : currentUser.role === UserRole.FINANCE
                  ? 'Pending Purchase Approvals'
                  : currentUser.role === UserRole.TECHNICIAN
                  ? 'Your Active Jobs'
                  : currentUser.role === UserRole.REQUESTER
                  ? 'Your Recent Requests'
                  : 'Attention Queue'}
              </h2>
              <Link
                to="/requests"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] hover:underline"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {focusQueue.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                <Wrench className="w-5 h-5 mx-auto mb-2 opacity-40" />
                No urgent items waiting in your queue.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {focusQueue.map((req) => {
                  const overdue = isRequestOverdue(req);
                  return (
                    <li key={req.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/requests/${req.id}`)}
                        className="w-full text-left py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-[#10B981]">
                            {req.referenceNumber}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {overdue && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                              </span>
                            )}
                            <PriorityBadge priority={req.priority} />
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                          {req.title}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <StatusBadge status={req.status} compact />
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="w-3 h-3" />
                            Due {formatDate(req.dueDate)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
