const { Keyboard } = require('@maxhub/max-bot-api');
const { MARKET_URL, SUBSCRIPTION_BOT_URL } = require('../config');

const BUY_TEXT =
  `🎭 Сценарии можно получить так:\n\n` +
  `• На сайте: [${MARKET_URL}](${MARKET_URL})\n` +
  `• Или в закрытом канале для педагогов — доступ оформляется в боте: [перейти](${SUBSCRIPTION_BOT_URL})\n\n` +
  `💡 Материалы в канале обновляются не сразу — если нужного сценария там ещё нет, уточняйте наличие на сайте или здесь, у нас\n\n` +
  `Нашли что искали?`;

const BUY_BUTTONS = [[
  Keyboard.button.callback('✅ Да, спасибо!', 'faq_buy:yes'),
  Keyboard.button.callback('🤔 Остался вопрос', 'faq_buy:no'),
]];

async function showBuyFaq(api, chatId) {
  await api.sendMessageToChat(chatId, BUY_TEXT, {
    attachments: [Keyboard.inlineKeyboard(BUY_BUTTONS)],
    format: 'markdown',
  });
}

module.exports = { showBuyFaq };
