import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '@/lib/theme';
import { useState, useRef } from 'react';
import { useChildStore } from '@/store/childStore';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

export default function ChatScreen() {
  const { children, selectedChildId } = useChildStore();
  const activeChild = children.find(c => c.id === selectedChildId);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: `Hello! I am your maternal and child health assistant. ${activeChild ? `I can see you are tracking ${activeChild.full_name}.` : ''} How can I help you today?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: `You are a helpful maternal and child health assistant for Kenyan mothers. ${activeChild ? `The user is tracking a child named ${activeChild.full_name}, born ${activeChild.date_of_birth}, sex: ${activeChild.sex}.` : ''} Give practical, evidence-based advice.`,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const reply = data?.content?.[0]?.text ?? 'Sorry, I could not get a response.';
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="chatbubble" size={22} color={COLORS.onPrimary} />
        <Text style={styles.headerTitle}>AI Health Assistant</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} onContentSizeChange={() => scrollRef.current?.scrollToEnd()}>
          {messages.map(msg => (
            <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, msg.role === 'user' ? styles.userText : styles.aiText]}>{msg.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={styles.aiBubble}>
              <ActivityIndicator color={COLORS.primary} size="small" />
            </View>
          )}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your child's health..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={loading || !input.trim()}>
            <Ionicons name="send" size={20} color={COLORS.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  header:      { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onPrimary },
  messages:    { padding: 16, gap: 12, paddingBottom: 24 },
  bubble:      { maxWidth: '80%', padding: 12, borderRadius: RADIUS.lg },
  userBubble:  { backgroundColor: COLORS.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiBubble:    { backgroundColor: COLORS.white, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bubbleText:  { fontSize: 14, lineHeight: 20 },
  userText:    { color: COLORS.onPrimary },
  aiText:      { color: COLORS.textPrimary },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  input:       { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, fontSize: 14, color: COLORS.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border },
  sendBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
