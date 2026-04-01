const store = require('../services/store');
const formatter = require('../services/formatter');
const { extractMediaAttachments } = require('../services/media');

async function onAdminReply(ctx, adminChatId) {
  const adminId = String(ctx.user.user_id);
  const replyText = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  // Игнорировать если нет ни текста ни медиа
  if (!replyText && mediaAttachments.length === 0) return;

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

  store.saveDialog(targetUserId, { status: 'answered' });
  store.clearAdminMode(adminId);

  // Отправить текст пользователю (если есть)
  if (replyText) {
    await ctx.api.sendMessageToChat(dialog.chatId, replyText);
  }

  // Переслать медиа пользователю (если есть)
  if (mediaAttachments.length > 0) {
    await ctx.api.sendMessageToChat(dialog.chatId, '', {
      attachments: mediaAttachments,
    });
  }

  // Обновить карточку в чате с админами
  const displayReply = replyText || '[медиафайл]';
  const updatedText = formatter.buildAnsweredMessage({
    userName: dialog.userName,
    text: dialog.text,
    replyText: displayReply,
    label: dialog.label || '🟡',
  });

  if (dialog.adminMsgId) {
    await ctx.api.editMessage(dialog.adminMsgId, { text: updatedText, attachments: [] });
  }

  await ctx.api.sendMessageToChat(adminChatId, '✅ Ответ отправлен пользователю.');
}

module.exports = onAdminReply;
