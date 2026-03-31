const bot = require('../bot');
const ai = require('../services/ai');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { ADMIN_CHAT_ID } = require('../config');

async function onUserMessage(update) {
  const userId = String(update.sender.user_id);
  const chatId = String(update.message.recipient.chat_id);
  const userName = update.sender.name || `Пользователь ${userId}`;
  const text = update.message.body.text;

  if (!text) return;

  // Подтверждение пользователю
  await bot.sendMessage(chatId, {
    text: '⏳ Ваш вопрос принят! Скоро ответим.',
  });

  // AI-варианты
  const { variants, label } = await ai.generateVariants(text);

  // Сохранить диалог
  store.saveDialog(userId, { chatId, userName, text, variants, label, status: 'open' });

  // Отправить карточку в чат с админами
  const { text: adminText, buttons } = formatter.buildAdminMessage({
    userId,
    userName,
    text,
    variants,
    label,
  });

  const sentMsg = await bot.sendMessage(ADMIN_CHAT_ID, {
    text: adminText,
    attachments: [
      {
        type: 'inline_keyboard',
        payload: { buttons },
      },
    ],
  });

  // Сохранить ID сообщения в чате с админами для последующего редактирования
  if (sentMsg && sentMsg.message && sentMsg.message.body) {
    store.saveDialog(userId, { adminMsgId: sentMsg.message.body.mid });
  }
}

module.exports = onUserMessage;
