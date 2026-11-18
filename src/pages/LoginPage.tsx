import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Moon, Sun, Wrench } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { useTheme } from '../hooks/useTheme';
import { ROLE_LABELS } from '../services/workflowEngine';
import { UserRole } from '../types';
import { FormField, inputBaseClass } from '../components/FormField';

export const LoginPage: React.FC = () => {
  const { db, loading, loginAsUser } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState('manager@workshoplog.io');
  const [password, setPassword] = useState('demo-password');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    const match = db.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.active
    );
    if (!match) {
      setFormError('No active demo account found for that email. Select a demo profile below.');
      return;
    }
    loginAsUser(match.id);
    navigate('/');
  };

  const handleQuickLogin = (userId: string) => {
    loginAsUser(userId);
    navigate('/');
  };

  const demoAccountsByRole = React.useMemo(() => {
    if (!db) return [];
    const order = [
      UserRole.WORKSHOP_MANAGER,
      UserRole.REQUESTER,
      UserRole.TECHNICIAN,
      UserRole.HEAD_OF_DEPARTMENT,
      UserRole.FINANCE,
      UserRole.ADMIN,
    ];
    return order
      .map((role) => db.users.find((u) => u.role === role && u.active))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
  }, [db]);

  return (
    <div className="min-h-screen relative flex flex-col justify-center px-4 py-10 sm:px-8">
      {/* Cohesive PNG atmospheric background fill */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/assets/aistudio/image_6912c20d.png')" }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-[#F4F7FB]/88 dark:bg-[#071121]/90 backdrop-blur-2xl pointer-events-none"
      />

      <div className="max-w-5xl w-full mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#10B981] text-[#071121] flex items-center justify-center">
              <Wrench className="w-5 h-5 stroke-[2.25]" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              WorkshopLog
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0B1F3A]/80 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#0B1F3A] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Sign-in form */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white text-balance">
                Workshop Request &amp; Job Management
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Sign in with any demo account email or pick a role profile on the right to enter the workspace immediately.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <FormField label="Work Email" htmlFor="login-email" required>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFormError(null);
                    }}
                    className={inputBaseClass}
                    placeholder="manager@workshoplog.io"
                    required
                  />
                </FormField>

                <FormField
                  label="Password"
                  htmlFor="login-password"
                  hint="Simulated authentication — any password works for demo accounts."
                >
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputBaseClass}
                  />
                </FormField>

                {formError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign In to Workspace</span>
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              All worksheets, approvals, reports, and audit logs persist locally in your browser via IndexedDB.
            </div>
          </div>

          {/* Right: 1-Click Role Demo Accounts */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Instant Demo Accounts
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  One-click sign-in across every operational role.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                6 roles ready
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {demoAccountsByRole.map((user) => {
                const dept = db?.departments.find((d) => d.id === user.departmentId);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleQuickLogin(user.id)}
                    className="group text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#071121]/70 hover:border-[#10B981] dark:hover:border-[#10B981] transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#10B981]">
                          {ROLE_LABELS[user.role]}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#10B981] transition-colors" />
                      </div>
                      <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {user.name}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                        {user.title}
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span className="truncate">{user.email}</span>
                      {dept && <span className="shrink-0 ml-2">{dept.code}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
