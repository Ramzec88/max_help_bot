// Типы медиа, которые можно переслать по токену
const MEDIA_TYPES = ['image', 'video', 'audio', 'file', 'sticker', 'location', 'share'];

const MEDIA_LABELS = {
  image: 'изображение',
  video: 'видео',
  audio: 'аудио',
  file: 'файл',
  sticker: 'стикер',
  location: 'геолокацию',
  share: 'ссылку',
};

// Извлечь медиа-вложения из входящего сообщения (без inline_keyboard)
function extractMediaAttachments(message) {
  const attachments = message?.body?.attachments;
  if (!attachments?.length) return [];
  return attachments.filter((att) => MEDIA_TYPES.includes(att.type));
}

// Текстовое описание вложений для AI-промпта и карточки
function describeAttachments(attachments) {
  if (!attachments.length) return '';
  const labels = attachments.map((att) => MEDIA_LABELS[att.type] || att.type);
  return `[прислал(а): ${labels.join(', ')}]`;
}

module.exports = { extractMediaAttachments, describeAttachments };
