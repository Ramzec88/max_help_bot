const { Keyboard } = require('@maxhub/max-bot-api');
const store = require('../services/store');

const PLATFORM_BUTTONS = [[
  Keyboard.button.callback('Boosty', 'faq_broken:platform:boosty'),
  Keyboard.button.callback('Lava Top', 'faq_broken:platform:lava'),
  Keyboard.button.callback('Не помню / другое', 'faq_broken:platform:unknown'),
]];

const SPAM_BUTTONS = [[
  Keyboard.button.callback('✅ Да, нашла!', 'faq_broken:spam:yes'),
  Keyboard.button.callback('✗ Нет, не нашла', 'faq_broken:spam:no'),
]];

const BOOSTY_FILE_BUTTONS = [[
  Keyboard.button.callback('✅ Вижу, но не открывается', 'faq_broken:boosty:visible'),
  Keyboard.button.callback('✗ Не нахожу', 'faq_broken:boosty:missing'),
]];

async function showStep1(ctx) {
  const userId = String(ctx.user.user_id);
  store.setUserState(userId, 'faq_broken_p1', { topic: 'broken' });
  await ctx.reply('😊 Разберёмся вместе! Где вы покупали?', {
    attachments: [Keyboard.inlineKeyboard(PLATFORM_BUTTONS)],
  });
}

async function showStep2Lava(ctx) {
  const userId = String(ctx.user.user_id);
  store.setUserState(userId, 'faq_broken_p2a', { platform: 'lava' });
  await ctx.reply(
    'Первым делом проверьте папку «Спам» в вашей почте — ' +
    'письмо со ссылкой иногда попадает туда.\n\nПисьмо нашлось?',
    { attachments: [Keyboard.inlineKeyboard(SPAM_BUTTONS)] }
  );
}

async function showStep2Boosty(ctx) {
  const userId = String(ctx.user.user_id);
  store.setUserState(userId, 'faq_broken_p2b', { platform: 'boosty' });
  await ctx.reply(
    'Зайдите в личный кабинет Boosty → раздел «Мои покупки» — файл должен быть там.\n\nФайл отображается?',
    { attachments: [Keyboard.inlineKeyboard(BOOSTY_FILE_BUTTONS)] }
  );
}

async function showStep3(ctx) {
  const userId = String(ctx.user.user_id);
  store.setUserState(userId, 'awaiting_ticket');
  await ctx.reply(
    'Чтобы помочь быстрее, пожалуйста:\n\n' +
    '📝 Опишите что происходит (или что ожидали, а получили другое)\n' +
    '📎 Приложите скриншот, если возможно\n\n' +
    'Напишите прямо здесь 👇'
  );
}

module.exports = { showStep1, showStep2Lava, showStep2Boosty, showStep3 };
