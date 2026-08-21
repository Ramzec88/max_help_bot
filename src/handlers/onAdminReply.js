const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { extractMediaAttachments, toOutgoingAttachment } = require('../services/media');

const DELAY_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function onAdminReply(ctx, adminChatId) {
  const adminId = String(ctx.user.user_id);
  const adminMode = await store.getAdminMode(adminId);
  if (!adminMode || adminMode.mode !== 'awaiting_reply') {
    const text = ctx.message?.body?.text || '';
    if (text && !text.startsWith('/')) {
      await ctx.api.sendMessageToChat(
        adminChatId,
        '💡 Чтобы ответить пользователю:\n' +
        '• нажмите кнопку [Вариант 1/2/3] на карточке тикета — ответ уйдёт автоматически\n' +
        '• или нажмите [✍️ Свой], затем напишите текст и завершите /done'
      );
    }
    return;
  }

  const rawText = ctx.message?.body?.text || '';
  const replyText = rawText.trim();
  const mediaAttachments = extractMediaAttachments(ctx.message);

  console.log(`[onAdminReply] raw="${JSON.stringify(rawText)}" trimmed_len=${replyText.length} media=${mediaAttachments.length}`);

  if (!replyText && mediaAttachments.length === 0) return;

  const { targetTicketId } = adminMode;
  const ticket = await store.getTicket(targetTicketId);

  if (!ticket) {
    await store.clearAdminMode(adminId);
    return;
  }

  if (ticket.status === 'answered') {
    await store.clearAdminMode(adminId);
    await ctx.api.sendMessageToChat(adminChatId, '⚠️ Этот тикет уже закрыт.');
    return;
  }

  try {
    // Forward text to user
    if (replyText) {
      await sleep(DELAY_MS);
      await sendToUser(ctx.api, ticket.chat_id, replyText);
    }

    // Forward media to user (each with 300ms delay)
    for (const att of mediaAttachments) {
      const outgoing = toOutgoingAttachment(att);
      if (!outgoing) {
        console.error('skipping unforwardable attachment:', JSON.stringify(att));
        continue;
      }
      await sleep(DELAY_MS);
      await sendToUser(ctx.api, ticket.chat_id, '', { attachments: [outgoing] });
    }
  } catch (err) {
    console.error('admin reply send failed:', err.message, 'ticket:', ticket.ticket_id, 'chat_id:', ticket.chat_id);
    await ctx.api.sendMessageToChat(
      adminChatId,
      `❌ Не удалось отправить сообщение пользователю (тикет #${ticket.ticket_id}): ${err.message}`
    );
    return;
  }

  // Confirm in admin chat (silent — don't close mode yet, wait for /done)
  await ctx.api.sendMessageToChat(adminChatId, `📨 Отправлено пользователю. Продолжайте или напишите /done`);
}

async function finishCustomReply(adminId, adminChatId, api) {
  const adminMode = await store.getAdminMode(adminId);
  if (!adminMode) return;

  const ticket = await store.getTicket(adminMode.targetTicketId);
  await store.clearAdminMode(adminId);

  if (!ticket) return;

  const alreadyClosed = ticket.status === 'answered';

  if (!alreadyClosed) {
    await store.updateTicket(ticket.ticket_id, { status: 'answered' });
    await store.closeTicket(ticket.ticket_id);

    // Send rating request only on first close
    try {
      const { text: ratingText, buttons: ratingButtons } = formatter.buildRatingMessage(ticket.ticket_id);
      await sendToUser(api, ticket.chat_id, ratingText, {
        attachments: [Keyboard.inlineKeyboard(ratingButtons)],
      });
    } catch (err) {
      console.error('rating message failed (non-fatal):', err.message);
    }
    store.setUserState(ticket.user_id, 'rating_pending');
  }

  // Update admin card
  if (ticket.admin_msg_id) {
    try {
      const updatedText = formatter.buildAnsweredCard(ticket, '[свободный ответ]');
      await api.editMessage(ticket.admin_msg_id, { text: updatedText, attachments: [], format: 'markdown' });
    } catch (err) {
      console.error('editMessage error (non-fatal):', err.message);
    }
  }

  const doneMsg = alreadyClosed
    ? `✅ Сообщения отправлены пользователю по тикету #${ticket.ticket_id}.`
    : `✅ Ответ завершён. Тикет #${ticket.ticket_id} закрыт.`;
  await api.sendMessageToChat(adminChatId, doneMsg);
}

module.exports = { onAdminReply, finishCustomReply };
