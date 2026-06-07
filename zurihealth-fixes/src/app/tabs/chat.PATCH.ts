// PATCH FILE: src/app/(tabs)/chat.tsx
// CHANGE: Replace the direct Groq API call in sendMessage() with a Supabase Edge Function call.
// Only the sendMessage function and the top constants change — everything else stays identical.
//
// ─── STEP 1: Remove these lines from the top of chat.tsx ───────────────────
// const GROQ_API_URL = ...
// const GROQ_API_KEY = ...
// const GROQ_MODEL   = ...
//
// ─── STEP 2: Add this import at the top of chat.tsx ────────────────────────
// import { supabase } from '@/lib/supabase';
// (supabase is likely already imported — check before adding)
//
// ─── STEP 3: Replace the sendMessage function with this ────────────────────

const sendMessage = async () => {
  const msg = input.trim();
  if (!msg || loading) return;

  const id      = Date.now().toString();
  const userMsg: Message = { id, role: 'user', content: msg, timestamp: new Date() };
  const updated = [...messages, userMsg];

  setMessages(updated);
  setNewMsgIds(prev => new Set([...prev, id]));
  setInput('');
  setLoading(true);
  scrollToBottom();
  Keyboard.dismiss();

  try {
    const apiMessages = updated
      .filter(m => m.id !== '0')
      .map(m => ({ role: m.role, content: m.content }));

    const ctx = buildChildContext();

    // ✅ FIXED: Call Edge Function instead of Groq directly.
    // API key stays on the server — never exposed in the bundle.
    const { data, error } = await supabase.functions.invoke('zuri-chat', {
      body: {
        messages:     apiMessages,
        systemPrompt: buildSystemPrompt(ctx),
      },
    });

    const reply = (!error && data?.reply)
      ? data.reply
      : "Sorry, I could not get a response. Please try again.";

    const replyId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: replyId, role: 'assistant', content: reply, timestamp: new Date() }]);
    setNewMsgIds(prev => new Set([...prev, replyId]));
    scrollToBottom();

  } catch {
    const errId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id:        errId,
      role:      'assistant',
      content:   "I'm having trouble connecting. Please check your internet and try again.",
      timestamp: new Date(),
    }]);
    setNewMsgIds(prev => new Set([...prev, errId]));
  } finally {
    setLoading(false);
  }
};
