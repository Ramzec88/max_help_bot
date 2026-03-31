const bot = require('../bot');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { ADMIN_CHAT_ID } = require('../config');

async function onAdminReply(update) {
  const adminId = String(update.message.sender.user_id);
  const replyText = update.message.body.text;

  if (!replyText) return;

  const adminMode = store.getAdminMode(adminId);
  if (!adminMode || adminMode.mode !== 'awaiting_reply') return;

  const { targetUserId } = adminMode;
  const dialog = store.getDialog(targetUserId);

  if (!dialog) {
    store.clearAdminMode(adminId);
    return;
  }

  if (dialog.status === 'answered') {
    store.clearAdminMode(adminId);
    await bot.sendMessage(ADMIN_CHAT_ID, { text: '⚠️ Этот диалог уже закрыт.' });
    return;
  }

  // Пометить как отвеченный
  store.saveDialog(targetUserId, { status: 'answered' });
  store.clearAdminMode(adminId);

  // Отправить ответ пользователю
  await bot.sendMessage(dialog.chatId, { text: replyText });

  // Обновить карточку в чате с админами
  const updatedText = formatter.buildAnsweredMessage({
    userName: dialog.userName,
    text: dialog.text,
    replyText,
    label: dialog.label || '🟡',
  });

  if (dialog.adminMsgId) {
    await bot.editMessage(dialog.adminMsgId, {
      text: updatedText,
      attachments: [],
    });
  }

  await bot.sendMessage(ADMIN_CHAT_ID, { text: '✅ Ответ отправлен пользователю.' });
}

module.exports = onAdminReply;
