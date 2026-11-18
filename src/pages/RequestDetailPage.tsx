import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import {
  ApprovalDecision,
  Attachment,
  CommentKind,
  RequestStatus,
  UserRole,
  WorkflowActionOption,
} from '../types';
import {
  canUserAddComment,
  canUserSubmitTechReport,
  canUserViewRequest,
  getAvailableActions,
  ROLE_LABELS,
  STATUS_META,
} from '../services/workflowEngine';
import { aiService, RequestSummaryResult } from '../services/aiService';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getTotalReportedCost,
  isRequestOverdue,
} from '../utils/formatters';
import { PriorityBadge, StatusBadge } from '../components/StatusBadge';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { Timeline } from '../components/Timeline';
import { Modal } from '../components/Modal';
import { FormField, inputBaseClass } from '../components/FormField';
import { ImageLightbox } from '../components/ImageLightbox';
import { EmptyState } from '../components/EmptyState';
import { cn } from '../utils/cn';

type DetailTab = 'reports' | 'manager_comments' | 'user_comments' | 'approvals' | 'attachments';

export const RequestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    db,
    currentUser,
    transitionRequest,
    addTechnicianReport,
    addComment,
  } = useApp();

  const [activeTab, setActiveTab] = useState<DetailTab>('reports');
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Transition modal state
  const [pendingAction, setPendingAction] = useState<WorkflowActionOption | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [draftEmailSubject, setDraftEmailSubject] = useState('');
  const [draftEmailBody, setDraftEmailBody] = useState('');
  const [draftSmsText, setDraftSmsText] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // AI Summary state
  const [summary, setSummary] = useState<RequestSummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Technician report form state
  const [roughNotes, setRoughNotes] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [labourHours, setLabourHours] = useState('2');
  const [partsCost, setPartsCost] = useState('0');
  const [labourCost, setLabourCost] = useState('130');
  const [recommendations, setRecommendations] = useState('');
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Comment form state
  const [managerCommentText, setManagerCommentText] = useState('');
  const [userCommentText, setUserCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const request = useMemo(() => {
    if (!db || !id) return null;
    return db.requests.find((r) => r.id === id) ?? null;
  }, [db, id]);

  if (!db || !currentUser) return null;

  if (!request) {
    return (
      <EmptyState
        title="Request not found"
        description="This worksheet may have been removed or reset."
        actionLabel="Back to Requests"
        onAction={() => navigate('/requests')}
      />
    );
  }

  if (!canUserViewRequest(request, currentUser)) {
    return (
      <EmptyState
        title="Access restricted"
        description={`Your current role (${ROLE_LABELS[currentUser.role]}) does not have permission to view ${request.referenceNumber}.`}
        actionLabel="Return to Requests"
        onAction={() => navigate('/requests')}
      />
    );
  }

  const department = db.departments.find((d) => d.id === request.departmentId);
  const category = db.categories.find((c) => c.id === request.categoryId);
  const reason = db.reasons.find((r) => r.id === request.reasonId);
  const requester = db.users.find((u) => u.id === request.requesterId);
  const assignedTech = request.assignedTechnicianId
    ? db.users.find((u) => u.id === request.assignedTechnicianId)
    : null;
  const technicians = db.users.filter((u) => u.role === UserRole.TECHNICIAN && u.active);

  const actions = getAvailableActions(request, currentUser);
  const canEdit =
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.WORKSHOP_MANAGER ||
    (currentUser.role === UserRole.REQUESTER &&
      request.requesterId === currentUser.id &&
      [RequestStatus.OPEN, RequestStatus.REOPENED].includes(request.status));

  const canSubmitReport = canUserSubmitTechReport(request, currentUser);
  const canAddManagerComment = canUserAddComment(request, currentUser, 'MANAGER');
  const canAddUserComment = canUserAddComment(request, currentUser, 'USER');

  const managerComments = request.comments.filter((c) => c.kind === CommentKind.MANAGER);
  const userComments = request.comments.filter((c) => c.kind === CommentKind.USER);

  const openTransitionModal = (action: WorkflowActionOption) => {
    setPendingAction(action);
    setSelectedTechId(request.assignedTechnicianId || technicians[0]?.id || '');
    setTransitionNote('');
    setApprovedAmount(String(getTotalReportedCost(request)));
    setDraftEmailSubject('');
    setDraftEmailBody('');
    setDraftSmsText('');
    setDraftError(null);
    setTransitionError(null);
  };

  const handleDraftNotification = async () => {
    if (!pendingAction) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const draft = await aiService.draftNotification({
        referenceNumber: request.referenceNumber,
        title: request.title,
        fromStatus: STATUS_META[request.status].label,
        toStatus: STATUS_META[pendingAction.targetStatus].label,
        actorName: currentUser.name,
        note: transitionNote,
      });
      setDraftEmailSubject(draft.emailSubject);
      setDraftEmailBody(draft.emailBody);
      setDraftSmsText(draft.smsText);
    } catch (err) {
      setDraftError(
        err instanceof Error
          ? `${err.message} Standard notification template will be logged instead.`
          : 'AI drafting unavailable.'
      );
    } finally {
      setDraftLoading(false);
    }
  };

  const handleConfirmTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    if (pendingAction.requiresNote && !transitionNote.trim()) {
      setTransitionError('Please enter a brief note explaining this action.');
      return;
    }
    setTransitionSubmitting(true);
    setTransitionError(null);
    try {
      await transitionRequest(request.id, pendingAction.targetStatus, {
        note: transitionNote.trim() || `${pendingAction.label}`,
        technicianId: pendingAction.requiresTechnician ? selectedTechId : undefined,
        approvedAmount:
          request.status === RequestStatus.AWAITING_FINANCE_APPROVAL &&
          pendingAction.targetStatus === RequestStatus.COMPLETED
            ? Number(approvedAmount) || request.estimatedCost
            : undefined,
        customEmailSubject: draftEmailSubject || undefined,
        customEmailBody: draftEmailBody || undefined,
        customSmsText: draftSmsText || undefined,
      });
      setPendingAction(null);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Transition failed.');
    } finally {
      setTransitionSubmitting(false);
    }
  };

  const handleSummarizeRequest = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await aiService.summarizeRequest({
        referenceNumber: request.referenceNumber,
        title: request.title,
        description: request.description,
        status: STATUS_META[request.status].label,
        priority: request.priority,
        needsPurchase: request.needsPurchase,
        estimatedCost: request.estimatedCost,
        technicianReports: request.technicianReports.map((r) => ({
          by: r.technicianName,
          workDone: r.workDone,
          totalCost: r.totalCost,
        })),
        comments: request.comments.map((c) => ({
          kind: c.kind,
          by: c.authorName,
          body: c.body,
        })),
        timeline: request.timeline.slice(0, 8).map((t) => ({
          action: t.action,
          by: t.actorName,
          note: t.note,
        })),
      });
      setSummary(res);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Unable to generate AI summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handlePolishNotes = async () => {
    setPolishError(null);
    const source = roughNotes.trim() || workDone.trim();
    if (source.length < 5) {
      setPolishError('Enter rough field notes first.');
      return;
    }
    setPolishLoading(true);
    try {
      const res = await aiService.polishReport({
        roughNotes: source,
        requestTitle: request.title,
        categoryName: category?.name || 'Workshop Maintenance',
        partsUsed,
      });
      if (res.workDone) setWorkDone(res.workDone);
      if (res.partsSummary && !partsUsed.trim()) setPartsUsed(res.partsSummary);
      if (res.recommendations) setRecommendations(res.recommendations);
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : 'AI assistant unavailable. Write report manually.');
    } finally {
      setPolishLoading(false);
    }
  };

  const handleSubmitTechReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError(null);
    if (!workDone.trim()) {
      setReportError('Please enter work performed.');
      return;
    }
    setReportSubmitting(true);
    try {
      await addTechnicianReport(request.id, {
        workDone,
        partsUsed: partsUsed || 'Standard consumables',
        labourHours: Number(labourHours) || 0,
        partsCost: Number(partsCost) || 0,
        labourCost: Number(labourCost) || 0,
        recommendations,
      });
      setRoughNotes('');
      setWorkDone('');
      setPartsUsed('');
      setRecommendations('');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not save report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleAddComment = async (kind: CommentKind) => {
    setCommentError(null);
    const text = kind === CommentKind.MANAGER ? managerCommentText : userCommentText;
    if (!text.trim()) return;
    setCommentSubmitting(true);
    try {
      await addComment(request.id, kind, text);
      if (kind === CommentKind.MANAGER) setManagerCommentText('');
      else setUserCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Could not add comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const overdue = isRequestOverdue(request);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Link
            to="/requests"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#10B981]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Requests</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSummarizeRequest}
              disabled={summaryLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] hover:border-[#10B981] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{summaryLoading ? 'Summarizing...' : 'AI TL;DR Summary'}</span>
            </button>

            {canEdit && (
              <Link
                to={`/requests/${request.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071121] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-[#10B981]">
                {request.referenceNumber}
              </span>
              <StatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
              {overdue && (
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Overdue
                </span>
              )}
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-balance">
              {request.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {request.description}
            </p>
          </div>

          {/* Context-sensitive Action Buttons */}
          {actions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => openTransitionModal(action)}
                  className={cn(
                    'px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0',
                    action.variant === 'primary'
                      ? 'bg-[#10B981] hover:bg-emerald-600 text-white'
                      : action.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : action.variant === 'warning'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071121] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary Output */}
        {(summary || summaryError) && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
            {summaryError ? (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3.5 py-2.5">
                {summaryError}
              </div>
            ) : (
              summary && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10B981]">
                      <Sparkles className="w-3.5 h-3.5" />
                      Gemini Executive Summary
                    </span>
                    <button
                      type="button"
                      onClick={() => setSummary(null)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{summary.tldr}</p>
                  <div className="grid sm:grid-cols-2 gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <strong className="text-slate-900 dark:text-white">Status Note:</strong>{' '}
                      {summary.currentStatusNote}
                    </div>
                    <div>
                      <strong className="text-slate-900 dark:text-white">Next Step:</strong>{' '}
                      {summary.nextAction}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Visual Workflow Progress Bar */}
      <WorkflowProgress status={request.status} needsPurchase={request.needsPurchase} />

      {/* Main 2-column detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Tabbed Workspace */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto px-4 pt-3 border-b border-slate-200 dark:border-slate-800">
            {[
              {
                key: 'reports' as const,
                label: `Technician Reports (${request.technicianReports.length})`,
                icon: Wrench,
              },
              {
                key: 'manager_comments' as const,
                label: `Manager Comments (${managerComments.length})`,
                icon: MessageSquare,
              },
              {
                key: 'user_comments' as const,
                label: `User Comments (${userComments.length})`,
                icon: MessageSquare,
              },
              {
                key: 'approvals' as const,
                label: `Approvals (${request.approvals.length})`,
                icon: ShieldCheck,
              },
              {
                key: 'attachments' as const,
                label: `Attachments (${request.attachments.length})`,
                icon: ImageIcon,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                    activeTab === tab.key
                      ? 'border-[#10B981] text-[#10B981]'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {/* TAB 1: Technician Reports */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                {canSubmitReport && (
                  <form
                    onSubmit={handleSubmitTechReport}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#071121]/70 p-4 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                        File Technician Work Report
                      </h3>
                      <button
                        type="button"
                        onClick={handlePolishNotes}
                        disabled={polishLoading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] text-xs font-semibold disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{polishLoading ? 'Polishing...' : 'Polish Notes with Gemini'}</span>
                      </button>
                    </div>

                    <FormField
                      label="Rough Field Notes (Optional)"
                      htmlFor="rough-notes"
                      hint="Jot quick bullet points, then click Polish Notes with Gemini to structure the formal report."
                    >
                      <input
                        id="rough-notes"
                        type="text"
                        value={roughNotes}
                        onChange={(e) => setRoughNotes(e.target.value)}
                        className={inputBaseClass}
                        placeholder="e.g., pulled mast cylinder, swapped worn wiper seal, bled hydraulic line, tested 1800kg ok"
                      />
                    </FormField>

                    {polishError && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">{polishError}</p>
                    )}

                    <FormField label="Work Performed" htmlFor="rep-work" required>
                      <textarea
                        id="rep-work"
                        rows={3}
                        value={workDone}
                        onChange={(e) => setWorkDone(e.target.value)}
                        className={inputBaseClass}
                        placeholder="Detailed summary of diagnostics, repair, and functional testing..."
                        required
                      />
                    </FormField>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField label="Parts & Materials Used" htmlFor="rep-parts">
                        <input
                          id="rep-parts"
                          type="text"
                          value={partsUsed}
                          onChange={(e) => setPartsUsed(e.target.value)}
                          className={inputBaseClass}
                          placeholder="e.g., OEM Seal Kit #SK-402"
                        />
                      </FormField>
                      <FormField label="Recommendations" htmlFor="rep-rec">
                        <input
                          id="rep-rec"
                          type="text"
                          value={recommendations}
                          onChange={(e) => setRecommendations(e.target.value)}
                          className={inputBaseClass}
                          placeholder="Follow-up service interval"
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <FormField label="Labour Hours" htmlFor="rep-hrs">
                        <input
                          id="rep-hrs"
                          type="number"
                          min="0"
                          step="0.5"
                          value={labourHours}
                          onChange={(e) => {
                            setLabourHours(e.target.value);
                            const hrs = Number(e.target.value) || 0;
                            setLabourCost(String(hrs * 65));
                          }}
                          className={`${inputBaseClass} font-mono tabular-nums`}
                        />
                      </FormField>
                      <FormField label="Parts Cost ($)" htmlFor="rep-pcost">
                        <input
                          id="rep-pcost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={partsCost}
                          onChange={(e) => setPartsCost(e.target.value)}
                          className={`${inputBaseClass} font-mono tabular-nums`}
                        />
                      </FormField>
                      <FormField label="Labour Cost ($)" htmlFor="rep-lcost">
                        <input
                          id="rep-lcost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={labourCost}
                          onChange={(e) => setLabourCost(e.target.value)}
                          className={`${inputBaseClass} font-mono tabular-nums`}
                        />
                      </FormField>
                    </div>

                    {reportError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">{reportError}</p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={reportSubmitting}
                        className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {reportSubmitting ? 'Submitting...' : 'Submit Tech Report'}
                      </button>
                    </div>
                  </form>
                )}

                {request.technicianReports.length === 0 ? (
                  <EmptyState
                    title="No technician reports filed"
                    description="Assigned technicians can log work performed, parts used, labour hours, and costs here."
                    icon={<FileText className="w-5 h-5" />}
                  />
                ) : (
                  <div className="space-y-4">
                    {request.technicianReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {rep.technicianName}
                          </div>
                          <time className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {formatDateTime(rep.createdAt)}
                          </time>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          {rep.workDone}
                        </p>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-200">Parts Used:</strong>{' '}
                          {rep.partsUsed}
                        </div>
                        {rep.recommendations && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <strong className="text-slate-800 dark:text-slate-200">
                              Recommendations:
                            </strong>{' '}
                            {rep.recommendations}
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          <span>Labour: {rep.labourHours}h ({formatCurrency(rep.labourCost)})</span>
                          <span>Parts: {formatCurrency(rep.partsCost)}</span>
                          <span className="font-semibold text-[#10B981]">
                            Total: {formatCurrency(rep.totalCost)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Manager Comments */}
            {activeTab === 'manager_comments' && (
              <div className="space-y-4">
                {canAddManagerComment && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={managerCommentText}
                      onChange={(e) => setManagerCommentText(e.target.value)}
                      className={inputBaseClass}
                      placeholder="Add manager coordination note or instruction..."
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={commentSubmitting || !managerCommentText.trim()}
                        onClick={() => handleAddComment(CommentKind.MANAGER)}
                        className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Post Manager Comment
                      </button>
                    </div>
                  </div>
                )}
                {commentError && <p className="text-xs text-rose-500">{commentError}</p>}
                {managerComments.length === 0 ? (
                  <EmptyState
                    title="No manager comments"
                    description="Workshop Manager notes and safety directives appear here."
                    icon={<MessageSquare className="w-5 h-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {managerComments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {c.authorName} · {ROLE_LABELS[c.authorRole]}
                          </span>
                          <time className="font-mono tabular-nums text-slate-500">
                            {formatDateTime(c.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: User Comments */}
            {activeTab === 'user_comments' && (
              <div className="space-y-4">
                {canAddUserComment && (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={userCommentText}
                      onChange={(e) => setUserCommentText(e.target.value)}
                      className={inputBaseClass}
                      placeholder="Add requester update, site access details, or comment..."
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={commentSubmitting || !userCommentText.trim()}
                        onClick={() => handleAddComment(CommentKind.USER)}
                        className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                      >
                        Post Comment
                      </button>
                    </div>
                  </div>
                )}
                {commentError && <p className="text-xs text-rose-500">{commentError}</p>}
                {userComments.length === 0 ? (
                  <EmptyState
                    title="No user comments"
                    description="Requester and staff updates appear in this thread."
                    icon={<MessageSquare className="w-5 h-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {userComments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {c.authorName} · {ROLE_LABELS[c.authorRole]}
                          </span>
                          <time className="font-mono tabular-nums text-slate-500">
                            {formatDateTime(c.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Approvals */}
            {activeTab === 'approvals' && (
              <div>
                {request.approvals.length === 0 ? (
                  <EmptyState
                    title="No approvals recorded yet"
                    description="Department Head and Finance authorization decisions will appear here."
                    icon={<ShieldCheck className="w-5 h-5" />}
                  />
                ) : (
                  <div className="space-y-3">
                    {request.approvals.map((app) => (
                      <div
                        key={app.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {app.decision === ApprovalDecision.APPROVED ? (
                              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            )}
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {app.stage === 'HOD' ? 'Head of Department' : 'Finance'} · {app.decision}
                            </span>
                          </div>
                          <time className="font-mono text-xs tabular-nums text-slate-500">
                            {formatDateTime(app.createdAt)}
                          </time>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Reviewed by <strong className="text-slate-800 dark:text-slate-200">{app.actorName}</strong>
                          {app.amountApproved !== undefined && (
                            <span className="ml-2 font-mono tabular-nums text-[#10B981]">
                              ({formatCurrency(app.amountApproved)})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{app.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Attachments */}
            {activeTab === 'attachments' && (
              <div>
                {request.attachments.length === 0 ? (
                  <EmptyState
                    title="No photo attachments"
                    description="Use Edit Worksheet to upload inspection photos for this job."
                    icon={<ImageIcon className="w-5 h-5" />}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {request.attachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setPreviewAttachment(att)}
                        className="group text-left rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-[#071121]"
                      >
                        <div className="aspect-4/3 overflow-hidden">
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="p-2 text-xs text-slate-700 dark:text-slate-300 truncate">
                          {att.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Worksheet Metadata + Activity Timeline */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              Worksheet Specifications
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Department</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {department?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Category</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {category?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Reason</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {reason?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Location</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {request.location}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Requester</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {requester?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Assigned Technician</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {assignedTech?.name ?? 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Purchase Required</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                  {request.needsPurchase ? 'Yes (Finance route)' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Estimated / Approved Cost</dt>
                <dd className="mt-0.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(request.estimatedCost)}
                  {request.approvedCost !== null && (
                    <span className="text-[#10B981]"> / {formatCurrency(request.approvedCost)}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Created</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                  {formatDate(request.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Due Date</dt>
                <dd
                  className={cn(
                    'mt-0.5 font-mono tabular-nums',
                    overdue ? 'text-rose-500 font-semibold' : 'text-slate-800 dark:text-slate-200'
                  )}
                >
                  {formatDate(request.dueDate)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Activity Timeline
            </h2>
            <Timeline events={request.timeline} />
          </div>
        </div>
      </div>

      {/* Transition Action Modal */}
      <Modal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        title={pendingAction?.label || 'Update Status'}
        subtitle={pendingAction?.description}
        size="lg"
      >
        {pendingAction && (
          <form onSubmit={handleConfirmTransition} className="space-y-4">
            {pendingAction.requiresTechnician && (
              <FormField label="Assign Technician" htmlFor="trans-tech" required>
                <select
                  id="trans-tech"
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className={inputBaseClass}
                  required
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.title}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {request.status === RequestStatus.AWAITING_FINANCE_APPROVAL &&
              pendingAction.targetStatus === RequestStatus.COMPLETED && (
                <FormField label="Approved Purchase Amount (USD)" htmlFor="trans-amount" required>
                  <input
                    id="trans-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className={`${inputBaseClass} font-mono tabular-nums`}
                    required
                  />
                </FormField>
              )}

            <FormField
              label="Transition Note"
              htmlFor="trans-note"
              required={pendingAction.requiresNote}
              hint="Recorded permanently in the request timeline and audit log."
            >
              <textarea
                id="trans-note"
                rows={3}
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                className={inputBaseClass}
                placeholder="Enter verification note, assignment instructions, or approval remarks..."
                required={pendingAction.requiresNote}
              />
            </FormField>

            {/* Gemini Notification Drafter */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#071121]/70 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Simulated Email &amp; SMS Notification
                </span>
                <button
                  type="button"
                  onClick={handleDraftNotification}
                  disabled={draftLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] text-xs font-semibold disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{draftLoading ? 'Drafting...' : 'Draft with Gemini'}</span>
                </button>
              </div>
              {draftError && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{draftError}</p>
              )}
              {(draftEmailSubject || draftEmailBody || draftSmsText) && (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    value={draftEmailSubject}
                    onChange={(e) => setDraftEmailSubject(e.target.value)}
                    className={inputBaseClass}
                    placeholder="Email Subject"
                  />
                  <textarea
                    rows={2}
                    value={draftEmailBody}
                    onChange={(e) => setDraftEmailBody(e.target.value)}
                    className={inputBaseClass}
                    placeholder="Email Body"
                  />
                  <input
                    type="text"
                    value={draftSmsText}
                    onChange={(e) => setDraftSmsText(e.target.value)}
                    className={inputBaseClass}
                    placeholder="SMS Text"
                  />
                </div>
              )}
            </div>

            {transitionError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{transitionError}</p>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transitionSubmitting}
                className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {transitionSubmitting ? 'Updating...' : 'Confirm Transition'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ImageLightbox attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
};
