const { Keyboard } = require('@maxhub/max-bot-api');
const { SUBSCRIPTION_BOT_URL } = require('../config');

const RENEW_TEXT =
  `🔄 Оформление и продление подписки — через отдельного бота:\n\n` +
  `👉 [Перейти в бота](${SUBSCRIPTION_BOT_URL})\n\n` +
  `1️⃣ Нажмите кнопку «Старт» (если её нет — отправьте сообщение /start, с косой чертой)\n` +
  `2️⃣ Появится кнопка «Оформить подписку» — нажмите её\n\n` +
  `💡 За сутки до окончания подписки бот сам пришлёт сообщение с кнопкой продления — отдельно ничего делать не нужно.\n\n` +
  `Получилось?`;

const RENEW_BUTTONS = [[
  Keyboard.button.callback('✅ Да, спасибо!', 'faq_renew:yes'),
  Keyboard.button.callback('🤔 Остался вопрос', 'faq_renew:no'),
]];

async function showRenewFaq(api, chatId) {
  await api.sendMessageToChat(chatId, RENEW_TEXT, {
    attachments: [Keyboard.inlineKeyboard(RENEW_BUTTONS)],
    format: 'markdown',
  });
}

module.exports = { showRenewFaq };
