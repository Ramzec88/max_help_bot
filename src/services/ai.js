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

const TOPIC_NAMES = {
  buy: 'Где купить сценарий',
  broken: 'Не работает покупка',
  compose: 'Хочу попросить составить',
  compose_idea: 'Идея / авторский запрос',
  other: 'Другой вопрос',
};

const PLATFORM_NAMES = {
  boosty: 'Boosty',
  lava: 'Lava Top',
  unknown: 'неизвестно',
};

const PROJECT_INTROS = {
  mishka_max:
    'проекта «Мишка Макс» (mishka-max.ru).\n' +
    'Мишка Макс — детский музыкально-образовательный проект для детей 1-5 лет: развивающие песни, видео, сценарии и материалы для воспитателей и родителей.',
  kolyanchik:
    'проекта «Колянчик».',
};

const PROJECT_KNOWLEDGE_BASE = {
  mishka_max: `1. Где купить / как получить материалы:
   Есть 2 варианта:
   ✨ 1. В Telegram по подписке: https://t.me/mishka_max/245 — вы получаете не только одну песню, а сразу всю библиотеку материалов
   ✨ 2. Отдельно на Boosty: https://boosty.to/mishka_max — нажмите «Открыть пост», выберите подписку или разовую покупку, файлы появятся прямо в посте
   👉 Если Telegram не открывается — выбирайте Boosty
   💡 Страница Boosty может открыться на английском — вверху нажмите EN и выберите RU
   💡 Цены могут отображаться в долларах — оплата спишется в рублях по курсу

2. Lava Top — проблемы с доступом:
   Письмо со ссылкой на файл могло попасть в папку «Спам». Попросите проверить папку Спам.
   Если письмо не находится — нужно обратиться в поддержку Lava Top.

3. Boosty — проблемы с доступом:
   Войти в личный кабинет Boosty → «Мои покупки» — файл должен быть там.
   Если файл есть но не открывается — попросить описать что происходит, прислать скриншот.

4. Не могу скачать / открыть:
   Уточнить сервис и конкретную проблему. Попросить скриншот.

5. Не могу найти видео:
   Уточнить какое именно видео, после чего отправить прямую ссылку.`,
  kolyanchik:
    'Специфической базы знаний по проекту «Колянчик» пока нет. ' +
    'Поблагодари пользователя за обращение, объясни, что уточнишь детали у команды и ответишь отдельно. ' +
    'НЕ придумывай ссылки, цены, сроки или любые другие факты о проекте — их пока нет в базе знаний.',
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
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  );
  return response.data.choices[0].message.content;
}

async function generateVariants(userMessage, { topic = 'other', platform = 'unknown', project = 'mishka_max' } = {}) {
  const topicLabel = TOPIC_NAMES[topic] || topic;
  const platformLabel = platform !== 'unknown' ? PLATFORM_NAMES[platform] || platform : '';
  const projectIntro = PROJECT_INTROS[project] || PROJECT_INTROS.mishka_max;
  const knowledgeBase = PROJECT_KNOWLEDGE_BASE[project] || PROJECT_KNOWLEDGE_BASE.mishka_max;

  const prompt = `
Ты — помощник службы поддержки ${projectIntro}

БАЗА ЗНАНИЙ:

${knowledgeBase}

ТЕМА ОБРАЩЕНИЯ: ${topicLabel}
${platformLabel ? `ПЛАТФОРМА: ${platformLabel}` : ''}

ПРАВИЛА:
- Тон: тёплый, дружелюбный, на «вы». Эмодзи — умеренно.
- Если вопрос про покупку — каждый вариант должен содержать ПОЛНЫЙ ответ с обеими ссылками. Не дели одну инструкцию на несколько вариантов.
- Варианты отличаются стилем подачи (короче/подробнее/другим акцентом), но каждый самодостаточен.
- НИКОГДА не ставь знаки препинания сразу после URL — пиши ссылку отдельно или переноси на новую строку.
- Если вопрос расплывчатый — один из вариантов должен уточнять детали.
- Не придумывай информацию, которой нет в базе знаний.

Пользователь написал: "${userMessage}"

Сгенерируй ровно 3 варианта ответа.
Определи категорию: "complaint" (жалоба), "question" (вопрос), "feedback" (благодарность).

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
    return { variants: FALLBACK_VARIANTS, label: '🟡' };
  }
}

module.exports = { generateVariants };
