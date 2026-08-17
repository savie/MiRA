import { getMemories, getSetting } from '../db/vault';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function assembleContext(userInput: string, recentMessages: Message[]): Message[] {
  const systemPrompt = getSetting('system_prompt') ??
    `Kamu adalah MiRA — Pantulan digital dari pemilikmu.
Kamu bukan asisten generik. Kamu mengenal pemilikmu, mengingat apa yang mereka ajarkan, dan berkembang bersama mereka.
Jawab dengan jujur, langsung, dan personal. Jangan bertele-tele.`;

  // Ambil semua memori — bukan search by keyword
  const allMemories = getMemories().slice(0, 15);

  let memoryContext = '';
  if (allMemories.length > 0) {
    memoryContext = '\n\n[MEMORI TENTANG PEMILIK]\n' +
      allMemories.map(m => `- ${m.content}`).join('\n');
  }

  const fullSystem = systemPrompt + memoryContext;

  // Hanya kirim 10 pesan terakhir ke AI
  const trimmedHistory = recentMessages.slice(-10);

  return [
    { role: 'user', content: `[SYSTEM]\n${fullSystem}\n\n[USER]\n${userInput}` },
    ...trimmedHistory,
  ];
}
