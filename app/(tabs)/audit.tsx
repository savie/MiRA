import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getAuditLogs, AuditLog } from '@/db/vault';

const EVENT_COLORS: Record<string, string> = {
  IDENTITY_CREATED: '#22c55e',
  MEMORY_SAVED: '#a78bfa',
  MEMORY_SOFT_DELETE: '#f59e0b',
  MEMORY_PERMANENT_DELETE: '#ef4444',
  CHAT_EXCHANGE: '#38bdf8',
  API_ERROR: '#ef4444',
  SETTING_CHANGED: '#fb923c',
  VAULT_RESTORED: '#22c55e',
  MODEL_CHANGE: '#fb923c',
};

export default function AuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useFocusEffect(useCallback(() => {
    setLogs(getAuditLogs());
  }, []));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AUDIT LOG</Text>
        <Text style={styles.headerSub}>Read-only · Blackbox</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Belum ada aktivitas tercatat</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = EVENT_COLORS[item.event_type] ?? '#666';
          return (
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                  <Text style={[styles.eventType, { color }]}>{item.event_type}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(item.timestamp).toLocaleString('id-ID', {
                      month: 'short', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={styles.detail}>{item.detail}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  headerSub: { color: '#333', fontSize: 11, marginTop: 2 },
  list: { padding: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#333', fontSize: 14 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  eventType: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  timestamp: { color: '#333', fontSize: 11 },
  detail: { color: '#555', fontSize: 12, lineHeight: 18 },
});
