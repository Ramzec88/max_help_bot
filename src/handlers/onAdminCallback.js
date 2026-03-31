const bot = require('../bot');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { ADMIN_CHAT_ID } = require('../config');

async function onAdminCallback(update) {
  const payload = update.callback.payload;
  const adminId = String(update.callback.user.user_id);

  if (!payload) return;

  if (payload.startsWith('reply:')) {
    const [, userId, idxStr] = payload.split(':');
    const idx = parseInt(idxStr, 10);
    const dialog = store.getDialog(userId);

    if (!dialog) {
      await bot.answerCallback(update.callback.callback_id, { notification: 'Диалог не найден.' });
      return;
    }

    if (dialog.status === 'answered') {
      await bot.answerCallback(update.callback.callback_id, { notification: 'Ответ уже был отправлен.' });
      return;
    }

    const replyText = dialog.variants[idx];
    if (!replyText) return;

    // Пометить как отвеченный сразу (защита от двойного нажатия)
    store.saveDialog(userId, { status: 'answered' });

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

    await bot.answerCallback(update.callback.callback_id, { notification: '✅ Ответ отправлен!' });
  }

  if (payload.startsWith('custom:')) {
    const [, userId] = payload.split(':');
    const dialog = store.getDialog(userId);

    if (!dialog) {
      await bot.answerCallback(update.callback.callback_id, { notification: 'Диалог не найден.' });
      return;
    }

    if (dialog.status === 'answered') {
      await bot.answerCallback(update.callback.callback_id, { notification: 'Ответ уже был отправлен.' });
      return;
    }

    store.setAdminMode(adminId, { mode: 'awaiting_reply', targetUserId: userId });

    await bot.sendMessage(ADMIN_CHAT_ID, {
      text: `✍️ @${adminId}, напишите ответ для пользователя **${dialog.userName}** следующим сообщением:`,
    });

    await bot.answerCallback(update.callback.callback_id, { notification: 'Напишите ответ в чат.' });
  }
}

module.exports = onAdminCallback;
