import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, StyleSheet, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getSetting, setSetting, getAnchorId, exportVault, importVault, addAuditLog } from '@/db/vault';
import { Clipboard } from 'react-native';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [anchorId, setAnchorId] = useState('');

  useFocusEffect(useCallback(() => {
    setApiKey(getSetting('api_key') ?? '');
    setApiUrl(getSetting('api_url') ?? 'https://api.groq.com/openai/v1/chat/completions');
    setModel(getSetting('model') ?? 'llama3-8b-8192');
    setSystemPrompt(getSetting('system_prompt') ?? '');
    setAnchorId(getAnchorId());
  }, []));

  const save = () => {
    setSetting('api_key', apiKey.trim());
    setSetting('api_url', apiUrl.trim());
    setSetting('model', model.trim());
    setSetting('system_prompt', systemPrompt.trim());
    Alert.alert('✓ Tersimpan', 'Pengaturan berhasil disimpan.');
  };

  const handleExport = async () => {
    const json = exportVault();
    Clipboard.setString(json);
    Alert.alert('Vault Diekspor', 'Data vault disalin ke clipboard. Simpan ke tempat yang aman.');
    addAuditLog('VAULT_EXPORTED', 'Owner triggered export');
  };

  const handleImport = () => {
    Alert.prompt(
      'Import Vault',
      'Paste JSON backup vault kamu:',
      (text) => {
        if (!text) return;
        const success = importVault(text);
        Alert.alert(
          success ? '✓ Berhasil' : '✗ Gagal',
          success ? 'Vault berhasil dipulihkan.' : 'Format JSON tidak valid.'
        );
      },
      'plain-text'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>SETTINGS</Text>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>IDENTITY</Text>
          <View style={styles.identityCard}>
            <Text style={styles.identityLabel}>Anchor ID (immutable)</Text>
            <Text style={styles.anchorId}>{anchorId}</Text>
            <Text style={styles.identityNote}>ID ini tidak pernah berubah, bahkan jika kamu ganti HP atau model AI.</Text>
          </View>
        </View>

        {/* AI Provider */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI PROVIDER</Text>

          <Text style={styles.label}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="gsk_... atau sk-..."
            placeholderTextColor="#444"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>API URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="https://api.groq.com/openai/v1/chat/completions"
            placeholderTextColor="#444"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Groq: api.groq.com · OpenRouter: openrouter.ai/api/v1</Text>

          <Text style={styles.label}>Model</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="llama3-8b-8192"
            placeholderTextColor="#444"
            autoCapitalize="none"
          />
        </View>

        {/* System Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SYSTEM PROMPT</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="Kosongkan untuk pakai default MiRA..."
            placeholderTextColor="#444"
            multiline
            numberOfLines={5}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Simpan Pengaturan</Text>
        </TouchableOpacity>

        {/* Vault */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VAULT</Text>
          <TouchableOpacity style={styles.vaultBtn} onPress={handleExport}>
            <Text style={styles.vaultBtnText}>📤 Export Vault (ke Clipboard)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.vaultBtn, styles.importBtn]} onPress={handleImport}>
            <Text style={styles.vaultBtnText}>📥 Import / Restore Vault</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Simpan export vault di tempat aman untuk backup HP.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700', letterSpacing: 2, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionLabel: { color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  label: { color: '#666', fontSize: 13, marginBottom: 6, marginTop: 12 },
  hint: { color: '#333', fontSize: 11, marginTop: 6 },
  input: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#a78bfa',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  identityCard: {
    backgroundColor: '#0d0d1a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e1b4b',
  },
  identityLabel: { color: '#444', fontSize: 11, marginBottom: 6 },
  anchorId: { color: '#a78bfa', fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 },
  identityNote: { color: '#333', fontSize: 11, marginTop: 8 },
  vaultBtn: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    marginBottom: 8,
  },
  importBtn: { borderColor: '#1e1b4b' },
  vaultBtnText: { color: '#888', fontSize: 14 },
});
