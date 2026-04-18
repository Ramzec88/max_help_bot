const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');

const WELCOME_TEXT =
  '🐻 Привет! Я помощник Мишки Макса. Помогу разобраться с покупками, ' +
  'материалами и другими вопросами по нашим каналам.\n\nВыберите, что вас интересует:';

const WELCOME_BUTTONS = [
  [Keyboard.button.callback('🛒 Где купить сценарий?', 'start:buy')],
  [Keyboard.button.callback('😕 Купила, но не работает', 'start:broken')],
  [Keyboard.button.callback('🎨 Хочу попросить составить', 'start:compose')],
  [Keyboard.button.callback('💬 Другой вопрос', 'start:other')],
];

async function handleStart(ctx) {
  const userId = String(ctx.user.user_id);
  await ctx.reply(WELCOME_TEXT, {
    attachments: [Keyboard.inlineKeyboard(WELCOME_BUTTONS)],
  });
  store.markStartShown(userId);
}

module.exports = { handleStart };
