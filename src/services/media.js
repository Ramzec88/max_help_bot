// Типы медиа, которые можно переслать по токену.
// 'share' сюда намеренно не входит: это авто-превью ссылки, которое клиент
// MAX сам прикрепляет к сообщению с URL в тексте — сама ссылка уже есть в
// тексте и будет заново отрисована превью на стороне получателя, а
// пересылать такое вложение отдельно нельзя (нет валидного token/url для
// исходящего запроса — падает с errors.send-message.empty).
const MEDIA_TYPES = ['image', 'video', 'audio', 'file', 'sticker', 'location'];

const MEDIA_LABELS = {
  image: 'изображение',
  video: 'видео',
  audio: 'аудио',
  file: 'файл',
  sticker: 'стикер',
  location: 'геолокацию',
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
    default:
      return null;
  }
}

module.exports = { extractMediaAttachments, describeAttachments, toOutgoingAttachment };
