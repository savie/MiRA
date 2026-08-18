import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, SafeAreaView, Alert, Switch,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getProviders, addLocalProvider, toggleProvider, updateProviderUrl,
  getModelsForProvider, addModel, deleteModel, Provider } from '@/db/vault';

export default function LocalProviderScreen() {
  const [name, setName] = useState('llama.cpp');
  const [url, setUrl] = useState('http://127.0.0.1:8080/v1/chat/completions');
  const [modelId, setModelId] = useState('');
  const [locals, setLocals] = useState<Provider[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [models, setModels] = useState<Record<number, any[]>>({});

  const refresh = useCallback(() => {
    const all = getProviders().filter(p => p.name.startsWith('Local:'));
    setLocals(all);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAdd = () => {
    if (!url.trim()) { Alert.alert('Error', 'URL tidak boleh kosong.'); return; }
    addLocalProvider(name.trim() || 'llama.cpp', url.trim());
    Alert.alert('✓', 'Local provider ditambahkan.');
    refresh();
  };

  const handleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
    setModels(prev => ({ ...prev, [id]: getModelsForProvider(id) }));
  };

  const handleAddModel = (providerId: number) => {
    if (!modelId.trim()) { Alert.alert('Error', 'Model ID kosong.'); return; }
    addModel(providerId, modelId.trim(), modelId.trim(), 'all');
    setModelId('');
    setModels(prev => ({ ...prev, [providerId]: getModelsForProvider(providerId) }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => require('expo-router').router.back()}>
          <Text style={styles.back}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL PROVIDERS</Text>
      </View>

      {/* Add new */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TAMBAH LOCAL PROVIDER</Text>
        <Text style={styles.label}>Nama</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="llama.cpp / LM Studio / Ollama"
          placeholderTextColor="#444"
        />
        <Text style={styles.label}>URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="http://127.0.0.1:8080/v1/chat/completions"
          placeholderTextColor="#444"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>+ Tambah Provider</Text>
        </TouchableOpacity>

        <View style={styles.hint}>
          <Text style={styles.hintText}>💡 llama-server default: port 8080</Text>
          <Text style={styles.hintText}>💡 LM Studio default: port 1234</Text>
          <Text style={styles.hintText}>💡 Ollama default: port 11434</Text>
        </View>
      </View>

      {/* List */}
      <Text style={styles.sectionLabel2}>ACTIVE LOCAL PROVIDERS</Text>
      <FlatList
        data={locals}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Belum ada local provider</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => handleExpand(item.id)}>
              <View style={styles.cardLeft}>
                <View style={[styles.dot, { backgroundColor: item.is_enabled ? '#22c55e' : '#333' }]} />
                <View>
                  <Text style={styles.cardName}>{item.name.replace('Local: ', '')}</Text>
                  <Text style={styles.cardUrl}>{item.base_url}</Text>
                </View>
              </View>
              <Switch
                value={item.is_enabled === 1}
                onValueChange={v => { toggleProvider(item.id, v); refresh(); }}
                trackColor={{ false: '#222', true: '#4c1d95' }}
                thumbColor={item.is_enabled ? '#a78bfa' : '#555'}
              />
            </TouchableOpacity>

            {expandedId === item.id && (
              <View style={styles.cardBody}>
                <Text style={styles.label}>Models</Text>
                {(models[item.id] ?? []).map((m: any) => (
                  <View key={m.id} style={styles.modelRow}>
                    <Text style={styles.modelId}>{m.model_id}</Text>
                    <TouchableOpacity onPress={() => { deleteModel(m.id); setModels(prev => ({ ...prev, [item.id]: getModelsForProvider(item.id) })); }}>
                      <Text style={styles.deleteModel}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addModelRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={modelId}
                    onChangeText={setModelId}
                    placeholder="nama-model / model-id"
                    placeholderTextColor="#444"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.addModelBtn} onPress={() => handleAddModel(item.id)}>
                    <Text style={styles.addModelBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: '#a78bfa', fontSize: 14, marginBottom: 8 },
  headerTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  section: { padding: 20 },
  sectionLabel: { color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  sectionLabel2: { color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 8, paddingHorizontal: 20 },
  label: { color: '#666', fontSize: 12, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#1e1e1e' },
  addBtn: { backgroundColor: '#a78bfa', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hint: { marginTop: 12, gap: 4 },
  hintText: { color: '#333', fontSize: 11 },
  list: { paddingHorizontal: 20, gap: 8 },
  empty: { color: '#333', fontSize: 13, textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#0d0d0d', borderRadius: 12, borderWidth: 1, borderColor: '#1a1a1a', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  cardUrl: { color: '#333', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  cardBody: { padding: 14, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  modelId: { color: '#888', fontSize: 12 },
  deleteModel: { color: '#ef4444', fontSize: 16, paddingHorizontal: 8 },
  addModelRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addModelBtn: { backgroundColor: '#1e1b4b', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  addModelBtnText: { color: '#a78bfa', fontSize: 20, fontWeight: '700' },
});
