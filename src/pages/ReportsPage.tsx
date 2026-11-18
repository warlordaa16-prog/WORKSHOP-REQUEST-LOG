import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Printer } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { RequestStatus, UserRole } from '../types';
import { canUserViewRequest, STATUS_META } from '../services/workflowEngine';
import {
  exportRowsToCsv,
  formatCurrency,
  formatDate,
  getRequestAgeDays,
  getTotalReportedCost,
  isRequestOverdue,
} from '../utils/formatters';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

export const ReportsPage: React.FC = () => {
  const { db, currentUser } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deptId, setDeptId] = useState('ALL');
  const [catId, setCatId] = useState('ALL');
  const [techId, setTechId] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const technicians = useMemo(
    () => (db?.users || []).filter((u) => u.role === UserRole.TECHNICIAN),
    [db?.users]
  );

  const filteredRequests = useMemo(() => {
    if (!db || !currentUser) return [];
    const startMs = startDate ? new Date(`${startDate}T00:00:00Z`).getTime() : null;
    const endMs = endDate ? new Date(`${endDate}T23:59:59Z`).getTime() : null;

    return db.requests
      .filter((r) => canUserViewRequest(r, currentUser))
      .filter((r) => {
        const createdMs = new Date(r.createdAt).getTime();
        if (startMs !== null && createdMs < startMs) return false;
        if (endMs !== null && createdMs > endMs) return false;
        if (deptId !== 'ALL' && r.departmentId !== deptId) return false;
        if (catId !== 'ALL' && r.categoryId !== catId) return false;
        if (techId !== 'ALL' && r.assignedTechnicianId !== techId) return false;
        if (status !== 'ALL' && r.status !== status) return false;
        return true;
      });
  }, [db, currentUser, startDate, endDate, deptId, catId, techId, status]);

  const deptsById = useMemo(() => new Map((db?.departments || []).map((d) => [d.id, d])), [db?.departments]);
  const catsById = useMemo(() => new Map((db?.categories || []).map((c) => [c.id, c])), [db?.categories]);
  const usersById = useMemo(() => new Map((db?.users || []).map((u) => [u.id, u])), [db?.users]);

  const techPerformance = useMemo(() => {
    return technicians.map((tech) => {
      const jobs = filteredRequests.filter((r) => r.assignedTechnicianId === tech.id);
      const completed = jobs.filter((r) =>
        [RequestStatus.COMPLETED, RequestStatus.CLOSED].includes(r.status)
      );
      const hours = jobs.reduce(
        (sum, r) => sum + r.technicianReports.reduce((s, rep) => s + rep.labourHours, 0),
        0
      );
      const totalCost = jobs.reduce((sum, r) => sum + getTotalReportedCost(r), 0);
      const avgDays =
        completed.length > 0
          ? Math.round(
              (completed.reduce((s, r) => s + getRequestAgeDays(r), 0) / completed.length) * 10
            ) / 10
          : 0;
      return {
        tech,
        assignedCount: jobs.length,
        completedCount: completed.length,
        hours,
        totalCost,
        avgDays,
      };
    });
  }, [technicians, filteredRequests]);

  const costByDepartment = useMemo(() => {
    if (!db) return [];
    return db.departments.map((d) => {
      const deptReqs = filteredRequests.filter((r) => r.departmentId === d.id);
      const estimated = deptReqs.reduce((s, r) => s + r.estimatedCost, 0);
      const actual = deptReqs.reduce((s, r) => s + getTotalReportedCost(r), 0);
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        costCenter: d.costCenter,
        count: deptReqs.length,
        estimated: Math.round(estimated),
        actual: Math.round(actual),
      };
    });
  }, [db, filteredRequests]);

  const overdueRequests = useMemo(() => {
    return filteredRequests
      .filter((r) => isRequestOverdue(r))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [filteredRequests]);

  const handleExportCsv = () => {
    const headers = [
      'Reference',
      'Title',
      'Department',
      'Category',
      'Priority',
      'Status',
      'Technician',
      'Estimated Cost',
      'Reported/Approved Cost',
      'Created',
      'Due Date',
      'Age (Days)',
    ];
    const rows = filteredRequests.map((r) => [
      r.referenceNumber,
      r.title,
      deptsById.get(r.departmentId)?.name ?? '',
      catsById.get(r.categoryId)?.name ?? '',
      r.priority,
      STATUS_META[r.status].label,
      r.assignedTechnicianId ? usersById.get(r.assignedTechnicianId)?.name ?? '' : 'Unassigned',
      r.estimatedCost.toFixed(2),
      getTotalReportedCost(r).toFixed(2),
      formatDate(r.createdAt),
      formatDate(r.dueDate),
      getRequestAgeDays(r),
    ]);
    exportRowsToCsv(`workshoplog-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  if (!db || !currentUser) return null;

  const axisTickColor = theme === 'dark' ? '#94A3B8' : '#475569';
  const gridStroke = theme === 'dark' ? '#1E293B' : '#E2E8F0';

  return (
    <div className="space-y-6 print-container">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Operational Reports
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Technician performance, departmental maintenance costs, and aging analysis ({filteredRequests.length} worksheets).
          </p>
        </div>
        <div className="no-print flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRequests.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1F3A] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-[#10B981]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            From Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            To Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Department
          </label>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Departments</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Category
          </label>
          <select
            value={catId}
            onChange={(e) => setCatId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Categories</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Technician
          </label>
          <select
            value={techId}
            onChange={(e) => setTechId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(RequestStatus).map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Cost by Department */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Cost by Department (Estimated vs Reported)
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByDepartment} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="code" tick={{ fill: axisTickColor, fontSize: 11 }} />
                <YAxis tick={{ fill: axisTickColor, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#0B1F3A' : '#FFFFFF',
                    borderColor: theme === 'dark' ? '#1E293B' : '#E2E8F0',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="estimated" name="Estimated ($)" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Reported / Approved ($)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Department Cost Ledger
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Cost Center</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Jobs</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Estimated</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actual / Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {costByDepartment.map((row) => (
                  <tr key={row.id} className="h-10">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">
                      {row.costCenter}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{row.count}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatCurrency(row.estimated)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-[#10B981]">
                      {formatCurrency(row.actual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Technician Performance */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Technician Performance Summary
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Technician</th>
                <th className="px-4 py-2.5 font-semibold">Specialty</th>
                <th className="px-4 py-2.5 font-semibold text-right">Assigned Jobs</th>
                <th className="px-4 py-2.5 font-semibold text-right">Completed / Closed</th>
                <th className="px-4 py-2.5 font-semibold text-right">Logged Hours</th>
                <th className="px-4 py-2.5 font-semibold text-right">Avg Turnaround</th>
                <th className="px-4 py-2.5 font-semibold text-right">Total Job Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
              {techPerformance.map((row) => (
                <tr key={row.tech.id} className="h-11">
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                    {row.tech.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{row.tech.title}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{row.assignedCount}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-[#10B981] font-semibold">
                    {row.completedCount}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{row.hours}h</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{row.avgDays}d</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {formatCurrency(row.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Overdue & Aging Report */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Overdue &amp; Aging Worksheets ({overdueRequests.length})
          </h2>
        </div>
        {overdueRequests.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Zero overdue requests"
              description="All active worksheets matching the current filter are within their scheduled target dates."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Title</th>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Due Date</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Age (Days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {overdueRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => navigate(`/requests/${req.id}`)}
                    className="h-11 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2 font-mono font-semibold text-[#10B981]">
                      {req.referenceNumber}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {req.title}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {deptsById.get(req.departmentId)?.name}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={req.status} compact />
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {formatDate(req.dueDate)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {getRequestAgeDays(req)}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
