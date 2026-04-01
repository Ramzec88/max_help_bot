require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bot = require('./bot');
const { PORT, BOT_TOKEN, WEBHOOK_URL, ADMIN_CHAT_LINK } = require('./config');
const onUserMessage = require('./handlers/onUserMessage');
const onAdminCallback = require('./handlers/onAdminCallback');
const onAdminReply = require('./handlers/onAdminReply');

const app = express();
app.use(express.json());

// adminChatId resolved after startup; webhook updates are queued until ready
let adminChatId = null;
let ready = false;

app.get('/health', (_req, res) => res.json({ status: 'ok', ready }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  if (!ready) return; // drop updates received before init completes
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error('handleUpdate error:', err.message);
  }
});

async function registerWebhook() {
  if (!WEBHOOK_URL) {
    console.warn('WEBHOOK_URL не задан — регистрация webhook пропущена');
    return;
  }
  try {
    await axios.post(
      'https://botapi.max.ru/subscriptions',
      { url: WEBHOOK_URL, update_types: ['message_created', 'message_callback'] },
      { headers: { Authorization: `Bearer ${BOT_TOKEN}` } }
    );
    console.log('Webhook зарегистрирован:', WEBHOOK_URL);
  } catch (err) {
    console.error('Ошибка регистрации webhook:', err.response?.data || err.message);
  }
}

async function init() {
  // Resolve admin group chat link → numeric chat_id
  // Accept full URL (https://max.ru/join/TOKEN) or just the token
  const linkToken = ADMIN_CHAT_LINK
    ? ADMIN_CHAT_LINK.replace(/^https?:\/\/[^/]+\/join\//, '').trim()
    : '';

  if (!linkToken) {
    console.error('ADMIN_CHAT_LINK не задан. Укажите ссылку-приглашение группы.');
    return;
  }

  let retries = 5;
  while (retries > 0) {
    try {
      const chatInfo = await bot.api.getChatByLink(linkToken);
      adminChatId = chatInfo.chat_id;
      console.log('Чат с админами:', adminChatId);
      break;
    } catch (err) {
      retries--;
      console.error(`Не удалось получить чат (осталось попыток: ${retries}):`, err.message);
      if (retries === 0) {
        console.error('Инициализация не удалась. Бот не будет обрабатывать сообщения.');
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Register middleware (after adminChatId is known)
  bot.on('message_callback', async (ctx) => {
    try {
      await onAdminCallback(ctx, adminChatId);
    } catch (err) {
      console.error('onAdminCallback error:', err.message);
    }
  });

  bot.on('message_created', async (ctx) => {
    try {
      if (ctx.user?.is_bot) return;
      if (ctx.chatId === adminChatId) {
        await onAdminReply(ctx, adminChatId);
      } else {
        await onUserMessage(ctx, adminChatId);
      }
    } catch (err) {
      console.error('onMessage error:', err.message);
    }
  });

  await registerWebhook();
  ready = true;
  console.log('Бот готов к работе');
}

// Start HTTP server immediately so Railway healthcheck passes,
// then run async init in the background
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  init();
});
