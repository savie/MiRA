import { getSetting, addAuditLog } from '../db/vault';
import { Message } from '../context/assembler';

export async function callAI(messages: Message[]): Promise<string> {
  const apiKey = getSetting('api_key');
  const apiUrl = getSetting('api_url') ?? 'https://api.groq.com/openai/v1/chat/completions';
  const model = getSetting('model') ?? 'llama3-8b-8192';

  if (!apiKey) {
    return 'API key belum diset. Buka Settings dan masukkan API key kamu.';
  }

  try {
    const response = await fetch(apiUrl, {
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
      addAuditLog('API_ERROR', `Status: ${response.status} | ${err.slice(0, 100)}`);
      return `Error dari AI provider: ${response.status}. Cek API key dan URL di Settings.`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? 'Tidak ada respons dari AI.';
  } catch (error) {
    addAuditLog('API_ERROR', `Network error: ${String(error).slice(0, 100)}`);
    return 'Gagal terhubung ke AI provider. Cek koneksi internet kamu.';
  }
}

export async function evaluateMemoryWorthiness(
  userMessage: string,
  aiResponse: string
): Promise<{ shouldSave: boolean; content: string; tags: string; importance: number }> {
  const apiKey = getSetting('api_key');
  const apiUrl = getSetting('api_url') ?? 'https://api.groq.com/openai/v1/chat/completions';
  const model = getSetting('model') ?? 'llama3-8b-8192';

  if (!apiKey) return { shouldSave: false, content: '', tags: '', importance: 0 };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `Analisis percakapan ini dan tentukan apakah ada info penting yang perlu diingat tentang pemilik MiRA.

User: ${userMessage}
MiRA: ${aiResponse}

Jawab HANYA dalam format JSON ini (tanpa markdown):
{
  "shouldSave": true/false,
  "content": "ringkasan singkat info penting (kosong jika shouldSave=false)",
  "tags": "tag1,tag2 (kosong jika shouldSave=false)",
  "importance": 0.0-1.0
}

Simpan jika ada: fakta personal, preferensi, keputusan penting, atau info yang akan berguna di percakapan masa depan.
Jangan simpan jika: pertanyaan umum, smalltalk, atau info yang tidak personal.`
        }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(text);
  } catch {
    return { shouldSave: false, content: '', tags: '', importance: 0 };
  }
}
