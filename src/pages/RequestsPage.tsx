import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { Priority, RequestStatus, UserRole, WorkshopRequest } from '../types';
import { canUserViewRequest } from '../services/workflowEngine';
import { DataTable, DataTableColumn } from '../components/DataTable';
import { PriorityBadge, StatusBadge } from '../components/StatusBadge';
import {
  formatCurrency,
  formatDate,
  getTotalReportedCost,
  isRequestOverdue,
} from '../utils/formatters';
import { cn } from '../utils/cn';

type RequestTabKey =
  | 'all'
  | 'open'
  | 'unassigned'
  | 'closed'
  | 'hod_all'
  | 'hod_purchase'
  | 'finance_all'
  | 'finance_purchase'
  | 'finance_closed'
  | 'my_requests'
  | 'my_jobs';

interface TabDef {
  key: RequestTabKey;
  label: string;
  roles?: UserRole[];
}

const ALL_TABS: TabDef[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'closed', label: 'Closed' },
  {
    key: 'hod_all',
    label: 'HoD: All',
    roles: [UserRole.HEAD_OF_DEPARTMENT, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
  {
    key: 'hod_purchase',
    label: 'HoD: Purchase',
    roles: [UserRole.HEAD_OF_DEPARTMENT, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
  {
    key: 'finance_all',
    label: 'Finance: All',
    roles: [UserRole.FINANCE, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
  {
    key: 'finance_purchase',
    label: 'Finance: Purchase',
    roles: [UserRole.FINANCE, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
  {
    key: 'finance_closed',
    label: 'Finance: Closed',
    roles: [UserRole.FINANCE, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
  { key: 'my_requests', label: 'My Requests' },
  {
    key: 'my_jobs',
    label: 'My Jobs',
    roles: [UserRole.TECHNICIAN, UserRole.WORKSHOP_MANAGER, UserRole.ADMIN],
  },
];

export const RequestsPage: React.FC = () => {
  const { db, loading, currentUser } = useApp();
  const navigate = useNavigate();

  const availableTabs = useMemo(() => {
    if (!currentUser) return [];
    return ALL_TABS.filter((t) => !t.roles || t.roles.includes(currentUser.role));
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<RequestTabKey>('all');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [catFilter, setCatFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Reset to a valid tab if role changed
  React.useEffect(() => {
    if (!availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab('all');
    }
  }, [availableTabs, activeTab]);

  const usersById = useMemo(() => new Map((db?.users || []).map((u) => [u.id, u])), [db?.users]);
  const deptsById = useMemo(() => new Map((db?.departments || []).map((d) => [d.id, d])), [db?.departments]);
  const catsById = useMemo(() => new Map((db?.categories || []).map((c) => [c.id, c])), [db?.categories]);

  const filteredRequests = useMemo(() => {
    if (!db || !currentUser) return [];

    const visible = db.requests.filter((r) => canUserViewRequest(r, currentUser));
    const q = search.trim().toLowerCase();

    return visible.filter((req) => {
      // Tab filtering
      switch (activeTab) {
        case 'open':
          if (
            [RequestStatus.CLOSED, RequestStatus.REJECTED, RequestStatus.COMPLETED].includes(
              req.status
            )
          ) {
            return false;
          }
          break;
        case 'unassigned':
          if (req.status !== RequestStatus.OPEN) return false;
          break;
        case 'closed':
          if (req.status !== RequestStatus.CLOSED) return false;
          break;
        case 'hod_all':
          if (
            currentUser.role === UserRole.HEAD_OF_DEPARTMENT &&
            req.departmentId !== currentUser.departmentId
          ) {
            return false;
          }
          if (
            req.status !== RequestStatus.AWAITING_HOD_APPROVAL &&
            currentUser.role !== UserRole.HEAD_OF_DEPARTMENT
          ) {
            return false;
          }
          break;
        case 'hod_purchase':
          if (!req.needsPurchase) return false;
          if (
            currentUser.role === UserRole.HEAD_OF_DEPARTMENT &&
            req.departmentId !== currentUser.departmentId
          ) {
            return false;
          }
          if (
            req.status !== RequestStatus.AWAITING_HOD_APPROVAL &&
            currentUser.role !== UserRole.HEAD_OF_DEPARTMENT
          ) {
            return false;
          }
          break;
        case 'finance_all':
          if (!req.needsPurchase && req.status !== RequestStatus.AWAITING_FINANCE_APPROVAL) return false;
          break;
        case 'finance_purchase':
          if (req.status !== RequestStatus.AWAITING_FINANCE_APPROVAL) return false;
          break;
        case 'finance_closed':
          if (!req.needsPurchase || req.status !== RequestStatus.CLOSED) return false;
          break;
        case 'my_requests':
          if (req.requesterId !== currentUser.id) return false;
          break;
        case 'my_jobs':
          if (req.assignedTechnicianId !== currentUser.id) return false;
          break;
        default:
          break;
      }

      if (deptFilter !== 'ALL' && req.departmentId !== deptFilter) return false;
      if (catFilter !== 'ALL' && req.categoryId !== catFilter) return false;
      if (priorityFilter !== 'ALL' && req.priority !== priorityFilter) return false;
      if (onlyOverdue && !isRequestOverdue(req)) return false;

      if (q) {
        const requesterName = usersById.get(req.requesterId)?.name.toLowerCase() ?? '';
        const techName = req.assignedTechnicianId
          ? usersById.get(req.assignedTechnicianId)?.name.toLowerCase() ?? ''
          : '';
        const matches =
          req.referenceNumber.toLowerCase().includes(q) ||
          req.title.toLowerCase().includes(q) ||
          req.location.toLowerCase().includes(q) ||
          requesterName.includes(q) ||
          techName.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    db,
    currentUser,
    activeTab,
    deptFilter,
    catFilter,
    priorityFilter,
    onlyOverdue,
    search,
    usersById,
  ]);

  const financeTotals = useMemo(() => {
    const est = filteredRequests.reduce((sum, r) => sum + r.estimatedCost, 0);
    const approved = filteredRequests.reduce((sum, r) => sum + (r.approvedCost ?? 0), 0);
    return { est, approved };
  }, [filteredRequests]);

  const columns: DataTableColumn<WorkshopRequest>[] = [
    {
      key: 'ref',
      header: 'Reference',
      sortable: true,
      sortValue: (r) => r.referenceNumber,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-[#10B981] whitespace-nowrap">
          {r.referenceNumber}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Request',
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="max-w-xs sm:max-w-sm">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {catsById.get(r.categoryId)?.name} · {r.location}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Dept',
      sortable: true,
      sortValue: (r) => deptsById.get(r.departmentId)?.name ?? '',
      render: (r) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {deptsById.get(r.departmentId)?.code ?? '—'}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortValue: (r) => {
        const order = { [Priority.URGENT]: 4, [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
        return order[r.priority];
      },
      render: (r) => <PriorityBadge priority={r.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} compact />,
    },
    {
      key: 'technician',
      header: 'Technician',
      sortable: true,
      sortValue: (r) => (r.assignedTechnicianId ? usersById.get(r.assignedTechnicianId)?.name ?? '' : ''),
      render: (r) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {r.assignedTechnicianId ? usersById.get(r.assignedTechnicianId)?.name : 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortable: true,
      sortValue: (r) => getTotalReportedCost(r),
      render: (r) => (
        <span className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
          {formatCurrency(getTotalReportedCost(r))}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Due Date',
      align: 'right',
      sortable: true,
      sortValue: (r) => new Date(r.dueDate).getTime(),
      render: (r) => {
        const overdue = isRequestOverdue(r);
        return (
          <span
            className={cn(
              'font-mono text-xs tabular-nums whitespace-nowrap',
              overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-600 dark:text-slate-400'
            )}
          >
            {formatDate(r.dueDate)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Workshop Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Track worksheets, dispatch technicians, and process department &amp; purchase approvals.
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Request</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0',
              activeTab === tab.key
                ? 'border-[#10B981] text-[#10B981] bg-emerald-500/5'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ref, title, location, requester, technician..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#071121] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#10B981]/50"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          aria-label="Filter by department"
          className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Departments</option>
          {(db?.departments || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Categories</option>
          {(db?.categories || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#071121] px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Priorities</option>
          {Object.values(Priority).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none px-1">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]"
          />
          <span>Overdue only</span>
        </label>
      </div>

      {/* Finance Cost Totals Strip when viewing Finance tabs */}
      {activeTab.startsWith('finance_') && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Finance Ledger Summary ({filteredRequests.length} worksheets)
          </span>
          <div className="flex items-center gap-6 font-mono tabular-nums">
            <span>
              Estimated Total:{' '}
              <strong className="text-slate-900 dark:text-white">
                {formatCurrency(financeTotals.est)}
              </strong>
            </span>
            <span>
              Approved Total:{' '}
              <strong className="text-[#10B981]">
                {formatCurrency(financeTotals.approved)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable
        data={filteredRequests}
        columns={columns}
        keyExtractor={(r) => r.id}
        loading={loading}
        pageSize={12}
        onRowClick={(r) => navigate(`/requests/${r.id}`)}
        emptyTitle="No requests in this view"
        emptyDescription="Adjust your search or filter criteria, or submit a new workshop request."
        emptyActionLabel="New Request"
        onEmptyAction={() => navigate('/requests/new')}
      />
    </div>
  );
};
