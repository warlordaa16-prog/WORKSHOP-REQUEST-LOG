import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseAiJson<T>(rawText: string | undefined): T {
  const trimmed = (rawText ?? '').trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!cleaned) {
    throw new Error('Empty response received from Gemini.');
  }
  return JSON.parse(cleaned) as T;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // 1. Smart Intake: suggest title, category, priority from raw description
  app.post('/api/ai/smart-intake', async (req, res) => {
    try {
      const { description, categories } = req.body as {
        description?: string;
        categories?: Array<{ id: string; name: string }>;
      };

      if (!description || description.trim().length < 5) {
        return res.status(400).json({ error: 'Please provide a longer description first.' });
      }

      const ai = getGeminiClient();
      const catList = (categories || []).map((c) => `${c.id}: ${c.name}`).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this workshop maintenance request description and suggest a concise, professional title (max 10 words), the best matching categoryId from the list below, a priority (LOW, MEDIUM, HIGH, or URGENT), and a 1-sentence rationale.

Available Categories:
${catList}

Request Description:
${description}`,
        config: {
          systemInstruction:
            'You are a workshop operations coordinator. Return structured JSON only. Never reference medical or hospital terminology.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedTitle: { type: Type.STRING },
              suggestedCategoryId: { type: Type.STRING },
              suggestedPriority: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
            required: ['suggestedTitle', 'suggestedCategoryId', 'suggestedPriority', 'rationale'],
          },
        },
      });

      const parsed = parseAiJson(response.text);
      return res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI smart intake failed';
      return res.status(503).json({ error: message });
    }
  });

  // 2. Technician Report Assistant: turn rough notes into structured report
  app.post('/api/ai/polish-report', async (req, res) => {
    try {
      const { roughNotes, requestTitle, categoryName, partsUsed } = req.body as {
        roughNotes?: string;
        requestTitle?: string;
        categoryName?: string;
        partsUsed?: string;
      };

      if (!roughNotes || roughNotes.trim().length < 5) {
        return res.status(400).json({ error: 'Enter rough notes before polishing.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Transform these rough technician field notes into a clear, factual, professional workshop service report.

Job Title: ${requestTitle || 'Workshop Job'}
Category: ${categoryName || 'General Maintenance'}
Parts Noted: ${partsUsed || 'None specified'}
Rough Notes:
${roughNotes}`,
        config: {
          systemInstruction:
            'You are a senior industrial maintenance lead writing concise, factual workshop reports. Keep workDone to 2-4 crisp sentences. Return structured JSON.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              workDone: { type: Type.STRING },
              partsSummary: { type: Type.STRING },
              recommendations: { type: Type.STRING },
            },
            required: ['workDone', 'partsSummary', 'recommendations'],
          },
        },
      });

      const parsed = parseAiJson(response.text);
      return res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI report assistant failed';
      return res.status(503).json({ error: message });
    }
  });

  // 3. Request Summary: TL;DR of request thread
  app.post('/api/ai/summarize-request', async (req, res) => {
    try {
      const { requestSummaryPayload } = req.body as { requestSummaryPayload?: unknown };
      if (!requestSummaryPayload) {
        return res.status(400).json({ error: 'Missing request data.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Summarize this workshop request thread for a busy manager or stakeholder:\n${JSON.stringify(
          requestSummaryPayload
        )}`,
        config: {
          systemInstruction:
            'Provide an executive TL;DR of the job status, key actions taken so far, and the single clearest next step. Keep each field concise (1-2 sentences). Return JSON.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tldr: { type: Type.STRING },
              currentStatusNote: { type: Type.STRING },
              nextAction: { type: Type.STRING },
            },
            required: ['tldr', 'currentStatusNote', 'nextAction'],
          },
        },
      });

      const parsed = parseAiJson(response.text);
      return res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI summary failed';
      return res.status(503).json({ error: message });
    }
  });

  // 4. Notification Drafting: generate SMS & email text for a status change
  app.post('/api/ai/draft-notification', async (req, res) => {
    try {
      const { referenceNumber, title, fromStatus, toStatus, actorName, note } = req.body as {
        referenceNumber?: string;
        title?: string;
        fromStatus?: string;
        toStatus?: string;
        actorName?: string;
        note?: string;
      };

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Draft a notification for a workshop status transition.
Reference: ${referenceNumber || 'N/A'}
Title: ${title || 'Workshop Request'}
Transition: ${fromStatus || 'Previous'} -> ${toStatus || 'Updated'}
Updated By: ${actorName || 'Workshop Staff'}
Note: ${note || 'No additional note'}`,
        config: {
          systemInstruction:
            'Write a polite, clear internal email subject, short email body (3-4 sentences), and a 160-char SMS update. Return JSON.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              emailSubject: { type: Type.STRING },
              emailBody: { type: Type.STRING },
              smsText: { type: Type.STRING },
            },
            required: ['emailSubject', 'emailBody', 'smsText'],
          },
        },
      });

      const parsed = parseAiJson(response.text);
      return res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI notification draft failed';
      return res.status(503).json({ error: message });
    }
  });

  // 5. Insights Panel on Dashboard
  app.post('/api/ai/dashboard-insights', async (req, res) => {
    try {
      const { stats } = req.body as { stats?: unknown };
      if (!stats) {
        return res.status(400).json({ error: 'Missing aggregated stats.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Review these aggregated workshop operations metrics and generate exactly 3 brief, data-grounded observations highlighting bottlenecks, workload balance, or recurring categories:\n${JSON.stringify(
          stats
        )}`,
        config: {
          systemInstruction:
            'You are an operations analyst for a workshop & facilities team. Return exactly 3 concise observations as JSON. Severity must be "info", "warning", or "critical".',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              observations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    severity: { type: Type.STRING },
                  },
                  required: ['title', 'detail', 'severity'],
                },
              },
            },
            required: ['observations'],
          },
        },
      });

      const parsed = parseAiJson(response.text);
      return res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI insights unavailable';
      return res.status(503).json({ error: message });
    }
  });

  // Return clean JSON 404 for unknown /api routes instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // JSON error handler for malformed payloads
  app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  });

  const httpServer = http.createServer(app);
  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    process.env.DISABLE_HMR ??= 'true';
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: disableHmr ? false : undefined,
      },
      appType: 'spa',
    });
    if (disableHmr) {
      app.get('/@vite/client', async (_req, res, next) => {
        try {
          const result = await vite.transformRequest('/@vite/client');
          if (!result) return next();
          const code = result.code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket transport disabled */'
          );
          res.setHeader('Content-Type', 'application/javascript');
          return res.send(code);
        } catch (err) {
          return next(err);
        }
      });
    }
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`WorkshopLog server listening on http://localhost:${PORT}`);
  });
}

startServer();
