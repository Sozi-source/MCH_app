// supabase/functions/zuri-meal/index.ts
// Meal plan AI assembly — proxies Groq, keeps API key server-side.
// Deploy:     npx supabase functions deploy zuri-meal
// Set secret: npx supabase secrets set GROQ_API_KEY=your_key_here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

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
      return new Response(
        JSON.stringify({ error: 'userMessage is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        max_tokens:  1000,
        temperature: typeof temperature === 'number' ? temperature : 0.3,
        messages: [
          {
            role:    'system',
            content: systemPrompt ?? 'You are a Kenya MCH clinical nutritionist. Return only valid JSON.',
          },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('[zuri-meal] Groq error:', err);
      return new Response(
        JSON.stringify({ error: 'AI service error', content: '' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data    = await groqRes.json();
    // Return as { content } — matches askGroqMeal() in useMealPlan.ts
    const content = data?.choices?.[0]?.message?.content ?? '';

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (e) {
    console.error('[zuri-meal] error:', e);
    return new Response(
      JSON.stringify({ error: 'Internal error', content: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});