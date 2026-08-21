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

// Входящее вложение (Attachment) содержит служебные поля (filename, size,
// width, photo_id и т.д.), которых API для исходящих вложений (AttachmentRequest)
// не ожидает и из-за которых пересылка отклоняется целиком. Пересобираем
// вложение только из полей, допустимых на отправку.
function toOutgoingAttachment(att) {
  switch (att?.type) {
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      if (!att.payload?.token) return null;
      return { type: att.type, payload: { token: att.payload.token } };
    case 'sticker':
      if (!att.payload?.code) return null;
      return { type: 'sticker', payload: { code: att.payload.code } };
    case 'location':
      if (att.latitude == null || att.longitude == null) return null;
      return { type: 'location', latitude: att.latitude, longitude: att.longitude };
    case 'share':
      if (!att.payload?.token && !att.payload?.url) return null;
      return { type: 'share', payload: { token: att.payload?.token, url: att.payload?.url } };
    default:
      return null;
  }
}

module.exports = { extractMediaAttachments, describeAttachments, toOutgoingAttachment };
