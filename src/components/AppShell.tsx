import React, { useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { UserRole } from '../types';
import { canUserViewRequest, ROLE_LABELS } from '../services/workflowEngine';
import { StatusBadge } from './StatusBadge';
import { Modal } from './Modal';
import { cn } from '../utils/cn';

const ROLE_ORDER: UserRole[] = [
  UserRole.WORKSHOP_MANAGER,
  UserRole.REQUESTER,
  UserRole.TECHNICIAN,
  UserRole.HEAD_OF_DEPARTMENT,
  UserRole.FINANCE,
  UserRole.ADMIN,
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    db,
    currentUser,
    unreadNotificationsCount,
    switchRole,
    logout,
    resetDemoData,
  } = useApp();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/requests', label: 'Requests', icon: ClipboardList, end: false },
      { to: '/reports', label: 'Reports', icon: BarChart3, end: false },
      {
        to: '/notifications',
        label: 'Notifications',
        icon: Bell,
        end: false,
        badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      },
    ];
    if (currentUser?.role === UserRole.ADMIN) {
      items.push({ to: '/admin', label: 'Admin', icon: Settings, end: false });
    }
    return items;
  }, [currentUser?.role, unreadNotificationsCount]);

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return ['Workspace', 'Dashboard'];
    if (parts[0] === 'requests' && parts[1] === 'new') return ['Workspace', 'Requests', 'New Worksheet'];
    if (parts[0] === 'requests' && parts[2] === 'edit') return ['Workspace', 'Requests', 'Edit Worksheet'];
    if (parts[0] === 'requests' && parts[1]) {
      const req = db?.requests.find((r) => r.id === parts[1]);
      return ['Workspace', 'Requests', req ? req.referenceNumber : 'Detail'];
    }
    const labelMap: Record<string, string> = {
      requests: 'Requests',
      reports: 'Reports',
      notifications: 'Notifications',
      admin: 'Administration',
    };
    return ['Workspace', labelMap[parts[0]] || parts[0]];
  }, [location.pathname, db?.requests]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !db || !currentUser) return [];
    const usersById = new Map(db.users.map((u) => [u.id, u]));
    return db.requests
      .filter((req) => canUserViewRequest(req, currentUser))
      .filter((req) => {
        const requesterName = usersById.get(req.requesterId)?.name.toLowerCase() ?? '';
        const techName = req.assignedTechnicianId
          ? usersById.get(req.assignedTechnicianId)?.name.toLowerCase() ?? ''
          : '';
        return (
          req.referenceNumber.toLowerCase().includes(q) ||
          req.title.toLowerCase().includes(q) ||
          requesterName.includes(q) ||
          techName.includes(q) ||
          req.location.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [searchQuery, db, currentUser]);

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await resetDemoData();
      setResetModalOpen(false);
    } finally {
      setResetting(false);
    }
  };

  if (!currentUser) return <>{children}</>;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B1F3A] text-slate-100 border-r border-slate-800/90">
      {/* Brand */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <span className="w-8 h-8 rounded-lg bg-[#10B981] text-[#071121] flex items-center justify-center shadow-xs">
            <Wrench className="w-4 h-4 stroke-[2.25]" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            WorkshopLog
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                )
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span className="font-mono tabular-nums text-xs px-1.5 py-0.5 rounded bg-[#10B981] text-[#071121] font-semibold">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Controls & Account */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5">
        <div className="px-3 py-2.5 rounded-lg bg-[#071121]/60 border border-slate-800">
          <div className="text-sm font-medium text-white truncate">{currentUser.name}</div>
          <div className="text-xs text-slate-400 truncate mt-0.5">{ROLE_LABELS[currentUser.role]}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 transition-colors whitespace-nowrap"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-slate-800 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex relative">
      {/* Cohesive PNG atmospheric background fill with measured scrim */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/assets/aistudio/image_6912c20d.png')" }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[#F4F7FB]/90 dark:bg-[#071121]/92 backdrop-blur-2xl pointer-events-none"
      />

      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B1F3A]/80 backdrop-blur-md flex items-center justify-between gap-4">
          {/* Zone 1: Menu trigger & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb}-${idx}`}>
                  {idx > 0 && <span aria-hidden="true">/</span>}
                  <span
                    className={cn(
                      'truncate',
                      idx === breadcrumbs.length - 1
                        ? 'font-semibold text-slate-900 dark:text-slate-100'
                        : ''
                    )}
                  >
                    {crumb}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Zone 2: Global Search */}
          <div className="relative flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                placeholder="Search WR-2026 ref, title, requester, technician..."
                aria-label="Global request search"
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#071121] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#10B981]/50 focus:border-[#10B981]"
              />
            </div>

            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] shadow-xl overflow-hidden z-50">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    No visible requests match "{searchQuery}".
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                    {searchResults.map((req) => (
                      <li key={req.id}>
                        <button
                          type="button"
                          onMouseDown={() => {
                            setSearchQuery('');
                            navigate(`/requests/${req.id}`);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-[#10B981]">
                                {req.referenceNumber}
                              </span>
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {req.title}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {req.location}
                            </div>
                          </div>
                          <StatusBadge status={req.status} compact />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Zone 3: Persistent Role Switcher + Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <label htmlFor="role-switcher" className="sr-only">
              Switch active role
            </label>
            <select
              id="role-switcher"
              value={currentUser.role}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              title="Persistent Role Switcher"
              className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#071121] px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#10B981]/50 cursor-pointer"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  Role: {ROLE_LABELS[r]}
                </option>
              ))}
            </select>

            <Link
              to="/requests/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Request</span>
            </Link>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Reset Demo Data Modal */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Demo Data"
        subtitle="Restore all 60 requests, 5 departments, 8 categories, 6 reasons, and 10 users."
        size="sm"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This will replace your current local IndexedDB changes with the fresh seeded WorkshopLog dataset.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setResetModalOpen(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={resetting}
            onClick={handleConfirmReset}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset Demo Data'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
