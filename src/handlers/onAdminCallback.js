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

    await store.updateTicket(ticketId, { status: 'answered' });

    // Non-fatal: remove buttons from card
    await safeEdit(ctx.api, ticket.admin_msg_id, { attachments: [] });

    // Critical: send answer to user
    await ctx.api.sendMessageToChat(ticket.chat_id, replyText);

    // Send rating request to user
    const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticketId);
    await ctx.api.sendMessageToChat(ticket.chat_id, ratingText, {
      attachments: [Keyboard.inlineKeyboard(ratingButtons)],
    });
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
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Ответ уже был отправлен.' });
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

    await ctx.api.sendMessageToChat(
      adminChatId,
      `✍️ Напишите ответ для пользователя #${ticketId} следующим сообщением.\n` +
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

    await ctx.api.sendMessageToChat(
      ticket.chat_id,
      '🐻 Мы уточнили информацию и скоро напишем! Если появились новые детали — пишите здесь.'
    );

    await ctx.answerOnCallback({ notification: `🔄 Тикет #${ticketId} возвращён в очередь` });
    return;
  }
}

module.exports = onAdminCallback;
