const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export interface ZScores {
  waz: number | null;
  haz: number | null;
  whz: number | null;
}

export async function calculateZScores(
  weightKg: number,
  heightCm: number | null,
  ageMonths: number,
  sex: 'male' | 'female'
): Promise<ZScores> {
  const heightPart = heightCm ? (', height ' + heightCm + ' cm') : '';
  const formatExample = heightCm
    ? '{"waz": number, "haz": number, "whz": number}'
    : '{"waz": number, "haz": null, "whz": null}';

  const prompt = 'Calculate WHO Z-scores for a ' + sex + ' child aged ' + ageMonths + ' months, weight ' + weightKg + ' kg' + heightPart + '. Return ONLY valid JSON: ' + formatExample + '. No explanation.';

  const result = await askGroq(prompt, 'You are a WHO growth standards calculator. Return only JSON.', 0);

  try {
    const clean = result.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { waz: null, haz: null, whz: null };
  }
}

export async function askGroq(
  userMessage: string,
  systemPrompt: string = 'You are a helpful maternal and child health assistant in Kenya.',
  temperature: number = 0.7
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_API_KEY,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Groq API error: ' + response.status);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}