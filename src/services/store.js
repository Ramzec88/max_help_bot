// In-memory хранилище вместо Supabase
// При перезапуске сервера данные сбрасываются — для support-бота это приемлемо

// userId → { chatId, userName, text, variants, adminMsgId, status }
const dialogs = new Map();

// adminId → { mode: 'awaiting_reply', targetUserId }
const adminModes = new Map();

function saveDialog(userId, data) {
  const existing = dialogs.get(String(userId)) || {};
  dialogs.set(String(userId), { ...existing, ...data, status: data.status || existing.status || 'open' });
}

function getDialog(userId) {
  return dialogs.get(String(userId)) || null;
}

function setAdminMode(adminId, data) {
  adminModes.set(String(adminId), data);
}

function getAdminMode(adminId) {
  return adminModes.get(String(adminId)) || null;
}

function clearAdminMode(adminId) {
  adminModes.delete(String(adminId));
}

module.exports = { saveDialog, getDialog, setAdminMode, getAdminMode, clearAdminMode };
