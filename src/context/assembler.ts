import { getMemories, getSetting } from '../db/vault';

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export function assembleContext(
  userInput: string,
  recentMessages: { role: 'user' | 'assistant'; content: string }[],
  imageBase64?: string
): Message[] {
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
  const trimmed = recentMessages.slice(-10);

  // Buang pesan terakhir kalau user (akan diganti userInput baru)
  const cleanHistory: Message[] = trimmed
    .filter((_, i) => !(i === trimmed.length - 1 && trimmed[i].role === 'user'))
    .map(m => ({ role: m.role, content: m.content }));

  // User message — support teks + gambar
  let userContent: string | ContentBlock[];
  if (imageBase64) {
    userContent = [
      { type: 'text', text: userInput },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      },
    ];
  } else {
    userContent = userInput;
  }

  return [
    { role: 'user', content: `[SYSTEM]\n${fullSystem}` },
    { role: 'assistant', content: 'Siap.' },
    ...cleanHistory,
    { role: 'user', content: userContent },
  ];
}
