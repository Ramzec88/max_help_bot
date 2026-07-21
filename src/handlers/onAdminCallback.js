const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');

const CUSTOM_REPLY_TIMEOUT_MS = 10 * 60 * 1000;

async function safeEdit(api, msgId, data) {
  if (!msgId) return;
  try {
    await api.editMessage(msgId, data);
  } catch (err) {
    console.error('editMessage error (non-fatal):', err.message);
  }
}

async function sendToUser(api, rawChatId, text, opts) {
  const chatId = Number(rawChatId);
  if (!Number.isFinite(chatId) || chatId === 0) {
    throw new Error(`bad chat_id: ${rawChatId}`);
  }
  console.log(`[admin→user] chat_id=${chatId} len=${text?.length || 0}`);
  try {
    const result = await api.sendMessageToChat(chatId, text, opts);
    console.log(`[admin→user] ok mid=${result?.body?.mid || 'n/a'}`);
    return result;
  } catch (err) {
    if (err.message?.includes('error.dialog.suspended')) {
      throw new Error('пользователь заблокировал бота или удалил чат — написать невозможно');
    }
    throw err;
  }
}

async function onAdminCallback(ctx, adminChatId) {
  const payload = ctx.callback?.payload;
  if (!payload) return;

  const adminId = String(ctx.callback.user.user_id);

  // ── Variant button: reply:{ticketId}:{variantIdx} ─────────────────────────

  if (payload.startsWith('reply:')) {
    const [, ticketIdStr, idxStr] = payload.split(':');
    const ticketId = Number(ticketIdStr);
    const idx = parseInt(idxStr, 10);
    const ticket = await store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Ответ уже был отправлен.' });
      return;
    }

    const replyText = ticket.ai_variants[idx];
    if (!replyText) return;

    // Critical: send answer to user FIRST. If this fails, ticket stays open.
    try {
      await sendToUser(ctx.api, ticket.chat_id, replyText);
    } catch (err) {
      console.error('sendToUser failed:', err.message, 'ticket:', ticketId, 'chat_id:', ticket.chat_id);
      await ctx.api.sendMessageToChat(
        adminChatId,
        `❌ Не удалось отправить ответ пользователю (тикет #${ticketId}): ${err.message}`
      );
      await ctx.answerOnCallback({ notification: '❌ Ошибка отправки. См. чат.' });
      return;
    }

    // Lock after successful delivery
    await store.updateTicket(ticketId, { status: 'answered' });

    // Non-fatal: remove buttons
    await safeEdit(ctx.api, ticket.admin_msg_id, { attachments: [] });

    // Send rating request to user
    try {
      const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticketId);
      await sendToUser(ctx.api, ticket.chat_id, ratingText, {
        attachments: [Keyboard.inlineKeyboard(ratingButtons)],
      });
    } catch (err) {
      console.error('rating message failed (non-fatal):', err.message);
    }
    store.setUserState(ticket.user_id, 'rating_pending');

    // Non-fatal: update admin card text
    const updatedText = formatter.buildAnsweredCard(ticket, replyText);
    await safeEdit(ctx.api, ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });

    await ctx.answerOnCallback({ notification: '✅ Ответ отправлен!' });
    return;
  }

  // ── Custom reply button: custom:{ticketId} ────────────────────────────────

  if (payload.startsWith('custom:')) {
    const ticketId = Number(payload.split(':')[1]);
    const ticket = await store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }

    // Non-fatal: remove buttons
    await safeEdit(ctx.api, ticket.admin_msg_id, { attachments: [] });

    const timeoutHandle = setTimeout(async () => {
      const mode = await store.getAdminMode(adminId);
      if (mode?.targetTicketId === ticketId) {
        await store.clearAdminMode(adminId);
        await ctx.api.sendMessageToChat(
          adminChatId,
          `⏱️ Режим свободного ответа для тикета #${ticketId} завершён автоматически (10 мин)`
        );
      }
    }, CUSTOM_REPLY_TIMEOUT_MS);

    await store.setAdminMode(adminId, { mode: 'awaiting_reply', targetTicketId: ticketId, timeoutHandle });

    const closedNote = ticket.status === 'answered' ? ' (тикет закрыт, но сообщение дойдёт)' : '';
    await ctx.api.sendMessageToChat(
      adminChatId,
      `✍️ Напишите ответ для пользователя #${ticketId} следующим сообщением${closedNote}.\n` +
      `Если нужно отправить несколько файлов — отправляйте по одному.\n` +
      `После последнего напишите /done`
    );

    await ctx.answerOnCallback({ notification: 'Напишите ответ в чат.' });
    return;
  }

  // ── Resolve ticket: ticket:resolve:{ticketId} ─────────────────────────────

  if (payload.startsWith('ticket:resolve:')) {
    const ticketId = Number(payload.split(':')[2]);
    const ticket = await store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Тикет уже закрыт.' });
      return;
    }

    await store.closeTicket(ticketId);
    await safeEdit(ctx.api, ticket.admin_msg_id, {
      text: formatter.buildResolvedCard(ticket),
      attachments: [],
      format: 'markdown',
    });

    await ctx.answerOnCallback({ notification: `✅ Тикет #${ticketId} закрыт` });
    return;
  }

  // ── Return ticket: ticket:return:{ticketId} ───────────────────────────────

  if (payload.startsWith('ticket:return:')) {
    const ticketId = Number(payload.split(':')[2]);
    const ticket = await store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Тикет уже закрыт.' });
      return;
    }

    await safeEdit(ctx.api, ticket.admin_msg_id, {
      text: formatter.buildReturnedCard(ticket),
      attachments: [],
      format: 'markdown',
    });

    try {
      await sendToUser(
        ctx.api,
        ticket.chat_id,
        '🐻 Мы уточнили информацию и скоро напишем! Если появились новые детали — пишите здесь.'
      );
    } catch (err) {
      console.error('return notification failed:', err.message);
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Не удалось уведомить пользователя: ${err.message}`);
    }

    await ctx.answerOnCallback({ notification: `🔄 Тикет #${ticketId} возвращён в очередь` });
    return;
  }
}

module.exports = onAdminCallback;
