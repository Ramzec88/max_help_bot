const { Keyboard } = require('@maxhub/max-bot-api');

const PLATFORM_BUTTONS = [[
  Keyboard.button.callback('Boosty', 'faq_broken:platform:boosty'),
  Keyboard.button.callback('Lava Top', 'faq_broken:platform:lava'),
  Keyboard.button.callback('Не помню / другое', 'faq_broken:platform:unknown'),
]];

const SPAM_BUTTONS = [[
  Keyboard.button.callback('✅ Да, нашла!', 'faq_broken:spam:yes'),
  Keyboard.button.callback('❌ Нет, не нашла', 'faq_broken:spam:no'),
]];

const BOOSTY_FILE_BUTTONS = [[
  Keyboard.button.callback('✅ Вижу, но не открывается', 'faq_broken:boosty:visible'),
  Keyboard.button.callback('❌ Не нахожу', 'faq_broken:boosty:missing'),
]];

async function showStep1(api, chatId) {
  await api.sendMessageToChat(chatId, '😟 Разберёмся вместе! Где вы покупали?', {
    attachments: [Keyboard.inlineKeyboard(PLATFORM_BUTTONS)],
  });
}

async function showStep2Lava(api, chatId) {
  await api.sendMessageToChat(
    chatId,
    'Первым делом проверьте папку «Спам» в вашей почте — ' +
    'письмо со ссылкой иногда попадает туда.\n\nПисьмо нашлось?',
    { attachments: [Keyboard.inlineKeyboard(SPAM_BUTTONS)] }
  );
}

async function showStep2Boosty(api, chatId) {
  await api.sendMessageToChat(
    chatId,
    'Зайдите снова по той же ссылке, по которой оформляли — откроется пост с текстом и файлами.\n\n' +
    'Предварительно отключите ВПН.\n\nФайл открылся?',
    { attachments: [Keyboard.inlineKeyboard(BOOSTY_FILE_BUTTONS)] }
  );
}

async function showStep3(api, chatId) {
  await api.sendMessageToChat(
    chatId,
    'Чтобы помочь быстрее, пожалуйста:\n\n' +
    '1️⃣ Опишите что происходит (или что ожидали, а получили другое)\n' +
    '2️⃣ Приложите скриншот, если возможно\n\n' +
    'Напишите прямо здесь 👇'
  );
}

module.exports = { showStep1, showStep2Lava, showStep2Boosty, showStep3 };
