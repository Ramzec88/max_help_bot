// In-memory storage replacing Supabase.
// All state resets on server restart — acceptable for a support bot.

let _ticketCounter = 0;

const tickets = new Map();          // ticketId (number) → ticket object
const userActiveTicket = new Map(); // userId → ticketId
const userAppealCount = new Map();  // userId → total tickets created
const userStartShown = new Set();   // userIds that received /start welcome
const userState = new Map();        // userId → { state, context }
const adminModes = new Map();       // adminId → { mode, targetTicketId, timeoutHandle }

let _pauseUntil = null;

// ── Tickets ──────────────────────────────────────────────────────────────────

function createTicket(data) {
  const ticketId = ++_ticketCounter;
  const userId = String(data.user_id);
  const appealCount = (userAppealCount.get(userId) || 0) + 1;
  userAppealCount.set(userId, appealCount);

  const ticket = {
    ticket_id: ticketId,
    user_id: userId,
    chat_id: String(data.chat_id),
    user_name: data.user_name || `Пользователь ${userId}`,
    username: data.username || null,
    topic: data.topic || 'other',
    platform: data.platform || 'unknown',
    context: data.context || {},
    messages: data.messages ? [...data.messages] : [],
    last_question: data.last_question || '',
    ai_variants: data.ai_variants || [],
    label: data.label || '🟡',
    admin_msg_id: null,
    status: 'open',
    rating: null,
    appeal_count: appealCount,
    created_at: new Date(),
    answered_at: null,
  };

  tickets.set(ticketId, ticket);
  userActiveTicket.set(userId, ticketId);
  return ticket;
}

function getTicket(ticketId) {
  return tickets.get(Number(ticketId)) || null;
}

function getOpenTicketByUserId(userId) {
  const ticketId = userActiveTicket.get(String(userId));
  if (!ticketId) return null;
  const ticket = tickets.get(ticketId);
  return ticket && ticket.status === 'open' ? ticket : null;
}

function updateTicket(ticketId, data) {
  const ticket = tickets.get(Number(ticketId));
  if (!ticket) return null;
  Object.assign(ticket, data);
  return ticket;
}

function closeTicket(ticketId) {
  const ticket = tickets.get(Number(ticketId));
  if (!ticket) return null;
  ticket.status = 'answered';
  ticket.answered_at = new Date();
  userActiveTicket.delete(ticket.user_id);
  return ticket;
}

function addMessageToTicket(ticketId, text) {
  const ticket = tickets.get(Number(ticketId));
  if (!ticket) return;
  ticket.messages.push(text);
  ticket.last_question = text;
}

// ── User state machine ────────────────────────────────────────────────────────
// states: idle | faq_buy | faq_broken_p1 | faq_broken_p2a | faq_broken_p2b
//         | awaiting_ticket | ticket_open | rating_pending

function getUserState(userId) {
  return userState.get(String(userId)) || { state: 'idle', context: {} };
}

function setUserState(userId, state, extraContext = {}) {
  const current = userState.get(String(userId)) || { state: 'idle', context: {} };
  userState.set(String(userId), {
    state,
    context: { ...current.context, ...extraContext },
  });
}

function resetUserState(userId) {
  userState.set(String(userId), { state: 'idle', context: {} });
}

function hasSeenStart(userId) {
  return userStartShown.has(String(userId));
}

function markStartShown(userId) {
  userStartShown.add(String(userId));
}

// ── Admin modes ───────────────────────────────────────────────────────────────

function setAdminMode(adminId, data) {
  const existing = adminModes.get(String(adminId));
  if (existing?.timeoutHandle) clearTimeout(existing.timeoutHandle);
  adminModes.set(String(adminId), data);
}

function getAdminMode(adminId) {
  return adminModes.get(String(adminId)) || null;
}

function clearAdminMode(adminId) {
  const mode = adminModes.get(String(adminId));
  if (mode?.timeoutHandle) clearTimeout(mode.timeoutHandle);
  adminModes.delete(String(adminId));
}

// ── Pause mode ────────────────────────────────────────────────────────────────

function setPause(until) {
  _pauseUntil = until;
}

function clearPause() {
  _pauseUntil = null;
}

function isPaused() {
  if (!_pauseUntil) return false;
  if (new Date() > _pauseUntil) { _pauseUntil = null; return false; }
  return true;
}

function getPauseUntil() {
  return _pauseUntil;
}

module.exports = {
  createTicket, getTicket, getOpenTicketByUserId, updateTicket, closeTicket, addMessageToTicket,
  getUserState, setUserState, resetUserState, hasSeenStart, markStartShown,
  setAdminMode, getAdminMode, clearAdminMode,
  setPause, clearPause, isPaused, getPauseUntil,
};
