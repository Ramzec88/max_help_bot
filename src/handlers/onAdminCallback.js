const store = require('../services/store');
const formatter = require('../services/formatter');

async function onAdminCallback(ctx, adminChatId) {
  const payload = ctx.callback?.payload;
  if (!payload) return;

  const adminId = String(ctx.callback.user.user_id);

  if (payload.startsWith('reply:')) {
    const [, userId, idxStr] = payload.split(':');
    const idx = parseInt(idxStr, 10);
    const dialog = store.getDialog(userId);

    if (!dialog) {
      await ctx.answerOnCallback({ notification: 'Диалог не найден.' });
      return;
    }
    if (dialog.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Ответ уже был отправлен.' });
      return;
    }

    const replyText = dialog.variants[idx];
    if (!replyText) return;

    // Блокируем сразу (защита от двойного нажатия)
    store.saveDialog(userId, { status: 'answered' });

    // Отправить ответ пользователю
    await ctx.api.sendMessageToChat(dialog.chatId, replyText);

    // Обновить карточку в чате с админами
    const updatedText = formatter.buildAnsweredMessage({
      userName: dialog.userName,
      text: dialog.text,
      replyText,
      label: dialog.label || '🟡',
    });

    if (dialog.adminMsgId) {
      await ctx.api.editMessage(dialog.adminMsgId, { text: updatedText, attachments: [] });
    }

    await ctx.answerOnCallback({ notification: '✅ Ответ отправлен!' });
  }

  if (payload.startsWith('custom:')) {
    const [, userId] = payload.split(':');
    const dialog = store.getDialog(userId);

    if (!dialog) {
      await ctx.answerOnCallback({ notification: 'Диалог не найден.' });
      return;
    }
    if (dialog.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Ответ уже был отправлен.' });
      return;
    }

    store.setAdminMode(adminId, { mode: 'awaiting_reply', targetUserId: userId });

    await ctx.api.sendMessageToChat(
      adminChatId,
      `✍️ Напишите ответ для пользователя **${dialog.userName}** следующим сообщением:`
    );

    await ctx.answerOnCallback({ notification: 'Напишите ответ в чат.' });
  }
}

module.exports = onAdminCallback;
