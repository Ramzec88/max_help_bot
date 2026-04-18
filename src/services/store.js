// Hybrid storage:
// - support_dialogs and admin_modes → Supabase (persistent)
// - user states, pause mode, timeout handles → in-memory (transient, OK to reset on restart)

const supabase = require('./supabase');

// ── In-memory only ────────────────────────────────────────────────────────────
const userStartShown = new Set();
const userState = new Map();       // userId → { state, context }
const timeoutHandles = new Map();  // adminId → timeoutHandle
let _pauseUntil = null;

// ── Tickets (support_dialogs) ─────────────────────────────────────────────────

async function createTicket(data) {
  const userId = String(data.user_id);

  // Count previous tickets for this user
  const { count } = await supabase
    .from('support_dialogs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  const appealCount = (count || 0) + 1;

  const row = {
    user_id: userId,
    chat_id: Number(data.chat_id),
    user_name: data.user_name || `Пользователь ${userId}`,
    username: data.username || null,
    topic: data.topic || 'other',
    platform: data.platform || 'unknown',
    context: { ...(data.context || {}), label: data.label || '🟡' },
    last_question: data.last_question || '',
    ai_variants: data.ai_variants || [],
    status: 'open',
    appeal_count: appealCount,
  };

  const { data: inserted, error } = await supabase
    .from('support_dialogs')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`createTicket: ${error.message}`);
  return _mapRow(inserted);
}

async function getTicket(ticketId) {
  const { data, error } = await supabase
    .from('support_dialogs')
    .select('*')
    .eq('ticket_id', Number(ticketId))
    .single();
  if (error || !data) return null;
  return _mapRow(data);
}

async function getOpenTicketByUserId(userId) {
  const { data, error } = await supabase
    .from('support_dialogs')
    .select('*')
    .eq('user_id', String(userId))
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return _mapRow(data);
}

async function updateTicket(ticketId, patch) {
  const { data, error } = await supabase
    .from('support_dialogs')
    .update(patch)
    .eq('ticket_id', Number(ticketId))
    .select()
    .single();
  if (error) throw new Error(`updateTicket: ${error.message}`);
  return _mapRow(data);
}

async function closeTicket(ticketId) {
  return updateTicket(ticketId, { status: 'answered', answered_at: new Date().toISOString() });
}

async function addMessageToTicket(ticketId, text) {
  // support_dialogs has no messages array — update last_question only
  await updateTicket(ticketId, { last_question: text });
}

// Map DB row (snake_case, jsonb) → ticket object used throughout the app
function _mapRow(row) {
  return {
    ticket_id: row.ticket_id,
    user_id: String(row.user_id),
    chat_id: Number(row.chat_id),
    user_name: row.user_name,
    username: row.username,
    topic: row.topic,
    platform: row.platform,
    context: row.context || {},
    messages: row.last_question ? [row.last_question] : [],
    last_question: row.last_question || '',
    ai_variants: row.ai_variants || [],
    label: (row.context && row.context.label) || '🟡',
    admin_msg_id: row.admin_msg_id || null,
    status: row.status,
    rating: row.rating,
    appeal_count: row.appeal_count || 1,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    answered_at: row.answered_at ? new Date(row.answered_at) : null,
  };
}

// ── User state machine (in-memory) ────────────────────────────────────────────

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

async function hasSeenStart(userId) {
  if (userStartShown.has(String(userId))) return true;
  // Fallback: check if user has any tickets in DB (survives server restarts)
  const { count, error } = await supabase
    .from('support_dialogs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', String(userId));
  const seen = !error && (count || 0) > 0;
  if (seen) userStartShown.add(String(userId));
  return seen;
}

function markStartShown(userId) {
  userStartShown.add(String(userId));
}

// ── Admin modes (admin_modes table) ──────────────────────────────────────────

async function setAdminMode(adminId, data) {
  // Clear existing timeout handle if any
  const existing = timeoutHandles.get(String(adminId));
  if (existing) { clearTimeout(existing); timeoutHandles.delete(String(adminId)); }

  // Store timeout handle in-memory, rest in DB
  if (data.timeoutHandle) {
    timeoutHandles.set(String(adminId), data.timeoutHandle);
  }

  const { error } = await supabase
    .from('admin_modes')
    .upsert({
      admin_id: Number(adminId),
      mode: data.mode,
      target_ticket: data.targetTicketId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'admin_id' });

  if (error) throw new Error(`setAdminMode: ${error.message}`);
}

async function getAdminMode(adminId) {
  const { data, error } = await supabase
    .from('admin_modes')
    .select('*')
    .eq('admin_id', Number(adminId))
    .maybeSingle();
  if (error || !data) return null;
  return {
    mode: data.mode,
    targetTicketId: data.target_ticket,
    timeoutHandle: timeoutHandles.get(String(adminId)) || null,
  };
}

async function clearAdminMode(adminId) {
  const handle = timeoutHandles.get(String(adminId));
  if (handle) { clearTimeout(handle); timeoutHandles.delete(String(adminId)); }

  await supabase.from('admin_modes').delete().eq('admin_id', Number(adminId));
}

// ── Pause mode (in-memory) ────────────────────────────────────────────────────

function setPause(until) { _pauseUntil = until; }
function clearPause() { _pauseUntil = null; }
function isPaused() {
  if (!_pauseUntil) return false;
  if (new Date() > _pauseUntil) { _pauseUntil = null; return false; }
  return true;
}
function getPauseUntil() { return _pauseUntil; }

module.exports = {
  createTicket, getTicket, getOpenTicketByUserId, updateTicket, closeTicket, addMessageToTicket,
  getUserState, setUserState, resetUserState, hasSeenStart, markStartShown,
  setAdminMode, getAdminMode, clearAdminMode,
  setPause, clearPause, isPaused, getPauseUntil,
};
