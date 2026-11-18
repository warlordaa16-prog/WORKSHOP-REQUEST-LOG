import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '../hooks/useAppContext';
import { Attachment, Priority, RequestStatus, UserRole } from '../types';
import { aiService } from '../services/aiService';
import { FormField, inputBaseClass } from '../components/FormField';
import { ImageLightbox } from '../components/ImageLightbox';
import { EmptyState } from '../components/EmptyState';

export const RequestFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { db, currentUser, createRequest, updateRequest } = useApp();
  const navigate = useNavigate();

  const existing = useMemo(() => {
    if (!isEdit || !db) return null;
    return db.requests.find((r) => r.id === id) ?? null;
  }, [isEdit, db, id]);

  const activeDepts = useMemo(() => (db?.departments || []).filter((d) => d.active), [db?.departments]);
  const activeCats = useMemo(() => (db?.categories || []).filter((c) => c.active), [db?.categories]);
  const activeReasons = useMemo(() => (db?.reasons || []).filter((r) => r.active), [db?.reasons]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [location, setLocation] = useState('');
  const [needsPurchase, setNeedsPurchase] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setDepartmentId(existing.departmentId);
      setCategoryId(existing.categoryId);
      setReasonId(existing.reasonId);
      setPriority(existing.priority);
      setLocation(existing.location);
      setNeedsPurchase(existing.needsPurchase);
      setEstimatedCost(String(existing.estimatedCost));
      setDueDate(existing.dueDate.slice(0, 10));
      setAttachments(existing.attachments);
    } else if (db) {
      setDepartmentId((prev) => prev || currentUser?.departmentId || activeDepts[0]?.id || '');
      setCategoryId((prev) => prev || activeCats[0]?.id || '');
      setReasonId((prev) => prev || activeReasons[0]?.id || '');
    }
  }, [existing, db, currentUser, activeDepts, activeCats, activeReasons]);

  if (!db || !currentUser) return null;

  if (isEdit && !existing) {
    return (
      <EmptyState
        title="Worksheet not found"
        description="The requested worksheet could not be located."
        actionLabel="Back to Requests"
        onAction={() => navigate('/requests')}
      />
    );
  }

  const canEditExisting =
    !existing ||
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.WORKSHOP_MANAGER ||
    (currentUser.role === UserRole.REQUESTER &&
      existing.requesterId === currentUser.id &&
      [RequestStatus.OPEN, RequestStatus.REOPENED].includes(existing.status));

  if (isEdit && !canEditExisting) {
    return (
      <EmptyState
        title="Editing restricted"
        description="Requesters can only edit worksheets while Open or Reopened."
        actionLabel="View Request"
        onAction={() => navigate(`/requests/${existing?.id}`)}
      />
    );
  }

  const handleSmartIntake = async () => {
    setAiError(null);
    setAiMessage(null);
    if (description.trim().length < 10) {
      setAiError('Describe the workshop issue in at least 10 characters first.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiService.smartIntake(description, activeCats);
      if (res.suggestedTitle) setTitle(res.suggestedTitle);
      if (res.suggestedCategoryId && activeCats.some((c) => c.id === res.suggestedCategoryId)) {
        setCategoryId(res.suggestedCategoryId);
      }
      if (res.suggestedPriority && Object.values(Priority).includes(res.suggestedPriority)) {
        setPriority(res.suggestedPriority);
      }
      setAiMessage(res.rationale || 'Title, category, and priority suggested from description.');
    } catch (err) {
      setAiError(
        err instanceof Error
          ? `${err.message} You can continue filling out the form manually.`
          : 'AI Smart Intake unavailable. Please fill fields manually.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readPromises = Array.from(files)
      .slice(0, 6)
      .map(
        (file) =>
          new Promise<Attachment | null>((resolve) => {
            if (!file.type.startsWith('image/')) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                dataUrl: String(reader.result || ''),
                uploadedById: currentUser.id,
                uploadedAt: new Date().toISOString(),
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      );

    const loaded = (await Promise.all(readPromises)).filter((x): x is Attachment => Boolean(x));
    setAttachments((prev) => [...prev, ...loaded]);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!title.trim() || !description.trim() || !location.trim()) {
      setSubmitError('Please complete Title, Description, and Location.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        departmentId,
        categoryId,
        reasonId,
        priority,
        location: location.trim(),
        needsPurchase,
        estimatedCost: Number(estimatedCost) || 0,
        dueDate: new Date(`${dueDate}T17:00:00Z`).toISOString(),
        attachments,
      };
      if (isEdit && existing) {
        await updateRequest(existing.id, payload);
        navigate(`/requests/${existing.id}`);
      } else {
        const created = await createRequest({
          ...payload,
          requesterId: currentUser.id,
        });
        navigate(`/requests/${created.id}`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to={existing ? `/requests/${existing.id}` : '/requests'}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[#10B981] mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isEdit ? `Edit Worksheet ${existing?.referenceNumber}` : 'New Workshop Request'}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {isEdit
              ? 'Update worksheet scope, priority, cost estimate, or photo attachments.'
              : `Auto-assigned reference format: WR-2026-${String(db.nextReferenceSeq).padStart(5, '0')}`}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1F3A] p-6 space-y-5 shadow-xs"
      >
        {/* Description + Smart Intake */}
        <FormField
          label="Issue Description"
          htmlFor="req-desc"
          required
          hint="Describe symptoms, equipment ID, safety concerns, or required fabrication specs."
        >
          <textarea
            id="req-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputBaseClass}
            placeholder="e.g., Hydraulic lift cylinder on Forklift FL-08 is weeping oil at the upper seal under load in Bay 3..."
            required
          />
        </FormField>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#071121]/70 px-4 py-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Smart Intake:</span>{' '}
            Let Gemini suggest a clean title, category, and priority from your description.
          </div>
          <button
            type="button"
            onClick={handleSmartIntake}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiLoading ? 'Analyzing...' : 'Auto-Suggest Fields'}</span>
          </button>
        </div>

        {aiMessage && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            {aiMessage}
          </div>
        )}
        {aiError && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            {aiError}
          </div>
        )}

        <FormField label="Worksheet Title" htmlFor="req-title" required>
          <input
            id="req-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputBaseClass}
            placeholder="Concise summary of the work requested"
            required
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Department" htmlFor="req-dept" required>
            <select
              id="req-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={inputBaseClass}
              required
            >
              {activeDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Category" htmlFor="req-cat" required>
            <select
              id="req-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputBaseClass}
              required
            >
              {activeCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Reason" htmlFor="req-reason" required>
            <select
              id="req-reason"
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className={inputBaseClass}
              required
            >
              {activeReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Priority" htmlFor="req-priority" required>
            <select
              id="req-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={inputBaseClass}
              required
            >
              {Object.values(Priority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Location / Bay / Asset" htmlFor="req-loc" required>
            <input
              id="req-loc"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputBaseClass}
              placeholder="e.g., Loading Dock Bay 3"
              required
            />
          </FormField>

          <FormField label="Target Due Date" htmlFor="req-due" required>
            <input
              id="req-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputBaseClass}
              required
            />
          </FormField>
        </div>

        {/* Purchase Toggle & Estimated Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Purchase Authorization
            </span>
            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#071121]/70 cursor-pointer">
              <input
                type="checkbox"
                checked={needsPurchase}
                onChange={(e) => setNeedsPurchase(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Requires external purchase</strong> — routes through Finance Approval after Head of Department sign-off.
              </span>
            </label>
          </div>

          <FormField
            label="Estimated Cost (USD)"
            htmlFor="req-cost"
            hint="Parts, consumables, or external vendor estimate."
          >
            <input
              id="req-cost"
              type="number"
              min="0"
              step="0.01"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className={`${inputBaseClass} font-mono tabular-nums`}
            />
          </FormField>
        </div>

        {/* Base64 Image Attachments */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Photo Attachments
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Stored locally as base64 with lightbox preview.
              </span>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#071121] hover:border-[#10B981] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer transition-colors">
              <ImagePlus className="w-4 h-4 text-[#10B981]" />
              <span>Attach Images</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group relative rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-[#071121]"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(att)}
                    className="block w-full aspect-4/3 overflow-hidden"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </button>
                  <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      aria-label={`Remove ${att.name}`}
                      className="text-rose-500 hover:text-rose-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {submitError && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={existing ? `/requests/${existing.id}` : '/requests'}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Submit Request'}
          </button>
        </div>
      </form>

      <ImageLightbox attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
};
