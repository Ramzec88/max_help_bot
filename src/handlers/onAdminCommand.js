const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { finishCustomReply } = require('./onAdminReply');
const { PROJECTS } = require('../config');

const PROJECT_LABELS = Object.fromEntries(PROJECTS.map((p) => [p.id, p.label]));

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

async function onAdminCommand(ctx, adminChatId) {
  const text = ctx.message?.body?.text || '';
  const adminId = String(ctx.user.user_id);

  // /done — finish custom reply mode
  if (text === '/done') {
    await finishCustomReply(adminId, adminChatId, ctx.api);
    return;
  }

  // /startreply {ticketId} — activate free reply mode for any ticket (open or closed)
  if (text.startsWith('/startreply ')) {
    const ticketId = Number(text.slice(12).trim().split(/\s+/)[0]);
    if (!ticketId) {
      await ctx.api.sendMessageToChat(adminChatId, '⚠️ Использование: /startreply {id}');
      return;
    }
    const ticket = await store.getTicket(ticketId);
    if (!ticket) {
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Тикет #${ticketId} не найден.`);
      return;
    }

    const { CUSTOM_REPLY_TIMEOUT_MS } = require('./onAdminCallback');
    const timeoutHandle = setTimeout(async () => {
      const mode = await store.getAdminMode(adminId);
      if (mode?.targetTicketId === ticketId) {
        await store.clearAdminMode(adminId);
        await ctx.api.sendMessageToChat(adminChatId, `⏱️ Режим свободного ответа для тикета #${ticketId} завершён автоматически (10 мин)`);
      }
    }, CUSTOM_REPLY_TIMEOUT_MS);

    await store.setAdminMode(adminId, { mode: 'awaiting_reply', targetTicketId: ticketId, timeoutHandle });

    const closedNote = ticket.status === 'answered' ? ' (тикет закрыт, но сообщения дойдут)' : '';
    await ctx.api.sendMessageToChat(
      adminChatId,
      `✍️ Режим ответа для тикета #${ticketId} активирован${closedNote}.\n` +
      `Отправляйте текст и файлы по одному. После последнего напишите /done`
    );
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

    try {
      await sendToUser(ctx.api, ticket.chat_id, replyText);
    } catch (err) {
      console.error('sendToUser failed:', err.message, 'ticket:', ticketId, 'chat_id:', ticket.chat_id);
      await ctx.api.sendMessageToChat(
        adminChatId,
        `❌ Не удалось отправить ответ пользователю (тикет #${ticketId}): ${err.message}`
      );
      return;
    }

    await store.updateTicket(ticketId, { status: 'answered' });

    try {
      const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticketId);
      await sendToUser(ctx.api, ticket.chat_id, ratingText, {
        attachments: [Keyboard.inlineKeyboard(ratingButtons)],
      });
    } catch (err) {
      console.error('rating message failed (non-fatal):', err.message);
    }
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

  // /queue — list open tickets
  if (text === '/queue') {
    const tickets = await store.getOpenTickets();
    if (tickets.length === 0) {
      await ctx.api.sendMessageToChat(adminChatId, '✅ Открытых тикетов нет.');
      return;
    }
    const lines = tickets.map((t) => {
      const age = Math.round((Date.now() - t.created_at.getTime()) / 60000);
      const user = t.username ? `@${t.username}` : t.user_name;
      const projectLabel = PROJECT_LABELS[t.project] || t.project;
      return `#${t.ticket_id} ${t.label} ${projectLabel} ${user} — ${t.last_question.slice(0, 50)} (${age} мин)`;
    });
    await ctx.api.sendMessageToChat(
      adminChatId,
      `📋 Открытые тикеты (${tickets.length}):\n\n${lines.join('\n')}`
    );
    return;
  }

  // /message {ticketId} {text} — send to user regardless of ticket status
  if (text.startsWith('/message ')) {
    const parts = text.slice(9).trim().split(' ');
    const ticketId = Number(parts[0]);
    const msgText = parts.slice(1).join(' ').trim();

    if (!ticketId || !msgText) {
      await ctx.api.sendMessageToChat(adminChatId, '⚠️ Использование: /message {id} {текст}');
      return;
    }

    const ticket = await store.getTicket(ticketId);
    if (!ticket) {
      await ctx.api.sendMessageToChat(adminChatId, `⚠️ Тикет #${ticketId} не найден.`);
      return;
    }

    try {
      await sendToUser(ctx.api, ticket.chat_id, msgText);
    } catch (err) {
      console.error('sendToUser failed:', err.message, 'ticket:', ticketId, 'chat_id:', ticket.chat_id);
      await ctx.api.sendMessageToChat(adminChatId, `❌ Не удалось отправить: ${err.message}`);
      return;
    }

    await ctx.api.sendMessageToChat(adminChatId, `📨 Сообщение пользователю по тикету #${ticketId} отправлено.`);
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

    try {
      await sendToUser(ctx.api, ticket.chat_id, sendText);
    } catch (err) {
      console.error('sendToUser failed:', err.message, 'chat_id:', ticket.chat_id);
      await ctx.api.sendMessageToChat(adminChatId, `❌ Не удалось отправить: ${err.message}`);
      return;
    }
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
