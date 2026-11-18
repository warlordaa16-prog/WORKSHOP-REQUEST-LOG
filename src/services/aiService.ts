import { Category, Priority } from '../types';

export interface SmartIntakeSuggestion {
  suggestedTitle: string;
  suggestedCategoryId: string;
  suggestedPriority: Priority;
  rationale: string;
}

export interface PolishedReportResult {
  workDone: string;
  partsSummary: string;
  recommendations: string;
}

export interface RequestSummaryResult {
  tldr: string;
  currentStatusNote: string;
  nextAction: string;
}

export interface NotificationDraftResult {
  emailSubject: string;
  emailBody: string;
  smsText: string;
}

export interface DashboardInsightObservation {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `AI request failed (${res.status})`);
  }
  return data as T;
}

export const aiService = {
  async smartIntake(description: string, categories: Category[]): Promise<SmartIntakeSuggestion> {
    return postJson<SmartIntakeSuggestion>('/api/ai/smart-intake', {
      description,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
    });
  },

  async polishReport(payload: {
    roughNotes: string;
    requestTitle: string;
    categoryName: string;
    partsUsed: string;
  }): Promise<PolishedReportResult> {
    return postJson<PolishedReportResult>('/api/ai/polish-report', payload);
  },

  async summarizeRequest(requestSummaryPayload: unknown): Promise<RequestSummaryResult> {
    return postJson<RequestSummaryResult>('/api/ai/summarize-request', { requestSummaryPayload });
  },

  async draftNotification(payload: {
    referenceNumber: string;
    title: string;
    fromStatus: string;
    toStatus: string;
    actorName: string;
    note: string;
  }): Promise<NotificationDraftResult> {
    return postJson<NotificationDraftResult>('/api/ai/draft-notification', payload);
  },

  async dashboardInsights(stats: unknown): Promise<{ observations: DashboardInsightObservation[] }> {
    return postJson<{ observations: DashboardInsightObservation[] }>('/api/ai/dashboard-insights', { stats });
  },
};
