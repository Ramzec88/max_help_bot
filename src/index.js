require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bot = require('./bot');
const { PORT, BOT_TOKEN, WEBHOOK_URL, ADMIN_CHAT_ID } = require('./config');
const onUserMessage = require('./handlers/onUserMessage');
const onAdminCallback = require('./handlers/onAdminCallback');
const onAdminReply = require('./handlers/onAdminReply');

const app = express();
app.use(express.json());

let ready = false;

app.get('/health', (_req, res) => res.json({ status: 'ok', ready }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  if (!ready) return;
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
      { headers: { Authorization: BOT_TOKEN } }
    );
    console.log('Webhook зарегистрирован:', WEBHOOK_URL);
  } catch (err) {
    console.error('Ошибка регистрации webhook:', err.response?.data || err.message);
  }
}

async function init() {
  if (!ADMIN_CHAT_ID) {
    console.error('ADMIN_CHAT_ID не задан в переменных окружения.');
    return;
  }

  const adminChatId = Number(ADMIN_CHAT_ID);
  console.log('Чат с админами:', adminChatId);

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

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  init();
});
