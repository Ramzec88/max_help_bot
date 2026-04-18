const store = require('../services/store');
const { openTicket } = require('../services/tickets');
const { extractMediaAttachments } = require('../services/media');
const { handleStart } = require('../flows/start');

async function onUserMessage(ctx, adminChatId) {
  if (ctx.user?.is_bot) return;

  const userId = String(ctx.user.user_id);
  const text = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  if (text === '/start') {
    await handleStart(ctx);
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
