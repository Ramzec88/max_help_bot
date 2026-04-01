const store = require('../services/store');
const formatter = require('../services/formatter');

async function onAdminReply(ctx, adminChatId) {
  const adminId = String(ctx.user.user_id);
  const replyText = ctx.message?.body?.text;

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
    await ctx.api.sendMessageToChat(adminChatId, '⚠️ Этот диалог уже закрыт.');
    return;
  }

  // Пометить как отвеченный
  store.saveDialog(targetUserId, { status: 'answered' });
  store.clearAdminMode(adminId);

  // Отправить ответ пользователю
  await ctx.api.sendMessageToChat(dialog.chatId, replyText);

  // Обновить карточку
  const updatedText = formatter.buildAnsweredMessage({
    userName: dialog.userName,
    text: dialog.text,
    replyText,
    label: dialog.label || '🟡',
  });

  if (dialog.adminMsgId) {
    await ctx.api.editMessage(dialog.adminMsgId, { text: updatedText, attachments: [] });
  }

  await ctx.api.sendMessageToChat(adminChatId, '✅ Ответ отправлен пользователю.');
}

module.exports = onAdminReply;
