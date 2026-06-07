// supabase/functions/zuri-zscore/index.ts
// Replaces direct Groq API call in src/lib/zscore.ts
// Deploy: npx supabase functions deploy zuri-zscore
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
    const { weightKg, heightCm, ageMonths, sex } = await req.json();

    if (!weightKg || !ageMonths || !sex) {
      return new Response(JSON.stringify({ error: 'weightKg, ageMonths and sex are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const heightPart  = heightCm ? `, height ${heightCm} cm` : '';
    const formatExample = heightCm
      ? '{"waz": number, "haz": number, "whz": number}'
      : '{"waz": number, "haz": null, "whz": null}';

    const prompt = `Calculate WHO Z-scores for a ${sex} child aged ${ageMonths} months, weight ${weightKg} kg${heightPart}. Return ONLY valid JSON: ${formatExample}. No explanation.`;

    const groqRes = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body:    JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  100,
        temperature: 0,
        messages: [
          { role: 'system', content: 'You are a WHO growth standards calculator. Return only JSON.' },
          { role: 'user',   content: prompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      return new Response(JSON.stringify({ waz: null, haz: null, whz: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data  = await groqRes.json();
    const raw   = data?.choices?.[0]?.message?.content ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      const zscores = JSON.parse(clean);
      return new Response(JSON.stringify(zscores), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ waz: null, haz: null, whz: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (e) {
    console.error('zuri-zscore error:', e);
    return new Response(JSON.stringify({ waz: null, haz: null, whz: null }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
