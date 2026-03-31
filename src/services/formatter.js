function buildAdminMessage({ userId, userName, text, variants, label }) {
  const messageText =
    `${label} Новый вопрос\n\n` +
    `👤 ${userName}\n\n` +
    `💬 «${text}»\n\n` +
    `──────────────────────────\n` +
    `🤖 Варианты ответа:\n\n` +
    variants.map((v, i) => `${i + 1}. ${v}`).join('\n\n');

  const buttons = [
    variants.map((_, i) => ({
      type: 'callback',
      text: `Вариант ${i + 1}`,
      payload: `reply:${userId}:${i}`,
    })),
    [
      {
        type: 'callback',
        text: '✍️ Свой ответ',
        payload: `custom:${userId}`,
      },
    ],
  ];

  return { text: messageText, buttons };
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
