const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { finishCustomReply } = require('./onAdminReply');

async function onAdminCommand(ctx, adminChatId) {
  const text = ctx.message?.body?.text || '';
  const adminId = String(ctx.user.user_id);

  // /done — finish custom reply mode
  if (text === '/done') {
    await finishCustomReply(adminId, adminChatId, ctx.api);
    return;
  }

  // /open — disable pause mode
  if (text === '/open') {
    store.clearPause();
    await ctx.api.sendMessageToChat(adminChatId, '✅ Режим отсутствия отключён. Бот принимает обращения.');
    return;
  }

  // /pause {duration} — enable away mode (e.g. /pause 2h, /pause 30m)
  if (text.startsWith('/pause')) {
    const arg = text.slice(6).trim();
    const until = parsePauseDuration(arg);
    store.setPause(until);
    const timeStr = until ? until.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '∞';
    const msg = until
      ? `⏸ Режим отсутствия включён до ${timeStr}`
      : '⏸ Режим отсутствия включён (без ограничения)';
    await ctx.api.sendMessageToChat(adminChatId, msg);
    return;
  }

  // /reply {ticketId} {text}
  if (text.startsWith('/reply ')) {
    const parts = text.slice(7).trim().split(' ');
    const ticketId = Number(parts[0]);
    const replyText = parts.slice(1).join(' ').trim();

    if (!ticketId || !replyText) {
      await ctx.api.sendMessageToChat(adminChatId, '⚠️ Использование: /reply {id} {текст}');
      return;
    }

    const ticket = await store.getTicket(ticketId);
    if (!ticket) {
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Тикет #${ticketId} не найден.`);
      return;
    }
    if (ticket.status === 'answered') {
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Тикет #${ticketId} уже закрыт.`);
      return;
    }

    await store.updateTicket(ticketId, { status: 'answered' });
    await ctx.api.sendMessageToChat(ticket.chat_id, replyText);

    const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticketId);
    await ctx.api.sendMessageToChat(ticket.chat_id, ratingText, {
      attachments: [Keyboard.inlineKeyboard(ratingButtons)],
    });
    store.setUserState(ticket.user_id, 'rating_pending');

    await store.closeTicket(ticketId);

    if (ticket.admin_msg_id) {
      try {
        const updatedText = formatter.buildAnsweredCard(ticket, replyText);
        await ctx.api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
      } catch (err) {
        console.error('editMessage error (non-fatal):', err.message);
      }
    }

    await ctx.api.sendMessageToChat(adminChatId, `✅ Ответ на тикет #${ticketId} отправлен.`);
    return;
  }

  // /send {userId} {text}
  if (text.startsWith('/send ')) {
    const parts = text.slice(6).trim().split(' ');
    const targetUserId = parts[0];
    const sendText = parts.slice(1).join(' ').trim();

    if (!targetUserId || !sendText) {
      await ctx.api.sendMessageToChat(adminChatId, '⚠️ Использование: /send {user_id} {текст}');
      return;
    }

    const ticket = await store.getOpenTicketByUserId(targetUserId);
    if (!ticket) {
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Активный тикет для пользователя ${targetUserId} не найден.`);
      return;
    }

    await ctx.api.sendMessageToChat(ticket.chat_id, sendText);
    await ctx.api.sendMessageToChat(adminChatId, `📨 Сообщение пользователю ${targetUserId} отправлено.`);
    return;
  }
}

function parsePauseDuration(arg) {
  if (!arg) return null;
  const match = arg.match(/^(\d+)(h|m|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = unit === 'h' ? value * 3600000
    : unit === 'm' ? value * 60000
    : unit === 'd' ? value * 86400000
    : 0;
  return ms ? new Date(Date.now() + ms) : null;
}

module.exports = onAdminCommand;
