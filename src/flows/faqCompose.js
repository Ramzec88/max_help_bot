const { Keyboard } = require('@maxhub/max-bot-api');
const { HELPER_BOT_URL } = require('../config');

const COMPOSE_TEXT =
  '🎨 Мы не работаем на заказ в стандартном режиме. Но есть два варианта:\n\n' +
  `🤖 Наш бот «Помощник воспитателя» поможет составить сценарий, конспект или методичку прямо сейчас — быстро и бесплатно: 🌐 ${HELPER_BOT_URL}\n\n` +
  '🐻 Если ваша тема нам близка — иногда мы беремся за интересные запросы. Можете описать свою идею, и мы посмотрим 🐻';

const COMPOSE_BUTTONS = [
  [Keyboard.button.link('🤖 Перейти к боту-помощнику', HELPER_BOT_URL)],
  [Keyboard.button.callback('💡 Описать свою идею', 'faq_compose:idea')],
];

async function showComposeFaq(ctx) {
  await ctx.reply(COMPOSE_TEXT, {
    attachments: [Keyboard.inlineKeyboard(COMPOSE_BUTTONS)],
  });
}

module.exports = { showComposeFaq };
