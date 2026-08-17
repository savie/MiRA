// Rule-based classifier — cepat, zero token cost
// Bisa di-upgrade ke AI classifier nanti

export type InputType = 'simple' | 'reasoning' | 'semantic';

const REASONING_KEYWORDS = [
  'kenapa', 'mengapa', 'bagaimana cara', 'jelaskan', 'analisis', 'bandingkan',
  'perbedaan', 'kelebihan', 'kekurangan', 'pros', 'cons', 'strategi', 'rencana',
  'solusi', 'debug', 'error', 'fix', 'masalah', 'problem', 'why', 'how',
  'explain', 'analyze', 'compare', 'difference', 'strategy', 'plan', 'solve',
  'calculate', 'hitung', 'rumus', 'formula', 'logic', 'logika', 'alasan',
  'sebab', 'akibat', 'dampak', 'pengaruh', 'efek', 'hasil', 'kesimpulan'
];

const SEMANTIC_KEYWORDS = [
  'ingat', 'remember', 'kemarin', 'sebelumnya', 'tadi', 'pernah', 'bilang',
  'cerita', 'kata', 'kamu tau', 'kamu tahu', 'aku pernah', 'gw pernah',
  'waktu itu', 'dulu', 'history', 'riwayat', 'memori', 'memory',
  'siapa gw', 'nama gw', 'gw suka', 'gw tinggal', 'gw kerja', 'profil',
  'tentang gw', 'tentang aku', 'who am i', 'my name', 'i told you'
];

export function classifyInput(input: string): InputType {
  const lower = input.toLowerCase();

  // Semantic: pertanyaan yang butuh memori/konteks personal
  const isSemantic = SEMANTIC_KEYWORDS.some(kw => lower.includes(kw));
  if (isSemantic) return 'semantic';

  // Reasoning: pertanyaan analitis, teknis, atau kompleks
  const isReasoning = REASONING_KEYWORDS.some(kw => lower.includes(kw));
  if (isReasoning) return 'reasoning';

  // Panjang input > 200 karakter → kemungkinan reasoning
  if (input.length > 200) return 'reasoning';

  // Default: simple conversation
  return 'simple';
}
