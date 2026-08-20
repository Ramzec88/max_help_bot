const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');
const { PROJECTS } = require('../config');

const WELCOME_TEXT =
  '🐻 Привет! Я бот поддержки детских проектов «Мишка Макс» и «Колянчик». ' +
  'Помогу с покупками, доступом к материалам и другими вопросами.\n\nПо какому проекту у вас вопрос?';

const PROJECT_PROMPT_TEXT = '🐻 По какому проекту у вас вопрос?';

const PROJECT_BUTTONS = PROJECTS.map((p) => [Keyboard.button.callback(p.label, `project:${p.id}`)]);

const TOPIC_MENU_TEXT = '🐻 Выберите, что вас интересует:';

const TOPIC_BUTTONS = [
  [Keyboard.button.callback('🛒 Где купить сценарий?', 'start:buy')],
  [Keyboard.button.callback('😟 Купила, но не работает', 'start:broken')],
  [Keyboard.button.callback('✍️ Хочу попросить составить', 'start:compose')],
  [Keyboard.button.callback('💬 Другой вопрос', 'start:other')],
];

async function handleStart(ctx) {
  const userId = String(ctx.user.user_id);
  const isFirstTime = !(await store.hasSeenStart(userId));

  await ctx.reply(isFirstTime ? WELCOME_TEXT : PROJECT_PROMPT_TEXT, {
    attachments: [Keyboard.inlineKeyboard(PROJECT_BUTTONS)],
  });

  store.markStartShown(userId);
}

async function showTopicMenu(api, chatId) {
  await api.sendMessageToChat(chatId, TOPIC_MENU_TEXT, {
    attachments: [Keyboard.inlineKeyboard(TOPIC_BUTTONS)],
  });
}

module.exports = { handleStart, showTopicMenu };
