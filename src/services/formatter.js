const { Keyboard } = require('@maxhub/max-bot-api');

const TOPIC_LABELS = {
  buy: 'Где купить',
  broken: 'Не работает покупка',
  compose: 'Хочу составить',
  compose_idea: 'Идея / запрос',
  other: 'Другой вопрос',
};

const PLATFORM_LABELS = {
  boosty: '🟠 Boosty',
  lava: '🔵 Lava Top',
  unknown: '❓ Неизвестно',
};

function ordinal(n) {
  return `${n}-е`;
}

function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDurationMin(from, to) {
  return Math.round((to - from) / 60000);
}

function formatUserLine(userName, username, userId) {
  if (username) return `[${userName}](https://max.ru/${username})`;
  return `${userName} (ссылка недоступна)`;
}

function buildContextLine(topic, platform, context) {
  const lines = [];
  const topicLabel = TOPIC_LABELS[topic] || topic;
  const platformLabel = platform !== 'unknown' ? ` • ${PLATFORM_LABELS[platform] || platform}` : '';
  lines.push(`🏷️ Тема: ${topicLabel}${platformLabel}`);

  if (topic === 'broken') {
    if (platform === 'lava' && context.spam_check) {
      const val = context.spam_check === 'yes' ? 'нашла (не открывается)' : 'не нашла';
      lines.push(`🔍 Письмо в спаме: ${val}`);
    }
    if (platform === 'boosty' && context.file_visible) {
      const val = context.file_visible === 'visible' ? 'виден (не открывается)' : 'не виден';
      lines.push(`🔍 Файл в кабинете: ${val}`);
    }
  }

  return lines.join('\n');
}

// ── Ticket card (sent to admin chat) ──────────────────────────────────────────

function buildTicketCard(ticket, hasMedia = false) {
  const time = formatTime(ticket.created_at);
  const userLine = formatUserLine(ticket.user_name, ticket.username, ticket.user_id);
  const contextLine = buildContextLine(ticket.topic, ticket.platform, ticket.context);

  const variantsText = ticket.ai_variants && ticket.ai_variants.length > 0
    ? '\n\n' + ticket.ai_variants.map((v, i) => `📝 Вариант ${i + 1}:\n${v}`).join('\n\n')
    : '';

  return (
    `${ticket.label} Новый вопрос • #${ticket.ticket_id}\n\n` +
    `👤 ${userLine}\n` +
    `🕐 ${time} | ${ordinal(ticket.appeal_count)} обращение\n` +
    `${contextLine}\n\n` +
    `💬 «${ticket.last_question}»` +
    (hasMedia ? '\n📸 [медиафайл прикреплён]' : '') +
    variantsText
  );
}

function buildTicketButtons(ticketId, variants) {
  const variantRows = variants.map((_, i) => [
    Keyboard.button.callback(`Вариант ${i + 1}`, `reply:${ticketId}:${i}`),
  ]);
  return [
    ...variantRows,
    [Keyboard.button.callback('✍️ Свой ответ', `custom:${ticketId}`)],
    [
      Keyboard.button.callback('✅ Решён', `ticket:resolve:${ticketId}`),
      Keyboard.button.callback('✗ Не решён', `ticket:return:${ticketId}`),
    ],
  ];
}

// ── Card updates ──────────────────────────────────────────────────────────────

function buildAnsweredCard(ticket, replyText) {
  const time = formatTime(new Date());
  const duration = formatDurationMin(ticket.created_at, new Date());
  const userLine = formatUserLine(ticket.user_name, ticket.username, ticket.user_id);

  return (
    `${ticket.label} Вопрос • #${ticket.ticket_id}\n\n` +
    `👤 ${userLine}\n` +
    `💬 «${ticket.last_question}»\n\n` +
    `✅ Тикет #${ticket.ticket_id} закрыт • ${time} (${duration} мин)\n` +
    `📤 «${replyText}»`
  );
}

function buildResolvedCard(ticket) {
  const time = formatTime(new Date());
  const duration = formatDurationMin(ticket.created_at, new Date());
  const userLine = formatUserLine(ticket.user_name, ticket.username, ticket.user_id);

  return (
    `${ticket.label} Вопрос • #${ticket.ticket_id}\n\n` +
    `👤 ${userLine}\n` +
    `💬 «${ticket.last_question}»\n\n` +
    `✅ Тикет #${ticket.ticket_id} закрыт • ${time} (${duration} мин)`
  );
}

function buildReturnedCard(ticket) {
  const userLine = formatUserLine(ticket.user_name, ticket.username, ticket.user_id);

  return (
    `${ticket.label} Вопрос • #${ticket.ticket_id}\n\n` +
    `👤 ${userLine}\n` +
    `💬 «${ticket.last_question}»\n\n` +
    `🔄 Тикет #${ticket.ticket_id} возвращён в очередь`
  );
}

// ── Additional message notification ──────────────────────────────────────────

function buildAddMessageNotification(ticket, text) {
  const contextLine = buildContextLine(ticket.topic, ticket.platform, ticket.context);
  return (
    `📩 Новое сообщение от ${ticket.user_name} (#${ticket.ticket_id})\n` +
    `${contextLine}\n` +
    `💬 «${text}»`
  );
}

// ── Rating message sent to user ───────────────────────────────────────────────

const RATING_BUTTONS = (ticketId) => [[
  Keyboard.button.callback('👍 Да, спасибо!', `rating:positive:${ticketId}`),
  Keyboard.button.callback('👎 Нет, не помогло', `rating:negative:${ticketId}`),
]];

function buildRatingMessage(ticketId) {
  return {
    text: 'Мы ответили на ваш вопрос. Помогло? 🐻',
    buttons: RATING_BUTTONS(ticketId),
  };
}

module.exports = {
  buildTicketCard, buildTicketButtons,
  buildAnsweredCard, buildResolvedCard, buildReturnedCard,
  buildAddMessageNotification,
  buildRatingMessage,
};
