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

  const allMemories = getMemories().slice(0, 15);

  let memoryContext = '';
  if (allMemories.length > 0) {
    memoryContext = '\n\n[MEMORI TENTANG PEMILIK]\n' +
      allMemories.map(m => `- ${m.content}`).join('\n');
  }

  const fullSystem = systemPrompt + memoryContext;

  // Pastiin history selalu diakhiri assistant, bukan user
  // agar pesan user baru yang jadi pesan terakhir
  const trimmed = recentMessages.slice(-10);

  // Buang pesan terakhir kalau role-nya user (akan diganti userInput)
  const cleanHistory = trimmed.filter((_, i) => {
    if (i === trimmed.length - 1 && trimmed[i].role === 'user') return false;
    return true;
  });

  return [
    { role: 'user', content: `[SYSTEM]\n${fullSystem}` },
    { role: 'assistant', content: 'Siap.' },
    ...cleanHistory,
    { role: 'user', content: userInput },
  ];
}