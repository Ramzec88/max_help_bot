const store = require('../services/store');
const { openTicket } = require('../services/tickets');
const { extractMediaAttachments } = require('../services/media');
const { handleStart } = require('../flows/start');

async function onUserMessage(ctx, adminChatId) {
  if (ctx.user?.is_bot) return;

  const userId = String(ctx.user.user_id);
  const text = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  // /start command
  if (text === '/start') {
    await handleStart(ctx);
    return;
  }

  // Ignore empty messages with no media
  if (!text && mediaAttachments.length === 0) return;

  const { state, context } = store.getUserState(userId);

  switch (state) {
    case 'awaiting_ticket': {
      // User typed their issue description after a FAQ branch collected context
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
      // Add follow-up message to existing open ticket
      const ticket = store.getOpenTicketByUserId(userId);
      if (!ticket) {
        // Ticket was closed; treat as new question
        await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
        return;
      }
      const question = text || '[медиафайл]';
      store.addMessageToTicket(ticket.ticket_id, question);

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
      // User wrote text instead of pressing rating — open a new ticket
      await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
      break;

    default:
      // idle or any unrecognised state
      await handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId);
      break;
  }
}

async function handleNewQuestion(ctx, adminChatId, text, mediaAttachments, userId) {
  if (!store.hasSeenStart(userId)) {
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
