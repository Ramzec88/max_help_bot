const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { extractMediaAttachments } = require('../services/media');

const DELAY_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function onAdminReply(ctx, adminChatId) {
  const adminId = String(ctx.user.user_id);
  const adminMode = store.getAdminMode(adminId);
  if (!adminMode || adminMode.mode !== 'awaiting_reply') return;

  const replyText = ctx.message?.body?.text || '';
  const mediaAttachments = extractMediaAttachments(ctx.message);

  if (!replyText && mediaAttachments.length === 0) return;

  const { targetTicketId } = adminMode;
  const ticket = store.getTicket(targetTicketId);

  if (!ticket) {
    store.clearAdminMode(adminId);
    return;
  }

  if (ticket.status === 'answered') {
    store.clearAdminMode(adminId);
    await ctx.api.sendMessageToChat(adminChatId, '⚠️ Этот тикет уже закрыт.');
    return;
  }

  // Forward text to user
  if (replyText) {
    await sleep(DELAY_MS);
    await ctx.api.sendMessageToChat(ticket.chat_id, replyText);
  }

  // Forward media to user (each with 300ms delay)
  for (const att of mediaAttachments) {
    await sleep(DELAY_MS);
    await ctx.api.sendMessageToChat(ticket.chat_id, '', { attachments: [att] });
  }

  // Confirm in admin chat (silent — don't close mode yet, wait for /done)
  await ctx.api.sendMessageToChat(adminChatId, `📨 Отправлено пользователю. Продолжайте или напишите /done`);
}

async function finishCustomReply(adminId, adminChatId, api) {
  const adminMode = store.getAdminMode(adminId);
  if (!adminMode) return;

  const ticket = store.getTicket(adminMode.targetTicketId);
  store.clearAdminMode(adminId);

  if (!ticket || ticket.status === 'answered') return;

  store.updateTicket(ticket.ticket_id, { status: 'answered' });
  store.closeTicket(ticket.ticket_id);

  // Send rating request to user
  const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticket.ticket_id);
  await api.sendMessageToChat(ticket.chat_id, ratingText, {
    attachments: [Keyboard.inlineKeyboard(ratingButtons)],
  });
  store.setUserState(ticket.user_id, 'rating_pending');

  // Update admin card
  if (ticket.admin_msg_id) {
    const updatedText = formatter.buildAnsweredCard(ticket, '[свободный ответ]');
    await api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
  }

  await api.sendMessageToChat(adminChatId, `✅ Ответ завершён. Тикет #${ticket.ticket_id} закрыт.`);
}

module.exports = { onAdminReply, finishCustomReply };
