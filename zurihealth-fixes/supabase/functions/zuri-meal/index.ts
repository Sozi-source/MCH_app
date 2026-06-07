// supabase/functions/zuri-meal/index.ts
// Replaces the direct askGroq() call for meal suggestions in nutrition.tsx
// Deploy: npx supabase functions deploy zuri-meal
// Set secret: npx supabase secrets set GROQ_API_KEY=your_key_here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userMessage, systemPrompt, temperature } = await req.json();

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'userMessage is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body:    JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  1000,
        temperature: temperature ?? 0.7,
        messages: [
          { role: 'system', content: systemPrompt ?? 'You are a helpful maternal and child health assistant in Kenya.' },
          { role: 'user',   content: userMessage },
        ],
      }),
    });

    if (!groqRes.ok) {
      return new Response(JSON.stringify({ error: 'AI service error', reply: '' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data  = await groqRes.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('zuri-meal error:', e);
    return new Response(JSON.stringify({ error: 'Internal error', reply: '' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
