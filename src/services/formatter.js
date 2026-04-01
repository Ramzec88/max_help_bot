// Если у пользователя есть username — делаем кликабельную ссылку на профиль
function formatUserLink(userName, username) {
  if (username) {
    return `[${userName}](https://max.ru/${username})`;
  }
  return userName;
}

function buildAdminMessage({ userName, username, text, variants, label }) {
  const userDisplay = formatUserLink(userName, username);
  return (
    `${label} Новый вопрос\n\n` +
    `👤 ${userDisplay}\n\n` +
    `💬 «${text}»\n\n` +
    `──────────────────────────\n` +
    `🤖 Варианты ответа:\n\n` +
    variants.map((v, i) => `${i + 1}. ${v}`).join('\n\n')
  );
}

function buildAnsweredMessage({ userName, username, text, replyText, label }) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const userDisplay = formatUserLink(userName, username);

  return (
    `${label} Вопрос\n\n` +
    `👤 ${userDisplay}\n` +
    `💬 «${text}»\n\n` +
    `✅ Ответ отправлен в ${time}\n` +
    `📤 «${replyText}»`
  );
}

module.exports = { buildAdminMessage, buildAnsweredMessage };
