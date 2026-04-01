const { Keyboard } = require('@maxhub/max-bot-api');
const ai = require('../services/ai');
const store = require('../services/store');
const formatter = require('../services/formatter');

async function onUserMessage(ctx, adminChatId) {
  const userId = String(ctx.user.user_id);
  const chatId = String(ctx.chatId);
  const userName = ctx.user.name || `Пользователь ${userId}`;
  const text = ctx.message?.body?.text;

  if (!text) return;

  // Подтверждение пользователю
  await ctx.reply('⏳ Ваш вопрос принят! Скоро ответим.');

  // AI-варианты
  const { variants, label } = await ai.generateVariants(text);

  // Сохранить диалог
  store.saveDialog(userId, { chatId, userName, text, variants, label, status: 'open' });

  // Кнопки для карточки
  const buttons = [
    variants.map((_, i) => Keyboard.button.callback(`Вариант ${i + 1}`, `reply:${userId}:${i}`)),
    [Keyboard.button.callback('✍️ Свой ответ', `custom:${userId}`)],
  ];

  const adminText = formatter.buildAdminMessage({ userId, userName, text, variants, label });

  // Отправить карточку в чат с админами
  const sentMsg = await ctx.api.sendMessageToChat(adminChatId, adminText, {
    attachments: [Keyboard.inlineKeyboard(buttons)],
  });

  // Сохранить ID сообщения для последующего редактирования
  if (sentMsg?.body?.mid) {
    store.saveDialog(userId, { adminMsgId: sentMsg.body.mid });
  }
}

module.exports = onUserMessage;
