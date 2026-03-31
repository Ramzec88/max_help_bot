require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { PORT, BOT_TOKEN, WEBHOOK_URL, ADMIN_CHAT_ID } = require('./config');
const onUserMessage = require('./handlers/onUserMessage');
const onAdminCallback = require('./handlers/onAdminCallback');
const onAdminReply = require('./handlers/onAdminReply');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const update = req.body;

  try {
    if (update.update_type === 'message_callback') {
      await onAdminCallback(update);
      return;
    }

    if (update.update_type === 'message_created') {
      const chatId = String(update.message?.recipient?.chat_id);
      const senderId = String(update.message?.sender?.user_id);

      // Игнорировать собственные сообщения бота
      if (update.message?.sender?.is_bot) return;

      if (chatId === String(ADMIN_CHAT_ID)) {
        // Сообщение из чата с админами — обработать как свободный ответ
        await onAdminReply(update);
      } else {
        // Личный чат с пользователем
        await onUserMessage(update);
      }
    }
  } catch (err) {
    console.error('Webhook error:', err.message || err);
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
      {
        url: WEBHOOK_URL,
        update_types: ['message_created', 'message_callback'],
      },
      {
        headers: { Authorization: `Bearer ${BOT_TOKEN}` },
      }
    );
    console.log('Webhook зарегистрирован:', WEBHOOK_URL);
  } catch (err) {
    console.error('Ошибка регистрации webhook:', err.response?.data || err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  await registerWebhook();
});
