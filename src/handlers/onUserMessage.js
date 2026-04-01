const { Keyboard } = require('@maxhub/max-bot-api');
const ai = require('../services/ai');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { extractMediaAttachments, describeAttachments } = require('../services/media');

async function onUserMessage(ctx, adminChatId) {
  const userId = String(ctx.user.user_id);
  const chatId = String(ctx.chatId);
  const userName = ctx.user.name || `Пользователь ${userId}`;
  const username = ctx.user.username || null;
  const text = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  // Игнорировать пустые сообщения без текста и медиа
  if (!text && mediaAttachments.length === 0) return;

  // Подтверждение пользователю
  await ctx.reply('⏳ Ваш вопрос принят! Скоро ответим.');

  // Для AI используем текст, либо описание медиа если текста нет
  const questionText = text || describeAttachments(mediaAttachments);

  // AI-варианты
  const { variants, label } = await ai.generateVariants(questionText);

  // Сохранить диалог (text хранит оригинальный текст или описание медиа)
  store.saveDialog(userId, { chatId, userId, userName, username, text: questionText, variants, label, status: 'open' });

  // Если есть медиа — переслать в чат с админами отдельным сообщением перед карточкой
  if (mediaAttachments.length > 0) {
    const caption = text ? `👤 ${userName}: ${text}` : `👤 ${userName}`;
    await ctx.api.sendMessageToChat(adminChatId, caption, {
      attachments: mediaAttachments,
    });
  }

  // Кнопки для карточки
  const buttons = [
    variants.map((_, i) => Keyboard.button.callback(`Вариант ${i + 1}`, `reply:${userId}:${i}`)),
    [Keyboard.button.callback('✍️ Свой ответ', `custom:${userId}`)],
  ];

  const adminText = formatter.buildAdminMessage({ userName, username, userId, text: questionText, variants, label });

  // Отправить карточку с кнопками в чат с админами
  const sentMsg = await ctx.api.sendMessageToChat(adminChatId, adminText, {
    attachments: [Keyboard.inlineKeyboard(buttons)],
    format: 'markdown',
  });

  if (sentMsg?.body?.mid) {
    store.saveDialog(userId, { adminMsgId: sentMsg.body.mid });
  }
}

module.exports = onUserMessage;
