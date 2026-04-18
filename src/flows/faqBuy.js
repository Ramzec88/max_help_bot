const { Keyboard } = require('@maxhub/max-bot-api');
const { BOOSTY_URL, LAVA_TOP_URL } = require('../config');

const BUY_TEXT =
  `🎭 Наши сценарии можно купить в двух местах:\n\n` +
  `• [Boosty](${BOOSTY_URL})\n` +
  `• [Lava Top](${LAVA_TOP_URL})\n\n` +
  `Все доступные материалы собраны здесь: 👉 mishka-max.ru/me — первые две ссылки в списке\n\n` +
  `Нашли что искали?`;

const BUY_BUTTONS = [[
  Keyboard.button.callback('✅ Да, спасибо!', 'faq_buy:yes'),
  Keyboard.button.callback('🤔 Остался вопрос', 'faq_buy:no'),
]];

async function showBuyFaq(ctx) {
  await ctx.reply(BUY_TEXT, {
    attachments: [Keyboard.inlineKeyboard(BUY_BUTTONS)],
    format: 'markdown',
  });
}

module.exports = { showBuyFaq };
