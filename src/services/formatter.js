// Формируем упоминание пользователя:
// - если есть username → [Имя](https://max.ru/username)
// - иначе → @[user_id] Имя (mention по ID)
function formatUserLink(userName, username, userId) {
  if (username) {
    return `[${userName}](https://max.ru/${username})`;
  }
  return `@[${userId}] ${userName}`;
}

function buildAdminMessage({ userName, username, userId, text, variants, label }) {
  const userDisplay = formatUserLink(userName, username, userId);
  return (
    `${label} Новый вопрос\n\n` +
    `👤 ${userDisplay}\n\n` +
    `💬 «${text}»\n\n` +
    `──────────────────────────\n` +
    `🤖 Варианты ответа:\n\n` +
    variants.map((v, i) => `${i + 1}. ${v}`).join('\n\n')
  );
}

function buildAnsweredMessage({ userName, username, userId, text, replyText, label }) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const userDisplay = formatUserLink(userName, username, userId);

  return (
    `${label} Вопрос\n\n` +
    `👤 ${userDisplay}\n` +
    `💬 «${text}»\n\n` +
    `✅ Ответ отправлен в ${time}\n` +
    `📤 «${replyText}»`
  );
}

module.exports = { buildAdminMessage, buildAnsweredMessage };
