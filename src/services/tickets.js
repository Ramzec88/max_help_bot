// Helper: create ticket, generate AI variants, send card to admin chat
const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('./store');
const ai = require('./ai');
const formatter = require('./formatter');
const { extractMediaAttachments } = require('./media');

async function openTicket(ctx, adminChatId, { topic, platform, context, question, mediaAttachments }) {
  const userId = String(ctx.user.user_id);
  const chatId = String(ctx.chatId);
  const userName = ctx.user.name || `Пользователь ${userId}`;
  const username = ctx.user.username || null;

  // Check for existing open ticket → add message instead
  const existing = store.getOpenTicketByUserId(userId);
  if (existing) {
    store.addMessageToTicket(existing.ticket_id, question);

    if (mediaAttachments?.length > 0) {
      await ctx.api.sendMessageToChat(adminChatId, `👤 ${userName}: ${question || ''}`, {
        attachments: mediaAttachments,
      });
    }

    const notification = formatter.buildAddMessageNotification(existing, question);
    await ctx.api.sendMessageToChat(adminChatId, notification);
    store.setUserState(userId, 'ticket_open');
    return existing;
  }

  // Generate AI variants
  const { variants, label } = await ai.generateVariants(question, { topic, platform });

  // Create ticket in store
  const ticket = store.createTicket({
    user_id: userId, chat_id: chatId, user_name: userName, username,
    topic, platform: platform || 'unknown', context: context || {},
    messages: [question], last_question: question,
    ai_variants: variants, label,
  });

  // Send confirmation to user (first message only)
  await ctx.reply('✅ Сообщение получено! Постараемся ответить как можно скорее 🐻');

  // Forward media to admin chat first (if any)
  const hasMedia = mediaAttachments?.length > 0;
  if (hasMedia) {
    const caption = question ? `👤 ${userName}: ${question}` : `👤 ${userName}`;
    await ctx.api.sendMessageToChat(adminChatId, caption, { attachments: mediaAttachments });
  }

  // Send ticket card with buttons
  const cardText = formatter.buildTicketCard(ticket, hasMedia);
  const buttons = formatter.buildTicketButtons(ticket.ticket_id, variants);

  const sentMsg = await ctx.api.sendMessageToChat(adminChatId, cardText, {
    attachments: [Keyboard.inlineKeyboard(buttons)],
    format: 'markdown',
  });

  if (sentMsg?.body?.mid) {
    store.updateTicket(ticket.ticket_id, { admin_msg_id: sentMsg.body.mid });
  }

  store.setUserState(userId, 'ticket_open');
  store.resetUserState(userId); // clear FAQ context, set to ticket_open
  store.setUserState(userId, 'ticket_open');

  return ticket;
}

module.exports = { openTicket };
