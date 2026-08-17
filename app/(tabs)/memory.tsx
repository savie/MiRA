import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, Alert, StyleSheet, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getMemories, searchMemories, softDeleteMemory, permanentDeleteMemory, Memory } from '@/db/vault';

export default function MemoryScreen() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    const result = query.trim() ? searchMemories(query) : getMemories();
    setMemories(result);
  }, [query]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleSoftDelete = (id: number) => {
    Alert.alert('Sembunyikan Memori', 'Memori ini akan disembunyikan (bisa dipulihkan via backup).', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Sembunyikan', onPress: () => { softDeleteMemory(id); refresh(); } },
    ]);
  };

  const handlePermanentDelete = (id: number) => {
    Alert.alert(
      '⚠️ Hapus Permanen',
      'Memori ini akan dihapus selamanya. Tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus Permanen', style: 'destructive', onPress: () => { permanentDeleteMemory(id); refresh(); } },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MEMORY VAULT</Text>
        <Text style={styles.count}>{memories.length} memori</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={text => { setQuery(text); }}
          onEndEditing={refresh}
          placeholder="Cari memori atau tag..."
          placeholderTextColor="#555"
          returnKeyType="search"
          onSubmitEditing={refresh}
        />
      </View>

      <FlatList
        data={memories}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Belum ada memori tersimpan</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardContent}>{item.content}</Text>
            {item.tags ? (
              <View style={styles.tagRow}>
                {item.tags.split(',').map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag.trim()}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('id-ID')}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => handleSoftDelete(item.id)} style={styles.actionBtn}>
                  <Text style={styles.softDelete}>Sembunyikan</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handlePermanentDelete(item.id)} style={styles.actionBtn}>
                  <Text style={styles.hardDelete}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  count: { color: '#444', fontSize: 13 },
  searchRow: { padding: 12 },
  searchInput: {
    backgroundColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  list: { padding: 12, gap: 10 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#333', fontSize: 14 },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  cardContent: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#1e1b4b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#a78bfa', fontSize: 11 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardDate: { color: '#444', fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { paddingVertical: 4 },
  softDelete: { color: '#666', fontSize: 12 },
  hardDelete: { color: '#ef4444', fontSize: 12 },
});
