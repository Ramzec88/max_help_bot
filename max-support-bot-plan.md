# План разработки бота поддержки для MAX
## Проект: Мишка Макс — Support Bot

---

## Обзор

Бот принимает сообщения от пользователей в MAX, пересылает их в групповой чат с администраторами с AI-вариантами ответа, и отправляет ответ пользователю одним нажатием кнопки.

```
Пользователь → Бот → [AI-анализ] → Чат с админами
                                          ↓
                              Кнопка «Вариант 1/2/3» или «Свой ответ»
                                          ↓
                              Бот → Ответ пользователю
```

---

## Стек технологий

| Компонент         | Технология                          |
|-------------------|-------------------------------------|
| Runtime           | Node.js 20+                         |
| Хостинг           | Railway                             |
| MAX API           | `@maxhub/max-bot-api`               |
| Webhook-сервер    | Express.js                          |
| AI-варианты       | OpenRouter (claude-haiku или gemini) |
| База данных       | Supabase (хранение диалогов)        |
| Конфиг            | `.env` через Railway Variables      |

---

## Структура проекта

```
max-support-bot/
├── src/
│   ├── index.js              # Точка входа, Express + Webhook
│   ├── bot.js                # Инициализация MAX Bot API
│   ├── handlers/
│   │   ├── onUserMessage.js  # Входящее от пользователя
│   │   ├── onAdminCallback.js # Нажатие кнопки от админа
│   │   └── onAdminReply.js   # «Свой ответ» от админа
│   ├── services/
│   │   ├── ai.js             # Генерация вариантов ответа через LLM
│   │   ├── db.js             # Supabase: сохранение/чтение диалогов
│   │   └── formatter.js      # Форматирование сообщений (Markdown)
│   └── config.js             # Константы, ID чата с админами
├── .env.example
├── package.json
└── railway.toml
```

---

## Этапы разработки

### Этап 1 — Подготовка окружения
**Время: ~1 час**

- [ ] Создать бота на [business.max.ru](https://business.max.ru/self) → раздел «Чат-боты»
- [ ] Получить токен (`BOT_TOKEN`)
- [ ] Создать групповой чат с двумя администраторами, добавить туда бота
- [ ] Записать `ADMIN_CHAT_ID` (получить через `GET /chats`)
- [ ] Инициализировать Node.js проект, установить зависимости:
  ```bash
  npm init -y
  npm install @maxhub/max-bot-api express dotenv axios
  ```
- [ ] Создать проект на Railway, добавить переменные окружения

**Переменные окружения:**
```env
BOT_TOKEN=your_max_bot_token
ADMIN_CHAT_ID=id_группового_чата_с_админами
OPENROUTER_API_KEY=your_openrouter_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
WEBHOOK_URL=https://your-app.railway.app/webhook
```

---

### Этап 2 — Приём сообщений и пересылка
**Время: ~2-3 часа**

**Цель:** пользователь пишет боту → бот пересылает в чат с админами

**2.1 Настройка Webhook**

```js
// src/index.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const update = req.body;
  await handleUpdate(update);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000);
```

Регистрация вебхука:
```
POST /subscriptions
{ "url": "https://your-app.railway.app/webhook", "update_types": ["message_created", "message_callback"] }
```

**2.2 Обработка входящего сообщения от пользователя**

```js
// src/handlers/onUserMessage.js
async function onUserMessage(update) {
  const { user, message } = update;
  const userId = user.user_id;
  const chatId = message.recipient.chat_id; // личный чат с пользователем
  const text = message.body.text;

  // 1. Сохранить в Supabase: userId → chatId, история сообщений
  await db.saveMessage({ userId, chatId, text, direction: 'in' });

  // 2. Отправить подтверждение пользователю
  await bot.sendMessage(chatId, {
    text: '⏳ Ваш вопрос принят! Скоро ответим.',
    format: 'markdown'
  });

  // 3. Сгенерировать AI-варианты ответа
  const variants = await ai.generateVariants(text);

  // 4. Переслать в чат с админами
  await forwardToAdmins({ userId, chatId, userName: user.name, text, variants });
}
```

**2.3 Форвард в чат с админами с кнопками**

Сообщение в чат к админам:
```
👤 Пользователь: Иван Петров
📝 Вопрос: «Как получить доступ к материалам для воспитателей?»

🤖 Варианты ответа:
```

С inline-кнопками:
- `[Вариант 1]` → callback с payload `reply:userId:v1`
- `[Вариант 2]` → callback с payload `reply:userId:v2`
- `[Вариант 3]` → callback с payload `reply:userId:v3`
- `[✍️ Написать свой]` → callback с payload `custom:userId`

---

### Этап 3 — AI-генерация вариантов
**Время: ~2 часа**

```js
// src/services/ai.js
async function generateVariants(userMessage) {
  const prompt = `
Ты — помощник бота Мишки Макса, детского образовательного проекта для детей 1-5 лет.
Пользователь написал: "${userMessage}"

Сгенерируй ровно 3 варианта ответа. Тон: дружелюбный, тёплый, профессиональный.
Каждый вариант — 1-3 предложения. Не дублируй смысл.

Ответь строго в JSON:
{"variants": ["Вариант 1...", "Вариант 2...", "Вариант 3..."]}
`;

  // вызов OpenRouter/Gemini
  const response = await callLLM(prompt);
  return JSON.parse(response).variants;
}
```

**Дополнительно — классификация запроса:**
```js
// Метка приоритета в сообщении к админам
// 🔴 жалоба/проблема  🟡 вопрос  🟢 благодарность/отзыв
```

---

### Этап 4 — Ответ пользователю
**Время: ~2-3 часа**

**4.1 Нажатие кнопки с вариантом**

```js
// src/handlers/onAdminCallback.js
async function onAdminCallback(update) {
  const payload = update.callback.payload; // "reply:123456:v1"
  const [action, userId, variant] = payload.split(':');

  if (action === 'reply') {
    const dialog = await db.getDialog(userId);
    const text = dialog.variants[variant]; // v1/v2/v3

    // Отправить пользователю
    await bot.sendMessage(dialog.chatId, { text });

    // Обновить кнопки в чате с админами — показать «✅ Ответ отправлен»
    await bot.editMessage(update.callback.message.body.mid, {
      text: `[текст остаётся] \n\n✅ Ответ отправлен: «${text}»`,
      attachments: [] // убираем кнопки
    });
  }

  if (action === 'custom') {
    // Включить режим ожидания свободного ответа от этого админа
    await db.setAdminMode(update.callback.from.user_id, { mode: 'awaiting_reply', targetUserId: userId });
    await bot.sendMessage(ADMIN_CHAT_ID, {
      text: `✍️ Напишите ответ для пользователя ${userId} следующим сообщением:`
    });
  }
}
```

**4.2 Свободный ответ от админа**

```js
// src/handlers/onAdminReply.js
async function onAdminReply(update) {
  const adminId = update.message.sender.user_id;
  const adminMode = await db.getAdminMode(adminId);

  if (adminMode?.mode === 'awaiting_reply') {
    const replyText = update.message.body.text;
    const targetDialog = await db.getDialog(adminMode.targetUserId);

    await bot.sendMessage(targetDialog.chatId, { text: replyText });
    await db.clearAdminMode(adminId);
    await bot.sendMessage(ADMIN_CHAT_ID, { text: '✅ Ответ отправлен пользователю.' });
  }
}
```

---

### Этап 5 — База данных (Supabase)
**Время: ~1-2 часа**

**Таблица `support_dialogs`:**
```sql
create table support_dialogs (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  chat_id bigint not null,
  user_name text,
  last_question text,
  ai_variants jsonb,           -- ["вариант 1", "вариант 2", "вариант 3"]
  admin_message_id bigint,     -- id сообщения в чате с админами
  status text default 'open',  -- open / answered
  created_at timestamptz default now(),
  answered_at timestamptz
);
```

**Таблица `admin_modes`:**
```sql
create table admin_modes (
  admin_id bigint primary key,
  mode text,                   -- 'awaiting_reply'
  target_user_id bigint,
  updated_at timestamptz default now()
);
```

---

### Этап 6 — UX-доработки (опционально)
**Время: ~2-3 часа**

- [ ] **Команда `/pause 2h`** — бот отвечает пользователям «Отвечаем в течение 2 часов» в нерабочее время
- [ ] **История диалога** — если пользователь пишет второй раз, в карточке для админов видна история
- [ ] **Счётчик обращений** — «🔁 2-е обращение от этого пользователя»
- [ ] **Статистика** — раз в день бот присылает в чат с админами: количество обращений, среднее время ответа

---

## Схема данных в чате с админами

Каждое сообщение от пользователя выглядит так:

```
🟡 Новый вопрос

👤 Анна Смирнова
🕐 14:32 | 1-е обращение

💬 «Как подписаться на канал для воспитателей?»

──────────────────────────
🤖 Варианты ответа:

[Вариант 1]  [Вариант 2]  [Вариант 3]  [✍️ Свой]
```

После ответа:

```
🟡 Новый вопрос

👤 Анна Смирнова
💬 «Как подписаться на канал для воспитателей?»

✅ Ответ отправлен в 14:35
📤 «Привет! Подписаться можно по ссылке mishka-max.ru — раздел для воспитателей 🐻»
```

---

## Приоритет разработки

| # | Задача                                  | Важно | Срок |
|---|----------------------------------------|-------|------|
| 1 | Настройка окружения + Railway + Webhook | 🔴    | День 1 |
| 2 | Приём сообщений + форвард к админам     | 🔴    | День 1 |
| 3 | AI-варианты ответа                      | 🔴    | День 2 |
| 4 | Кнопки + ответ пользователю             | 🔴    | День 2 |
| 5 | Supabase — хранение диалогов            | 🟡    | День 3 |
| 6 | Режим «свой ответ» от админа            | 🟡    | День 3 |
| 7 | UX-доработки (пауза, статистика)        | 🟢    | День 4-5 |

---

## Возможные проблемы и решения

| Проблема | Решение |
|----------|---------|
| Два админа нажимают одновременно | Блокировка: после первого нажатия кнопки убираются |
| Пользователь пишет пока ждёт ответа | Очередь: каждое новое сообщение создаёт новую карточку |
| LLM не возвращает валидный JSON | try/catch + fallback на стандартные варианты |
| Webhook не доступен | Railway Health Check + авто-перезапуск |

---

## Следующие шаги

1. Создать бота в MAX и получить токен
2. Инициализировать репозиторий и задеплоить пустой Express на Railway
3. Настроить Webhook
4. Начать с Этапа 2 (приём + форвард) — без AI, просто текст
5. Добавить AI-варианты как слой поверх готового форварда
