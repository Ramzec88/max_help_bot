const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const formatter = require('../services/formatter');
const { showBuyFaq } = require('../flows/faqBuy');
const { showStep1, showStep2Lava, showStep2Boosty, showStep3 } = require('../flows/faqBroken');
const { showComposeFaq } = require('../flows/faqCompose');
const { showTopicMenu } = require('../flows/start');

// In callback context ctx.chatId is undefined — use user_id as personal chat id
function getChatId(ctx) {
  return ctx.chatId ?? String(ctx.callback?.user?.user_id);
}

async function send(ctx, text, opts) {
  return ctx.api.sendMessageToChat(getChatId(ctx), text, opts);
}

async function onUserCallback(ctx, adminChatId) {
  const payload = ctx.callback?.payload;
  if (!payload) return;

  const userId = String(ctx.callback.user.user_id);
  const chatId = getChatId(ctx);

  // ── Project selection ───────────────────────────────────────────────────

  if (payload.startsWith('project:')) {
    const project = payload.split(':')[1];
    await ctx.answerOnCallback({ notification: '' });

    if (project === 'mishka_max') {
      store.setUserState(userId, 'idle', { project });
      await showTopicMenu(ctx.api, chatId);
    } else {
      store.setUserState(userId, 'awaiting_ticket', { project, topic: 'other', platform: 'unknown' });
      await send(ctx, 'Напишите ваш вопрос — я передам его команде 🐻👇');
    }
    return;
  }

  // ── /start menu buttons ───────────────────────────────────────────────────

  if (payload === 'start:buy') {
    await ctx.answerOnCallback({ notification: '' });
    await showBuyFaq(ctx.api, chatId);
    return;
  }

  if (payload === 'start:broken') {
    await ctx.answerOnCallback({ notification: '' });
    await showStep1(ctx.api, chatId);
    return;
  }

  if (payload === 'start:compose') {
    await ctx.answerOnCallback({ notification: '' });
    await showComposeFaq(ctx.api, chatId);
    return;
  }

  if (payload === 'start:other') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'other' });
    await send(ctx, 'Напишите ваш вопрос — я передам его команде 🐻👇');
    return;
  }

  // ── Buy FAQ ───────────────────────────────────────────────────────────────

  if (payload === 'faq_buy:yes') {
    await ctx.answerOnCallback({ notification: '' });
    store.resetUserState(userId);
    await send(ctx, 'Отлично! Если появятся вопросы — пишите 🐻');
    return;
  }

  if (payload === 'faq_buy:no') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'buy' });
    await send(ctx, 'Напишите ваш вопрос — я передам его команде 🐻👇');
    return;
  }

  // ── Broken FAQ — platform selection ──────────────────────────────────────

  if (payload === 'faq_broken:platform:lava') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'broken', platform: 'lava' });
    await showStep2Lava(ctx.api, chatId);
    return;
  }

  if (payload === 'faq_broken:platform:boosty') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'broken', platform: 'boosty' });
    await showStep2Boosty(ctx.api, chatId);
    return;
  }

  if (payload === 'faq_broken:platform:unknown') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'broken', platform: 'unknown' });
    await showStep3(ctx.api, chatId);
    return;
  }

  // ── Broken FAQ — Lava Top spam check ─────────────────────────────────────

  if (payload === 'faq_broken:spam:yes') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { spam_check: 'yes' });
    await send(ctx, 'Отлично! Если письмо есть, но ссылка всё равно не открывается — опишите что происходит 👇');
    return;
  }

  if (payload === 'faq_broken:spam:no') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { spam_check: 'no' });
    await showStep3(ctx.api, chatId);
    return;
  }

  // ── Broken FAQ — Boosty file check ───────────────────────────────────────

  if (payload === 'faq_broken:boosty:visible') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { file_visible: 'visible' });
    await showStep3(ctx.api, chatId);
    return;
  }

  if (payload === 'faq_broken:boosty:missing') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { file_visible: 'missing' });
    await showStep3(ctx.api, chatId);
    return;
  }

  // ── Compose FAQ ───────────────────────────────────────────────────────────

  if (payload === 'faq_compose:idea') {
    await ctx.answerOnCallback({ notification: '' });
    store.setUserState(userId, 'awaiting_ticket', { topic: 'compose_idea' });
    await send(ctx, 'Опишите свою идею — я передам её команде 🐻👇');
    return;
  }

  // ── Rating ────────────────────────────────────────────────────────────────

  if (payload.startsWith('rating:')) {
    const parts = payload.split(':');
    const vote = parts[1];
    const ticketId = Number(parts[2]);
    const ticket = await store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }

    if (vote === 'positive') {
      await store.updateTicket(ticketId, { rating: 'positive', status: 'answered' });
      store.resetUserState(userId);
      await ctx.answerOnCallback({ notification: '👍 Спасибо за оценку!' });
      await send(ctx, 'Рады помочь! Если появятся новые вопросы — напишите сюда или нажмите /start для выбора темы 🐻');

      if (ticket.admin_msg_id) {
        const updText = formatter.buildResolvedCard(ticket) + '\n\n✅ Пользователь подтвердил решение';
        await ctx.api.editMessage(ticket.admin_msg_id, { text: updText, attachments: [], format: 'markdown' });
      }
    } else {
      await store.updateTicket(ticketId, { rating: 'negative', status: 'open' });
      store.setUserState(userId, 'ticket_open');

      await ctx.answerOnCallback({ notification: '👎 Поняли, работаем!' });
      await send(ctx, 'Поняли — передаём оператору, разберёмся 🐻');

      await ctx.api.sendMessageToChat(
        adminChatId,
        `🔄 Тикет #${ticketId} — пользователь ${ticket.user_name} отметил, что вопрос не решён`
      );
    }
  }
}

module.exports = onUserCallback;
