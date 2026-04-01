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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

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

async function main() {
  // Resolve group chat link → numeric chat_id
  let adminChatId;
  try {
    const chatInfo = await bot.api.getChatByLink(ADMIN_CHAT_LINK);
    adminChatId = chatInfo.chat_id;
    console.log('Чат с админами:', adminChatId);
  } catch (err) {
    console.error('Не удалось получить чат по ссылке:', err.message);
    process.exit(1);
  }

  // Register middleware
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

  // Webhook endpoint
  app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    try {
      await bot.handleUpdate(req.body);
    } catch (err) {
      console.error('handleUpdate error:', err.message);
    }
  });

  app.listen(PORT, async () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    await registerWebhook();
  });
}

main();
