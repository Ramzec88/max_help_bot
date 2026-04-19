const store = require('../services/store');
const { openTicket } = require('../services/tickets');
const { extractMediaAttachments } = require('../services/media');
const { handleStart } = require('../flows/start');
const { STAFF_USER_IDS } = require('../config');

async function onUserMessage(ctx, adminChatId) {
  if (ctx.user?.is_bot) return;

  const userId = String(ctx.user.user_id);
  const text = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  if (text === '/start') {
    await handleStart(ctx);
    return;
  }

  if (text === '/queue' && STAFF_USER_IDS.includes(userId)) {
    const tickets = await store.getOpenTickets();
    if (tickets.length === 0) {
      await ctx.reply('✅ Открытых тикетов нет.');
      return;
    }
    const lines = tickets.map((t) => {
      const age = Math.round((Date.now() - t.created_at.getTime()) / 60000);
      const user = t.username ? `@${t.username}` : t.user_name;
      return `#${t.ticket_id} ${t.label} ${user} — ${t.last_question.slice(0, 50)} (${age} мин)`;
    });
    await ctx.reply(`📋 Открытые тикеты (${tickets.length}):\n\n${lines.join('\n')}`);
    return;
  }

  if (!text && mediaAttachments.length === 0) return;

  const { state, context } = store.getUserState(userId);

  switch (state) {
    case 'awaiting_ticket': {
      const question = text || '[медиафайл]';
      await openTicket(ctx, adminChatId, {
        topic: context.topic || 'other',
        platform: context.platform || 'unknown',
        context,
        question,
        mediaAttachments,
      });
      break;
    }

    case 'ticket_open': {
      const ticket = await store.getOpenTicketByUserId(userId);
      if (!ticket) {
        await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
        return;
      }
      const question = text || '[медиафайл]';
      await store.addMessageToTicket(ticket.ticket_id, question);

      if (mediaAttachments.length > 0) {
        await ctx.api.sendMessageToChat(adminChatId, `👤 ${ticket.user_name}: ${text || ''}`, {
          attachments: mediaAttachments,
        });
      }
      if (text) {
        const { buildAddMessageNotification } = require('../services/formatter');
        await ctx.api.sendMessageToChat(
          adminChatId,
          buildAddMessageNotification(ticket, text)
        );
      }
      break;
    }

    case 'rating_pending':
      await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
      break;

    default:
      await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
      break;
  }
}

async function handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId) {
  if (!await store.hasSeenStart(userId)) {
    await handleStart(ctx);
    return;
  }
  const question = text || '[медиафайл]';
  await openTicket(ctx, adminChatId, {
    topic: 'other',
    platform: 'unknown',
    context: {},
    question,
    mediaAttachments,
  });
}

module.exports = onUserMessage;
