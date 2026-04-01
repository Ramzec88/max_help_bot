function buildAdminMessage({ userName, text, variants, label }) {
  return (
    `${label} Новый вопрос\n\n` +
    `👤 ${userName}\n\n` +
    `💬 «${text}»\n\n` +
    `──────────────────────────\n` +
    `🤖 Варианты ответа:\n\n` +
    variants.map((v, i) => `${i + 1}. ${v}`).join('\n\n')
  );
}

function buildAnsweredMessage({ userName, text, replyText, label }) {
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    `${label} Вопрос\n\n` +
    `👤 ${userName}\n` +
    `💬 «${text}»\n\n` +
    `✅ Ответ отправлен в ${time}\n` +
    `📤 «${replyText}»`
  );
}

module.exports = { buildAdminMessage, buildAnsweredMessage };
