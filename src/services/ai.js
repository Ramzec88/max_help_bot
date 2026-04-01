const axios = require('axios');
const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = require('../config');

const FALLBACK_VARIANTS = [
  'Здравствуйте! Спасибо за ваш вопрос. Мы разберёмся и ответим вам в ближайшее время.',
  'Добрый день! Ваш вопрос важен для нас. Наш специалист свяжется с вами совсем скоро.',
  'Привет! Мы получили ваше обращение и уже работаем над ответом. Спасибо за терпение!',
];

const LABELS = {
  complaint: '🔴',
  question: '🟡',
  feedback: '🟢',
};

async function callLLM(prompt) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return response.data.choices[0].message.content;
}

async function generateVariants(userMessage) {
  const prompt = `
Ты — помощник бота Мишки Макса, детского образовательного проекта для детей 1-5 лет.
Пользователь написал: "${userMessage}"

Сгенерируй ровно 3 варианта ответа. Тон: дружелюбный, тёплый, профессиональный.
Каждый вариант — 1-3 предложения. Не дублируй смысл.

Также определи категорию сообщения: "complaint" (жалоба/проблема), "question" (вопрос), "feedback" (благодарность/отзыв).

Ответь строго в JSON без markdown:
{"category": "question", "variants": ["Вариант 1...", "Вариант 2...", "Вариант 3..."]}
`;

  try {
    const raw = await callLLM(prompt);
    const parsed = JSON.parse(raw);
    return {
      variants: parsed.variants,
      label: LABELS[parsed.category] || '🟡',
    };
  } catch {
    return {
      variants: FALLBACK_VARIANTS,
      label: '🟡',
    };
  }
}

module.exports = { generateVariants };
