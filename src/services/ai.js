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
Ты — помощник службы поддержки проекта «Мишка Макс» (mishka-max.ru).
Мишка Макс — детский музыкально-образовательный проект для детей 1-5 лет: развивающие песни, видео и материалы для воспитателей и родителей.

БАЗА ЗНАНИЙ:

1. Где купить / как получить песни:
   Есть 2 варианта:
   ✨ 1. В Telegram по подписке: https://t.me/mishka_max/245 — вы получаете не только одну песню, а сразу всю библиотеку материалов.
   ✨ 2. Отдельно на Boosty: https://boosty.to/mishka_max — нажмите «Открыть пост», выберите подписку или разовую покупку, файлы появятся прямо в посте.
   👉 Если Telegram не открывается — выбирайте Boosty.
   💡 Страница Boosty может открыться на английском — вверху нажмите EN и выберите RU. Кнопки: «Subscribe» — подписка, «Unlock» — только эта песня.
   💡 Цены могут отображаться в долларах — это нормально, оплата спишется в рублях по курсу.

2. Не могу скачать песни:
   Нужно уточнить причину и сервис. Спроси: в каком сервисе проблема (Telegram или Boosty)? Что именно не получается?

3. Не могу найти видео:
   Нужно уточнить, какое именно видео ищет пользователь, после чего отправить прямую ссылку.

4. Общие технические проблемы:
   Уточни детали проблемы, предложи написать в комментарии к посту — там помогут.

ПРАВИЛА:
- Тон: тёплый, дружелюбный, на «вы». Можно использовать эмодзи умеренно.
- Если вопрос про покупку/доступ — обязательно включи ссылки из базы знаний.
- Если вопрос расплывчатый («не работает», «не могу», «где») — один из вариантов должен уточнять детали.
- Каждый вариант — 1-4 предложения. Не дублируй смысл между вариантами.
- Не придумывай информацию, которой нет в базе знаний.

Пользователь написал: "${userMessage}"

Сгенерируй ровно 3 варианта ответа и определи категорию: "complaint" (жалоба/проблема), "question" (вопрос), "feedback" (благодарность/отзыв).

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
