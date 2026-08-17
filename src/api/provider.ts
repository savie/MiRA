import { getMemories, addAuditLog, getSetting, getModelsForType, addRoutingLog } from '../db/vault';
import { classifyInput, InputType } from './classifier';
import { Message } from '../context/assembler';

// ─── Main Router ─────────────────────────────────────────────
export async function callAI(messages: Message[], userInput: string): Promise<string> {
  const inputType = classifyInput(userInput);
  addAuditLog('CLASSIFIER', `Input type: ${inputType} | "${userInput.slice(0, 50)}"`);

  const candidates = getModelsForType(inputType);

  if (candidates.length === 0) {
    // Fallback: coba semua model dari semua provider
    const allCandidates = getModelsForType('all');
    if (allCandidates.length === 0) {
      return 'Belum ada model yang dikonfigurasi. Buka Settings → Providers dan tambahkan model.';
    }
    return tryProviders(allCandidates, messages, inputType);
  }

  return tryProviders(candidates, messages, inputType);
}

async function tryProviders(candidates: any[], messages: Message[], inputType: InputType): Promise<string> {
  for (const candidate of candidates) {
    if (!candidate.api_key) {
      addRoutingLog(inputType, candidate.provider_name, candidate.model_id, false, 'No API key');
      continue;
    }

    try {
      const result = await callProvider(
        candidate.base_url,
        candidate.api_key,
        candidate.model_id,
        messages
      );

      addRoutingLog(inputType, candidate.provider_name, candidate.model_id, true);
      addAuditLog('ROUTE_SUCCESS', `${candidate.provider_name} → ${candidate.model_id}`);
      return result;

    } catch (error) {
      const errMsg = String(error).slice(0, 100);
      addRoutingLog(inputType, candidate.provider_name, candidate.model_id, false, errMsg);
      addAuditLog('ROUTE_FAIL', `${candidate.provider_name} → ${candidate.model_id} | ${errMsg}`);
      // Lanjut ke provider berikutnya
      continue;
    }
  }

  return 'Semua provider gagal. Cek API key dan koneksi internet di Settings → Providers.';
}

async function callProvider(baseUrl: string, apiKey: string, model: string, messages: Message[]): Promise<string> {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status}: ${err.slice(0, 100)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from provider');
  return content;
}

// ─── Memory Evaluator ────────────────────────────────────────
export async function evaluateMemoryWorthiness(
  userMessage: string,
  aiResponse: string
): Promise<{ shouldSave: boolean; content: string; tags: string; importance: number }> {
  const candidates = getModelsForType('simple');
  if (candidates.length === 0) return { shouldSave: false, content: '', tags: '', importance: 0 };

  const candidate = candidates[0];
  if (!candidate.api_key) return { shouldSave: false, content: '', tags: '', importance: 0 };

  try {
    const response = await fetch(candidate.base_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${candidate.api_key}`,
      },
      body: JSON.stringify({
        model: candidate.model_id,
        messages: [{
          role: 'user',
          content: `Analisis percakapan ini. Apakah ada info penting tentang pemilik yang perlu diingat?

User: ${userMessage}
AI: ${aiResponse}

Jawab HANYA JSON (tanpa markdown):
{"shouldSave":true/false,"content":"ringkasan singkat","tags":"tag1,tag2","importance":0.0-1.0}

Simpan: fakta personal, preferensi, keputusan penting.
Jangan simpan: smalltalk, pertanyaan umum.`
        }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { shouldSave: false, content: '', tags: '', importance: 0 };
  }
}
