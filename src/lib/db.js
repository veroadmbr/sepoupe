/**
 * db.js — poupAI data layer
 *
 * Replaces every window.storage call with Supabase queries.
 * All functions keep the same signatures used in App.jsx so
 * the dashboard component needs zero changes.
 */

import { supabase } from './supabaseClient.js'

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
  return data.user
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function saveProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── PLAN ────────────────────────────────────────────────────────────────────

export async function loadPlan(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return data?.plan || 'free'
}

export async function savePlan(userId, plan) {
  await supabase
    .from('profiles')
    .upsert({ id: userId, plan, updated_at: new Date().toISOString() })
}

// ─── USAGE ───────────────────────────────────────────────────────────────────

const curMonth = () => new Date().toISOString().slice(0, 7)

export async function loadUsage(userId) {
  const month = curMonth()
  const { data } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .single()
  return data || { month, ai_imports: 0, ai_analysis: 0 }
}

export async function bumpUsage(userId, key) {
  const month = curMonth()
  // upsert: insert or increment
  const { data: existing } = await supabase
    .from('usage')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .single()

  const current = existing || { user_id: userId, month, ai_imports: 0, ai_analysis: 0 }
  current[key] = (current[key] || 0) + 1

  await supabase.from('usage').upsert(current)
}

// ─── EXPENSES ────────────────────────────────────────────────────────────────

export async function loadExpenses(userId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addExpense(userId, expense) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ user_id: userId, ...expense })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(expenseId) {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
}

// ─── GOALS ───────────────────────────────────────────────────────────────────

export async function loadGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addGoal(userId, goal) {
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...goal })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGoal(goalId) {
  const { error } = await supabase.from('goals').delete().eq('id', goalId)
  if (error) throw error
}

// ─── MONTHLY PLANNING ────────────────────────────────────────────────────────

export async function loadMonthlyPlanning(userId) {
  const { data, error } = await supabase
    .from('monthly_planning')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error) throw error

  // Convert flat rows → { "2025-01": [{...}, ...] } map
  const map = {}
  for (const row of data || []) {
    if (!map[row.month]) map[row.month] = []
    map[row.month].push({
      id: row.id,
      name: row.name,
      value: row.value,
      type: row.type,
      category: row.category,
    })
  }
  return map
}

export async function addMonthlyExpense(userId, month, expense) {
  const { data, error } = await supabase
    .from('monthly_planning')
    .insert({ user_id: userId, month, ...expense })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMonthlyExpense(id, updates) {
  const { error } = await supabase
    .from('monthly_planning')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteMonthlyExpense(id) {
  const { error } = await supabase.from('monthly_planning').delete().eq('id', id)
  if (error) throw error
}

// ─── SALARY ──────────────────────────────────────────────────────────────────

export async function loadSalary(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('salary')
    .eq('id', userId)
    .single()
  return data?.salary || ''
}

export async function saveSalary(userId, salary) {
  await supabase
    .from('profiles')
    .upsert({ id: userId, salary, updated_at: new Date().toISOString() })
}

// ─── COOKIES ─────────────────────────────────────────────────────────────────
// Stored in localStorage (no user auth needed, just browser preference)

export function loadCookiePrefs() {
  try {
    const raw = localStorage.getItem('sp:cookies')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveCookiePrefs(prefs) {
  try { localStorage.setItem('sp:cookies', JSON.stringify(prefs)) } catch {}
}
