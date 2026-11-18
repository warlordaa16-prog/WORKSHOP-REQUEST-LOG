import React, { useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { Category, Department, Reason, User, UserRole } from '../types';
import { ROLE_LABELS } from '../services/workflowEngine';
import { formatDateTime } from '../utils/formatters';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { FormField, inputBaseClass } from '../components/FormField';
import { cn } from '../utils/cn';

type AdminTab = 'users' | 'departments' | 'categories' | 'reasons' | 'audit';

export const AdminPage: React.FC = () => {
  const {
    db,
    currentUser,
    saveUser,
    deleteUser,
    saveDepartment,
    deleteDepartment,
    saveCategory,
    deleteCategory,
    saveReason,
    deleteReason,
  } = useApp();

  const [tab, setTab] = useState<AdminTab>('users');
  const [actionError, setActionError] = useState<string | null>(null);

  // User modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);

  // Department modal state
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);

  // Category modal state
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);

  // Reason modal state
  const [editingReason, setEditingReason] = useState<Reason | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);

  if (!db || !currentUser) return null;

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <EmptyState
        title="Administrator access required"
        description="Switch to the Administrator role via the top-right Role Switcher to manage users, departments, categories, reasons, and audit logs."
      />
    );
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshoplog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openNewUser = () => {
    setEditingUser({
      id: `usr-${Date.now()}`,
      name: '',
      email: '',
      phone: '+1-555-0199',
      role: UserRole.REQUESTER,
      departmentId: db.departments[0]?.id || '',
      title: '',
      active: true,
      createdAt: new Date().toISOString(),
    });
    setUserModalOpen(true);
  };

  const openNewDept = () => {
    setEditingDept({
      id: `dept-${Date.now()}`,
      name: '',
      code: '',
      costCenter: '',
      active: true,
    });
    setDeptModalOpen(true);
  };

  const openNewCat = () => {
    setEditingCat({
      id: `cat-${Date.now()}`,
      name: '',
      description: '',
      active: true,
    });
    setCatModalOpen(true);
  };

  const openNewReason = () => {
    setEditingReason({
      id: `rsn-${Date.now()}`,
      name: '',
      description: '',
      active: true,
    });
    setReasonModalOpen(true);
  };

  const runSafe = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Operation failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Administration
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Manage staff accounts, departments, request categories, reasons, and review audit logs.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1F3A] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Download className="w-4 h-4 text-[#10B981]" />
          <span>Export Full JSON</span>
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-xs text-rose-700 dark:text-rose-300">
          {actionError}
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {[
          { key: 'users' as const, label: `Users (${db.users.length})` },
          { key: 'departments' as const, label: `Departments (${db.departments.length})` },
          { key: 'categories' as const, label: `Categories (${db.categories.length})` },
          { key: 'reasons' as const, label: `Reasons (${db.reasons.length})` },
          { key: 'audit' as const, label: `Audit Log (${db.auditLogs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setActionError(null);
            }}
            className={cn(
              'px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
              tab === t.key
                ? 'border-[#10B981] text-[#10B981]'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Staff Directory</h2>
            <button
              type="button"
              onClick={openNewUser}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Email</th>
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">State</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {db.users.map((u) => (
                  <tr key={u.id} className="h-11">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {u.name}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">
                      {u.email}
                    </td>
                    <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                    <td className="px-4 py-2">
                      {db.departments.find((d) => d.id === u.departmentId)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={u.active ? 'text-[#10B981] font-medium' : 'text-slate-400'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setUserModalOpen(true);
                        }}
                        className="text-[#10B981] hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runSafe(() => deleteUser(u.id))}
                        aria-label={`Delete ${u.name}`}
                        className="text-rose-500 hover:text-rose-600 inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENTS TAB */}
      {tab === 'departments' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Departments</h2>
            <button
              type="button"
              onClick={openNewDept}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Code</th>
                  <th className="px-4 py-2.5 font-semibold">Cost Center</th>
                  <th className="px-4 py-2.5 font-semibold">State</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {db.departments.map((d) => (
                  <tr key={d.id} className="h-11">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{d.name}</td>
                    <td className="px-4 py-2 font-mono">{d.code}</td>
                    <td className="px-4 py-2 font-mono">{d.costCenter}</td>
                    <td className="px-4 py-2">
                      <span className={d.active ? 'text-[#10B981] font-medium' : 'text-slate-400'}>
                        {d.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDept(d);
                          setDeptModalOpen(true);
                        }}
                        className="text-[#10B981] hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runSafe(() => deleteDepartment(d.id))}
                        className="text-rose-500 hover:text-rose-600 inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Categories</h2>
            <button
              type="button"
              onClick={openNewCat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 font-semibold">State</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {db.categories.map((c) => (
                  <tr key={c.id} className="h-11">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{c.description}</td>
                    <td className="px-4 py-2">
                      <span className={c.active ? 'text-[#10B981] font-medium' : 'text-slate-400'}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(c);
                          setCatModalOpen(true);
                        }}
                        className="text-[#10B981] hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runSafe(() => deleteCategory(c.id))}
                        className="text-rose-500 hover:text-rose-600 inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REASONS TAB */}
      {tab === 'reasons' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Request Reasons</h2>
            <button
              type="button"
              onClick={openNewReason}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Reason</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 font-semibold">State</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {db.reasons.map((r) => (
                  <tr key={r.id} className="h-11">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{r.name}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{r.description}</td>
                    <td className="px-4 py-2">
                      <span className={r.active ? 'text-[#10B981] font-medium' : 'text-slate-400'}>
                        {r.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReason(r);
                          setReasonModalOpen(true);
                        }}
                        className="text-[#10B981] hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runSafe(() => deleteReason(r.id))}
                        className="text-rose-500 hover:text-rose-600 inline-flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOG TAB */}
      {tab === 'audit' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">System Audit Log</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#08172C] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                  <th className="px-4 py-2.5 font-semibold">Actor</th>
                  <th className="px-4 py-2.5 font-semibold">Entity</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {db.auditLogs.map((log) => (
                  <tr key={log.id} className="h-10">
                    <td className="px-4 py-2 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.actorName} ({ROLE_LABELS[log.actorRole]})
                    </td>
                    <td className="px-4 py-2 font-mono">{log.entityType}</td>
                    <td className="px-4 py-2 font-semibold text-[#10B981]">{log.action}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Modal */}
      <Modal
        open={userModalOpen && Boolean(editingUser)}
        onClose={() => setUserModalOpen(false)}
        title="Staff Member"
      >
        {editingUser && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await runSafe(async () => {
                await saveUser(editingUser);
                setUserModalOpen(false);
              });
            }}
            className="space-y-3.5"
          >
            <FormField label="Full Name" required>
              <input
                type="text"
                value={editingUser.name}
                onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                className={inputBaseClass}
                required
              />
            </FormField>
            <FormField label="Email" required>
              <input
                type="email"
                value={editingUser.email}
                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                className={inputBaseClass}
                required
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Role" required>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                  }
                  className={inputBaseClass}
                >
                  {Object.values(UserRole).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Department" required>
                <select
                  value={editingUser.departmentId}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, departmentId: e.target.value })
                  }
                  className={inputBaseClass}
                >
                  {db.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Job Title">
              <input
                type="text"
                value={editingUser.title}
                onChange={(e) => setEditingUser({ ...editingUser, title: e.target.value })}
                className={inputBaseClass}
              />
            </FormField>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editingUser.active}
                onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
              />
              <span>Active account</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-semibold"
              >
                Save User
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Department Modal */}
      <Modal
        open={deptModalOpen && Boolean(editingDept)}
        onClose={() => setDeptModalOpen(false)}
        title="Department"
      >
        {editingDept && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await runSafe(async () => {
                await saveDepartment(editingDept);
                setDeptModalOpen(false);
              });
            }}
            className="space-y-3.5"
          >
            <FormField label="Department Name" required>
              <input
                type="text"
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className={inputBaseClass}
                required
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Code" required>
                <input
                  type="text"
                  value={editingDept.code}
                  onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value.toUpperCase() })}
                  className={inputBaseClass}
                  required
                />
              </FormField>
              <FormField label="Cost Center" required>
                <input
                  type="text"
                  value={editingDept.costCenter}
                  onChange={(e) => setEditingDept({ ...editingDept, costCenter: e.target.value })}
                  className={inputBaseClass}
                  required
                />
              </FormField>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editingDept.active}
                onChange={(e) => setEditingDept({ ...editingDept, active: e.target.checked })}
              />
              <span>Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-semibold"
              >
                Save Department
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal
        open={catModalOpen && Boolean(editingCat)}
        onClose={() => setCatModalOpen(false)}
        title="Category"
      >
        {editingCat && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await runSafe(async () => {
                await saveCategory(editingCat);
                setCatModalOpen(false);
              });
            }}
            className="space-y-3.5"
          >
            <FormField label="Category Name" required>
              <input
                type="text"
                value={editingCat.name}
                onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                className={inputBaseClass}
                required
              />
            </FormField>
            <FormField label="Description">
              <input
                type="text"
                value={editingCat.description}
                onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
                className={inputBaseClass}
              />
            </FormField>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editingCat.active}
                onChange={(e) => setEditingCat({ ...editingCat, active: e.target.checked })}
              />
              <span>Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-semibold"
              >
                Save Category
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reason Modal */}
      <Modal
        open={reasonModalOpen && Boolean(editingReason)}
        onClose={() => setReasonModalOpen(false)}
        title="Request Reason"
      >
        {editingReason && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await runSafe(async () => {
                await saveReason(editingReason);
                setReasonModalOpen(false);
              });
            }}
            className="space-y-3.5"
          >
            <FormField label="Reason Name" required>
              <input
                type="text"
                value={editingReason.name}
                onChange={(e) => setEditingReason({ ...editingReason, name: e.target.value })}
                className={inputBaseClass}
                required
              />
            </FormField>
            <FormField label="Description">
              <input
                type="text"
                value={editingReason.description}
                onChange={(e) => setEditingReason({ ...editingReason, description: e.target.value })}
                className={inputBaseClass}
              />
            </FormField>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editingReason.active}
                onChange={(e) => setEditingReason({ ...editingReason, active: e.target.checked })}
              />
              <span>Active</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReasonModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-semibold"
              >
                Save Reason
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
