const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const { openTicket } = require('../services/tickets');
const formatter = require('../services/formatter');
const { showBuyFaq } = require('../flows/faqBuy');
const { showStep1, showStep2Lava, showStep2Boosty, showStep3 } = require('../flows/faqBroken');
const { showComposeFaq } = require('../flows/faqCompose');

async function onUserCallback(ctx, adminChatId) {
  const payload = ctx.callback?.payload;
  if (!payload) return;

  const userId = String(ctx.callback.user.user_id);

  // ── /start menu buttons ───────────────────────────────────────────────────

  if (payload === 'start:buy') {
    await ctx.answerOnCallback({});
    await showBuyFaq(ctx);
    return;
  }

  if (payload === 'start:broken') {
    await ctx.answerOnCallback({});
    await showStep1(ctx);
    return;
  }

  if (payload === 'start:compose') {
    await ctx.answerOnCallback({});
    await showComposeFaq(ctx);
    return;
  }

  if (payload === 'start:other') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { topic: 'other' });
    await ctx.reply('Напишите ваш вопрос — я передам его команде 🐻👇');
    return;
  }

  // ── Buy FAQ ───────────────────────────────────────────────────────────────

  if (payload === 'faq_buy:yes') {
    await ctx.answerOnCallback({});
    store.resetUserState(userId);
    await ctx.reply('Отлично! Если появятся вопросы — пишите 🐻');
    return;
  }

  if (payload === 'faq_buy:no') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { topic: 'buy' });
    await ctx.reply('Напишите ваш вопрос — я передам его команде 🐻👇');
    return;
  }

  // ── Broken FAQ — platform selection ──────────────────────────────────────

  if (payload === 'faq_broken:platform:lava') {
    await ctx.answerOnCallback({});
    await showStep2Lava(ctx);
    return;
  }

  if (payload === 'faq_broken:platform:boosty') {
    await ctx.answerOnCallback({});
    await showStep2Boosty(ctx);
    return;
  }

  if (payload === 'faq_broken:platform:unknown') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { topic: 'broken', platform: 'unknown' });
    await showStep3(ctx);
    return;
  }

  // ── Broken FAQ — Lava Top spam check ─────────────────────────────────────

  if (payload === 'faq_broken:spam:yes') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { spam_check: 'yes' });
    await ctx.reply(
      'Отлично! Если письмо есть, но ссылка всё равно не открывается — опишите что происходит 👇'
    );
    return;
  }

  if (payload === 'faq_broken:spam:no') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { spam_check: 'no' });
    await showStep3(ctx);
    return;
  }

  // ── Broken FAQ — Boosty file check ───────────────────────────────────────

  if (payload === 'faq_broken:boosty:visible') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { file_visible: 'visible' });
    await showStep3(ctx);
    return;
  }

  if (payload === 'faq_broken:boosty:missing') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { file_visible: 'missing' });
    await showStep3(ctx);
    return;
  }

  // ── Compose FAQ ───────────────────────────────────────────────────────────

  if (payload === 'faq_compose:idea') {
    await ctx.answerOnCallback({});
    store.setUserState(userId, 'awaiting_ticket', { topic: 'compose_idea' });
    await ctx.reply('Опишите свою идею — я передам её команде 🐻👇');
    return;
  }

  // ── Rating ────────────────────────────────────────────────────────────────

  if (payload.startsWith('rating:')) {
    const parts = payload.split(':');
    const vote = parts[1];       // positive | negative
    const ticketId = Number(parts[2]);
    const ticket = store.getTicket(ticketId);

    if (!ticket) {
      await ctx.answerOnCallback({ notification: 'Тикет не найден.' });
      return;
    }

    if (vote === 'positive') {
      store.updateTicket(ticketId, { rating: 'positive', status: 'answered' });
      store.resetUserState(userId);
      await ctx.answerOnCallback({ notification: '👍 Спасибо за оценку!' });
      await ctx.reply('Рады помочь! Если появятся вопросы — пишите 🐻');

      // Notify admin
      if (ticket.admin_msg_id) {
        const updText = formatter.buildResolvedCard(ticket) + '\n\n✅ Пользователь подтвердил решение';
        await ctx.api.editMessage(ticket.admin_msg_id, { text: updText, attachments: [], format: 'markdown' });
      }
    } else {
      store.updateTicket(ticketId, { rating: 'negative', status: 'open' });
      store.setUserState(userId, 'ticket_open');
      // Restore in active tickets
      const { userActiveTicket } = require('../services/store');
      store.updateTicket(ticketId, {});

      await ctx.answerOnCallback({ notification: '👎 Поняли, работаем!' });
      await ctx.reply('Поняли — передаём оператору, разберёмся 🐻');

      // Notify admin
      await ctx.api.sendMessageToChat(
        adminChatId,
        `🔄 Тикет #${ticketId} — пользователь ${ticket.user_name} отметил, что вопрос не решён`
      );
    }
  }
}

module.exports = onUserCallback;
