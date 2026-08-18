import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator, SafeAreaView,
  Image, Alert, Clipboard,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { callAI, evaluateMemoryWorthiness } from '@/api/provider';
import { assembleContext, Message } from '@/context/assembler';
import { saveMemory, addAuditLog } from '@/db/vault';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  imageBase64?: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const pickImage = useCallback(async () => {
    launchImageLibrary(
  { mediaType: 'photo', quality: 0.7, includeBase64: true },
  (response) => {
    if (!response.didCancel && response.assets?.[0]) {
      setSelectedImage({
        uri: response.assets[0].uri ?? '',
        base64: response.assets[0].base64 ?? '',
       });
      }
     }
    );
  }, []);

  const clearImage = useCallback(() => setSelectedImage(null), []);

  const send = useCallback(async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userText = input.trim() || '(gambar dikirim)';
    const imgData = selectedImage;
    setInput('');
    setSelectedImage(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      imageUri: imgData?.uri,
      imageBase64: imgData?.base64,
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history: Message[] = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));
      const context = assembleContext(userText, history, imgData?.base64);
      const aiText = await callAI(context, userText);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiText,
      };

      setMessages(prev => [...prev, aiMsg]);
      addAuditLog('CHAT_EXCHANGE', `User: ${userText.slice(0, 50)}`);

      evaluateMemoryWorthiness(userText, aiText).then(result => {
        if (result.shouldSave && result.content) {
          saveMemory(result.content, result.tags, result.importance);
        }
      });
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error. Cek Settings → Providers.',
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, messages, selectedImage]);

  const handleLongPress = (content: string) => {
    Clipboard.setString(content);
    Alert.alert('✓ Disalin', 'Teks berhasil disalin.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MiRA</Text>
        <Text style={styles.headerSub}>Pantulanmu</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>✦</Text>
            <Text style={styles.emptySubtext}>MiRA siap mendengarkan</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => handleLongPress(item.content)}
            activeOpacity={0.8}
          >
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.imageUri && (
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
              <Text style={[styles.bubbleText, item.role === 'user' ? styles.userText : styles.aiText]}>
                {item.content}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {loading && (
        <View style={styles.typingContainer}>
          <ActivityIndicator size="small" color="#a78bfa" />
          <Text style={styles.typingText}>MiRA sedang berpikir...</Text>
        </View>
      )}

      {/* Image preview */}
      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity style={styles.removeImageBtn} onPress={clearImage}>
            <Text style={styles.removeImageText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputRow}>
          {/* Attach image button */}
          <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Katakan sesuatu..."
            placeholderTextColor="#555"
            multiline
            maxLength={2000}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, ((!input.trim() && !selectedImage) || loading) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={(!input.trim() && !selectedImage) || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#a78bfa', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  headerSub: { color: '#444', fontSize: 12, marginTop: 2 },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#a78bfa', fontSize: 40, marginBottom: 12 },
  emptySubtext: { color: '#333', fontSize: 14 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 4 },
  userBubble: { backgroundColor: '#1e1b4b', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#111', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#222' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#e0d9ff' },
  aiText: { color: '#ccc' },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 8 },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  typingText: { color: '#555', fontSize: 13 },
  imagePreviewContainer: { marginHorizontal: 12, marginBottom: 4, position: 'relative', alignSelf: 'flex-start' },
  imagePreview: { width: 80, height: 80, borderRadius: 8 },
  removeImageBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  removeImageText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 6 },
  attachBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  attachIcon: { fontSize: 20 },
  input: { flex: 1, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 120, borderWidth: 1, borderColor: '#222' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#a78bfa', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#2a2a2a' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
