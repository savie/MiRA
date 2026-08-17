# MiRA — The Mirror

Personal AI companion dengan local-first memory architecture.

## Stack
- Expo SDK 51 (managed workflow)
- expo-router v3 (file-based navigation)
- expo-sqlite (The Vault — local database)
- React Native 0.74

## Setup & Push ke GitHub

```bash
# 1. Clone / buat folder
git init
git remote add origin https://github.com/savie/MiRA.git

# 2. Install dependencies
npm install

# 3. Push
git add .
git commit -m "init: MiRA v1.0 scaffold"
git push -u origin master
```

## GitHub Secrets yang dibutuhkan
Di repo Settings → Secrets → Actions:
- `EXPO_TOKEN` — dari expo.dev → Account → Access Tokens

## Build APK
Setelah push, Expo EAS otomatis build karena sudah connect.
Atau manual: `eas build --platform android --profile preview`

## AI Provider yang didukung
- **Groq** (recommended free): `https://api.groq.com/openai/v1/chat/completions`
- **OpenRouter**: `https://openrouter.ai/api/v1/chat/completions`
- Semua provider OpenAI-compatible

## Arsitektur
```
MiRA
├── Identity      anchor_id UUID — dibuat sekali, tidak berubah
├── The Vault     SQLite lokal — memories, audit, settings
├── Context       System Prompt + Relevant Memory + User Input
├── Provider      Hanya terima context, langsung lupa
└── Audit         Append-only blackbox log
```
