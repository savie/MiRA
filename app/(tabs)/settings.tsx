import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, StyleSheet, SafeAreaView, Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getSetting, setSetting, getAnchorId, exportVault, importVault,
  getProviders, updateProviderKey, updateProviderUrl, toggleProvider,
  getModelsForProvider, addModel, deleteModel, toggleModel,
  addAuditLog, Provider, AIModel,
} from '@/db/vault';
import { Clipboard } from 'react-native';

const INPUT_TYPES = ['all', 'simple', 'reasoning', 'semantic'];

export default function SettingsScreen() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [anchorId, setAnchorId] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
  const [providerModels, setProviderModels] = useState<Record<number, AIModel[]>>({});
  const [newModel, setNewModel] = useState<Record<number, { id: string; name: string; type: string }>>({});
  const [apiKeys, setApiKeys] = useState<Record<number, string>>({});
  const [providerUrls, setProviderUrls] = useState<Record<number, string>>({});

  const refresh = useCallback(() => {
    setSystemPrompt(getSetting('system_prompt') ?? '');
    setAnchorId(getAnchorId());
    const ps = getProviders();
    setProviders(ps);
    const keys: Record<number, string> = {};
    const urls: Record<number, string> = {};
    ps.forEach(p => { keys[p.id] = p.api_key; urls[p.id] = p.base_url; });
    setApiKeys(keys);
    setProviderUrls(urls);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const loadModels = (providerId: number) => {
    setProviderModels(prev => ({
      ...prev,
      [providerId]: getModelsForProvider(providerId),
    }));
  };

  const handleExpandProvider = (id: number) => {
    if (expandedProvider === id) {
      setExpandedProvider(null);
    } else {
      setExpandedProvider(id);
      loadModels(id);
    }
  };

  const handleSaveUrl = (provider: Provider) => {
    updateProviderUrl(provider.id, providerUrls[provider.id] ?? provider.base_url);
    Alert.alert('✓', `URL ${provider.name} disimpan.`);
  };

  const handleSaveKey = (provider: Provider) => {
    updateProviderKey(provider.id, apiKeys[provider.id] ?? '');
    Alert.alert('✓', `API key ${provider.name} disimpan.`);
    refresh();
  };

  const handleToggleProvider = (id: number, current: number) => {
    toggleProvider(id, current === 0);
    refresh();
  };

  const handleAddModel = (providerId: number) => {
    const m = newModel[providerId];
    if (!m?.id?.trim()) {
      Alert.alert('Error', 'Model ID tidak boleh kosong.');
      return;
    }
    addModel(providerId, m.id.trim(), m.name?.trim() || m.id.trim(), m.type || 'all');
    setNewModel(prev => ({ ...prev, [providerId]: { id: '', name: '', type: 'all' } }));
    loadModels(providerId);
  };

  const handleDeleteModel = (modelId: number, providerId: number) => {
    Alert.alert('Hapus Model', 'Yakin hapus model ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => { deleteModel(modelId); loadModels(providerId); } },
    ]);
  };

  const handleExport = async () => {
    const json = exportVault();
    Clipboard.setString(json);
    Alert.alert('Vault Diekspor', 'Data disalin ke clipboard.');
    addAuditLog('VAULT_EXPORTED', 'Owner triggered export');
  };

  const handleSavePrompt = () => {
    setSetting('system_prompt', systemPrompt.trim());
    Alert.alert('✓', 'System prompt disimpan.');
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
          </View>
        </View>

        {/* Providers */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROVIDERS</Text>
          {providers.map(provider => (
            <View key={provider.id} style={styles.providerCard}>
              {/* Provider header */}
              <TouchableOpacity
                style={styles.providerHeader}
                onPress={() => handleExpandProvider(provider.id)}
              >
                <View style={styles.providerLeft}>
                  <View style={[styles.statusDot, { backgroundColor: provider.is_enabled ? '#22c55e' : '#333' }]} />
                  <Text style={styles.providerName}>{provider.name}</Text>
                </View>
                <View style={styles.providerRight}>
                  <Switch
                    value={provider.is_enabled === 1}
                    onValueChange={() => handleToggleProvider(provider.id, provider.is_enabled)}
                    trackColor={{ false: '#222', true: '#4c1d95' }}
                    thumbColor={provider.is_enabled ? '#a78bfa' : '#555'}
                  />
                  <Text style={styles.expandIcon}>{expandedProvider === provider.id ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {/* Expanded content */}
              {expandedProvider === provider.id && (
                <View style={styles.providerBody}>
                  <Text style={styles.label}>API Key</Text>
                  <View style={styles.keyRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={apiKeys[provider.id] ?? ''}
                      onChangeText={text => setApiKeys(prev => ({ ...prev, [provider.id]: text }))}
                      placeholder="sk-... / gsk_... / hf_..."
                      placeholderTextColor="#444"
                      secureTextEntry
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.saveKeyBtn} onPress={() => handleSaveKey(provider)}>
                      <Text style={styles.saveKeyText}>Simpan</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Base URL</Text>
                  <View style={styles.keyRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, fontSize: 11 }]}
                      value={providerUrls[provider.id] ?? provider.base_url}
                      onChangeText={text => setProviderUrls(prev => ({ ...prev, [provider.id]: text }))}
                      placeholder="https://..."
                      placeholderTextColor="#444"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.saveKeyBtn} onPress={() => handleSaveUrl(provider)}>
                      <Text style={styles.saveKeyText}>Simpan</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Models */}
                  <Text style={[styles.label, { marginTop: 12 }]}>Models</Text>
                  {(providerModels[provider.id] ?? []).map(model => (
                    <View key={model.id} style={styles.modelRow}>
                      <View style={styles.modelInfo}>
                        <Text style={styles.modelId}>{model.model_id}</Text>
                        <Text style={styles.modelType}>{model.input_type}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteModel(model.id, provider.id)}>
                        <Text style={styles.deleteModel}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add model */}
                  <View style={styles.addModelSection}>
                    <Text style={styles.label}>Tambah Model</Text>
                    <TextInput
                      style={styles.input}
                      value={newModel[provider.id]?.id ?? ''}
                      onChangeText={text => setNewModel(prev => ({ ...prev, [provider.id]: { ...prev[provider.id], id: text } }))}
                      placeholder="model-id (contoh: qwen/qwen3.6-27b)"
                      placeholderTextColor="#444"
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={[styles.input, { marginTop: 6 }]}
                      value={newModel[provider.id]?.name ?? ''}
                      onChangeText={text => setNewModel(prev => ({ ...prev, [provider.id]: { ...prev[provider.id], name: text } }))}
                      placeholder="Nama model (opsional)"
                      placeholderTextColor="#444"
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                      {INPUT_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.typeBtn, (newModel[provider.id]?.type ?? 'all') === type && styles.typeBtnActive]}
                          onPress={() => setNewModel(prev => ({ ...prev, [provider.id]: { ...prev[provider.id], type } }))}
                        >
                          <Text style={[styles.typeBtnText, (newModel[provider.id]?.type ?? 'all') === type && styles.typeBtnTextActive]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.addModelBtn} onPress={() => handleAddModel(provider.id)}>
                      <Text style={styles.addModelBtnText}>+ Tambah Model</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
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
          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePrompt}>
            <Text style={styles.saveBtnText}>Simpan System Prompt</Text>
          </TouchableOpacity>
        </View>

        {/* Vault */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VAULT</Text>
          <TouchableOpacity style={styles.vaultBtn} onPress={handleExport}>
            <Text style={styles.vaultBtnText}>📤 Export Vault (ke Clipboard)</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Simpan export vault di tempat aman untuk backup HP.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingBottom: 60 },
  headerTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700', letterSpacing: 2, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionLabel: { color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  label: { color: '#666', fontSize: 12, marginBottom: 6 },
  hint: { color: '#333', fontSize: 11, marginTop: 6 },
  input: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#1e1e1e' },
  textArea: { height: 120, textAlignVertical: 'top' },
  identityCard: { backgroundColor: '#0d0d1a', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1e1b4b' },
  identityLabel: { color: '#444', fontSize: 11, marginBottom: 6 },
  anchorId: { color: '#a78bfa', fontSize: 11, fontFamily: 'monospace' },
  providerCard: { backgroundColor: '#0d0d0d', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a', overflow: 'hidden' },
  providerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  providerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  providerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  providerName: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  expandIcon: { color: '#444', fontSize: 12 },
  providerBody: { padding: 14, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  keyRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  saveKeyBtn: { backgroundColor: '#1e1b4b', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' },
  saveKeyText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  urlText: { color: '#333', fontSize: 10, marginTop: 4, fontFamily: 'monospace' },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  modelInfo: { flex: 1 },
  modelId: { color: '#888', fontSize: 12 },
  modelType: { color: '#444', fontSize: 10, marginTop: 2 },
  deleteModel: { color: '#ef4444', fontSize: 16, paddingHorizontal: 8 },
  addModelSection: { marginTop: 12 },
  typeRow: { marginVertical: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#111', marginRight: 6, borderWidth: 1, borderColor: '#222' },
  typeBtnActive: { backgroundColor: '#1e1b4b', borderColor: '#a78bfa' },
  typeBtnText: { color: '#444', fontSize: 12 },
  typeBtnTextActive: { color: '#a78bfa' },
  addModelBtn: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  addModelBtnText: { color: '#a78bfa', fontSize: 13 },
  saveBtn: { backgroundColor: '#a78bfa', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  vaultBtn: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1e1e1e', marginBottom: 8 },
  vaultBtnText: { color: '#888', fontSize: 14 },
});
