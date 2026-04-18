const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');

const CUSTOM_REPLY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function onAdminCallback(ctx, adminChatId) {
  const payload = ctx.callback?.payload;
  if (!payload) return;

  const adminId = String(ctx.callback.user.user_id);

  // ── Variant button: reply:{ticketId}:{variantIdx} ─────────────────────────

  if (payload.startsWith('reply:')) {
    const [, ticketIdStr, idxStr] = payload.split(':');
    const ticketId = Number(ticketIdStr);
    const idx = parseInt(idxStr, 10);
    const ticket = store.getTicket(ticketId);

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

    // Lock immediately (double-press protection)
    store.updateTicket(ticketId, { status: 'answered' });

    // Remove buttons from card immediately
    if (ticket.admin_msg_id) {
      await ctx.api.editMessage(ticket.admin_msg_id, { attachments: [] });
    }

    // Send answer to user
    await ctx.api.sendMessageToChat(ticket.chat_id, replyText);

    // Send rating request to user
    const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticketId);
    await ctx.api.sendMessageToChat(ticket.chat_id, ratingText, {
      attachments: [Keyboard.inlineKeyboard(ratingButtons)],
    });
    store.setUserState(ticket.user_id, 'rating_pending');

    // Update admin card with answer
    const updatedText = formatter.buildAnsweredCard(ticket, replyText);
    if (ticket.admin_msg_id) {
      await ctx.api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
    }

    await ctx.answerOnCallback({ notification: '✅ Ответ отправлен!' });
    return;
  }

  // ── Custom reply button: custom:{ticketId} ────────────────────────────────

  if (payload.startsWith('custom:')) {
    const ticketId = Number(payload.split(':')[1]);
    const ticket = store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Ответ уже был отправлен.' });
      return;
    }

    // Remove buttons immediately (double-press protection)
    if (ticket.admin_msg_id) {
      await ctx.api.editMessage(ticket.admin_msg_id, { attachments: [] });
    }

    // Set admin mode with 10-min auto-timeout
    const timeoutHandle = setTimeout(async () => {
      const mode = store.getAdminMode(adminId);
      if (mode?.targetTicketId === ticketId) {
        store.clearAdminMode(adminId);
        await ctx.api.sendMessageToChat(
          adminChatId,
          `⏱️ Режим свободного ответа для тикета #${ticketId} завершён автоматически (10 мин)`
        );
      }
    }, CUSTOM_REPLY_TIMEOUT_MS);

    store.setAdminMode(adminId, { mode: 'awaiting_reply', targetTicketId: ticketId, timeoutHandle });

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
    const ticket = store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Тикет уже закрыт.' });
      return;
    }

    store.closeTicket(ticketId);

    if (ticket.admin_msg_id) {
      const updatedText = formatter.buildResolvedCard(ticket);
      await ctx.api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
    }

    await ctx.answerOnCallback({ notification: `✅ Тикет #${ticketId} закрыт` });
    return;
  }

  // ── Return ticket: ticket:return:{ticketId} ───────────────────────────────

  if (payload.startsWith('ticket:return:')) {
    const ticketId = Number(payload.split(':')[2]);
    const ticket = store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.answerOnCallback({ notification: 'Тикет уже закрыт.' });
      return;
    }

    // Remove buttons (keep ticket open)
    if (ticket.admin_msg_id) {
      const updatedText = formatter.buildReturnedCard(ticket);
      await ctx.api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
    }

    // Notify user
    await ctx.api.sendMessageToChat(
      ticket.chat_id,
      '🐻 Мы уточнили информацию и скоро напишем! Если появились новые детали — пишите здесь.'
    );

    await ctx.answerOnCallback({ notification: `🔄 Тикет #${ticketId} возвращён в очередь` });
    return;
  }
}

module.exports = onAdminCallback;
