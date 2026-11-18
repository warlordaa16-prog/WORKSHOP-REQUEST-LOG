import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppDatabase,
  Category,
  CommentKind,
  Department,
  Reason,
  RequestStatus,
  User,
  UserRole,
  WorkshopRequest,
} from '../types';
import { repository } from '../services/repository';

const AUTH_USER_KEY = 'workshoplog_active_user_id_v1';

interface AppContextValue {
  db: AppDatabase | null;
  loading: boolean;
  error: string | null;
  currentUser: User | null;
  unreadNotificationsCount: number;
  loginAsUser: (userId: string) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;
  refreshDb: () => Promise<void>;
  resetDemoData: () => Promise<void>;
  createRequest: (
    input: Omit<
      WorkshopRequest,
      | 'id'
      | 'referenceNumber'
      | 'status'
      | 'assignedTechnicianId'
      | 'approvedCost'
      | 'createdAt'
      | 'updatedAt'
      | 'closedAt'
      | 'technicianReports'
      | 'comments'
      | 'approvals'
      | 'timeline'
    >
  ) => Promise<WorkshopRequest>;
  updateRequest: (
    requestId: string,
    patch: Parameters<typeof repository.updateRequest>[1]
  ) => Promise<void>;
  transitionRequest: (
    requestId: string,
    targetStatus: RequestStatus,
    params: Parameters<typeof repository.transitionRequest>[3]
  ) => Promise<void>;
  addTechnicianReport: (
    requestId: string,
    input: Parameters<typeof repository.addTechnicianReport>[2]
  ) => Promise<void>;
  addComment: (requestId: string, kind: CommentKind, body: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  saveDepartment: (dept: Department) => Promise<void>;
  deleteDepartment: (deptId: string) => Promise<void>;
  saveCategory: (cat: Category) => Promise<void>;
  deleteCategory: (catId: string) => Promise<void>;
  saveReason: (reason: Reason) => Promise<void>;
  deleteReason: (reasonId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_USER_KEY);
    } catch {
      return null;
    }
  });

  const refreshDb = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await repository.loadDatabase();
      setDb(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDb();
  }, [refreshDb]);

  const currentUser = useMemo(() => {
    if (!db || !activeUserId) return null;
    return db.users.find((u) => u.id === activeUserId && u.active) ?? null;
  }, [db, activeUserId]);

  const loginAsUser = useCallback((userId: string) => {
    setActiveUserId(userId);
    try {
      localStorage.setItem(AUTH_USER_KEY, userId);
    } catch {
      // ignore
    }
  }, []);

  const switchRole = useCallback(
    (role: UserRole) => {
      if (!db) return;
      const match = db.users.find((u) => u.role === role && u.active);
      if (match) {
        loginAsUser(match.id);
      }
    },
    [db, loginAsUser]
  );

  const logout = useCallback(() => {
    setActiveUserId(null);
    try {
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // ignore
    }
  }, []);

  const requireUser = (): User => {
    if (!currentUser) throw new Error('You must be signed in to perform this action.');
    return currentUser;
  };

  const resetDemoData = useCallback(async () => {
    const nextDb = await repository.resetDemoData(currentUser ?? undefined);
    setDb(nextDb);
    if (currentUser && !nextDb.users.some((u) => u.id === currentUser.id)) {
      const mgr = nextDb.users.find((u) => u.role === UserRole.WORKSHOP_MANAGER);
      if (mgr) loginAsUser(mgr.id);
    }
  }, [currentUser, loginAsUser]);

  const createRequest = useCallback(
    async (
      input: Omit<
        WorkshopRequest,
        | 'id'
        | 'referenceNumber'
        | 'status'
        | 'assignedTechnicianId'
        | 'approvedCost'
        | 'createdAt'
        | 'updatedAt'
        | 'closedAt'
        | 'technicianReports'
        | 'comments'
        | 'approvals'
        | 'timeline'
      >
    ) => {
      const actor = requireUser();
      const { db: nextDb, created } = await repository.createRequest(input, actor);
      setDb(nextDb);
      return created;
    },
    [currentUser]
  );

  const updateRequest = useCallback(
    async (requestId: string, patch: Parameters<typeof repository.updateRequest>[1]) => {
      const actor = requireUser();
      const nextDb = await repository.updateRequest(requestId, patch, actor);
      setDb(nextDb);
    },
    [currentUser]
  );

  const transitionRequest = useCallback(
    async (
      requestId: string,
      targetStatus: RequestStatus,
      params: Parameters<typeof repository.transitionRequest>[3]
    ) => {
      const actor = requireUser();
      const nextDb = await repository.transitionRequest(requestId, targetStatus, actor, params);
      setDb(nextDb);
    },
    [currentUser]
  );

  const addTechnicianReport = useCallback(
    async (requestId: string, input: Parameters<typeof repository.addTechnicianReport>[2]) => {
      const actor = requireUser();
      const nextDb = await repository.addTechnicianReport(requestId, actor, input);
      setDb(nextDb);
    },
    [currentUser]
  );

  const addComment = useCallback(
    async (requestId: string, kind: CommentKind, body: string) => {
      const actor = requireUser();
      const nextDb = await repository.addComment(requestId, actor, kind, body);
      setDb(nextDb);
    },
    [currentUser]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    const nextDb = await repository.markNotificationRead(id);
    setDb(nextDb);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser) return;
    const nextDb = await repository.markAllNotificationsRead(currentUser.id);
    setDb(nextDb);
  }, [currentUser]);

  const saveUser = useCallback(
    async (user: User) => {
      const nextDb = await repository.saveUser(user, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      const nextDb = await repository.deleteUser(userId, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const saveDepartment = useCallback(
    async (dept: Department) => {
      const nextDb = await repository.saveDepartment(dept, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const deleteDepartment = useCallback(
    async (deptId: string) => {
      const nextDb = await repository.deleteDepartment(deptId, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const saveCategory = useCallback(
    async (cat: Category) => {
      const nextDb = await repository.saveCategory(cat, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const deleteCategory = useCallback(
    async (catId: string) => {
      const nextDb = await repository.deleteCategory(catId, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const saveReason = useCallback(
    async (reason: Reason) => {
      const nextDb = await repository.saveReason(reason, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const deleteReason = useCallback(
    async (reasonId: string) => {
      const nextDb = await repository.deleteReason(reasonId, requireUser());
      setDb(nextDb);
    },
    [currentUser]
  );

  const unreadNotificationsCount = useMemo(() => {
    if (!db || !currentUser) return 0;
    return db.notifications.filter((n) => n.recipientUserId === currentUser.id && !n.read).length;
  }, [db, currentUser]);

  return (
    <AppContext.Provider
      value={{
        db,
        loading,
        error,
        currentUser,
        unreadNotificationsCount,
        loginAsUser,
        switchRole,
        logout,
        refreshDb,
        resetDemoData,
        createRequest,
        updateRequest,
        transitionRequest,
        addTechnicianReport,
        addComment,
        markNotificationRead,
        markAllNotificationsRead,
        saveUser,
        deleteUser,
        saveDepartment,
        deleteDepartment,
        saveCategory,
        deleteCategory,
        saveReason,
        deleteReason,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
