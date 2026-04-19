const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('./store');
const ai = require('./ai');
const formatter = require('./formatter');

async function openTicket(ctx, adminChatId, { topic, platform, context, question, mediaAttachments }) {
  const userId = String(ctx.user.user_id);
  const chatId = Number(ctx.chatId);
  const userName = ctx.user.name || `Пользователь ${userId}`;
  const username = ctx.user.username || null;

  console.log(`[openTicket] user_id=${userId} chat_id=${chatId} ctx.chatId=${ctx.chatId} (type ${typeof ctx.chatId})`);

  // Pause mode — notify user and skip ticket creation
  if (store.isPaused()) {
    await ctx.reply('🐻 Сейчас мы временно недоступны. Напишите позже — обязательно ответим!');
    return null;
  }

  // Check for existing open ticket → add message instead
  const existing = await store.getOpenTicketByUserId(userId);
  if (existing) {
    await store.addMessageToTicket(existing.ticket_id, question);

    if (mediaAttachments?.length > 0) {
      await ctx.api.sendMessageToChat(adminChatId, `👤 ${userName}: ${question || ''}`, {
        attachments: mediaAttachments,
      });
    }

    const notification = formatter.buildAddMessageNotification(existing, question);
    const replyButton = [[
      Keyboard.button.callback('✍️ Ответить', `custom:${existing.ticket_id}`),
      Keyboard.button.callback('✅ Решён', `ticket:resolve:${existing.ticket_id}`),
    ]];
    await ctx.api.sendMessageToChat(adminChatId, notification, {
      attachments: [Keyboard.inlineKeyboard(replyButton)],
    });
    store.setUserState(userId, 'ticket_open');
    return existing;
  }

  // Generate AI variants
  const { variants, label } = await ai.generateVariants(question, { topic, platform });

  // Create ticket in store
  const ticket = await store.createTicket({
    user_id: userId, chat_id: chatId, user_name: userName, username,
    topic, platform: platform || 'unknown', context: context || {},
    last_question: question,
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
    await store.updateTicket(ticket.ticket_id, { admin_msg_id: sentMsg.body.mid });
  }

  store.resetUserState(userId);
  store.setUserState(userId, 'ticket_open');

  return ticket;
}

module.exports = { openTicket };
