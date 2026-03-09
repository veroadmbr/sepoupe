/**
 * api/pluggy-sync.js
 * POST /api/pluggy-sync  { itemId, from?, to? }
 *
 * After the user authenticates via the Pluggy Widget, the widget
 * returns an itemId. This endpoint:
 *  1. Authenticates with Pluggy
 *  2. Lists accounts linked to that item
 *  3. Fetches transactions for each account (last 90 days by default)
 *  4. Normalises and returns them to the frontend
 *
 * The frontend then stores them in React state (and optionally Supabase).
 */

export const config = { runtime: 'edge' }

const PLUGGY_API = 'https://api.pluggy.ai'

async function getPluggyApiKey() {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId:     process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`)
  const { apiKey } = await res.json()
  return apiKey
}

// Map Pluggy category → Se Poupe category
const CAT_MAP = {
  'Food and Beverage':      'Alimentação',
  'Restaurants':            'Alimentação',
  'Supermarket':            'Alimentação',
  'Transport':              'Transporte',
  'Fuel':                   'Transporte',
  'Ride':                   'Transporte',
  'Health and Beauty':      'Saúde',
  'Pharmacy':               'Saúde',
  'Housing':                'Moradia',
  'Rent':                   'Moradia',
  'Utilities':              'Moradia',
  'Education':              'Educação',
  'Entertainment':          'Lazer',
  'Streaming':              'Lazer',
  'Sports':                 'Lazer',
  'Income':                 'Receita',
  'Transfer':               'Transferência',
  'Shopping':               'Compras',
}

function mapCategory(pluggyCategory) {
  if (!pluggyCategory) return 'Outros'
  for (const [key, val] of Object.entries(CAT_MAP)) {
    if (pluggyCategory.toLowerCase().includes(key.toLowerCase())) return val
  }
  return 'Outros'
}

function normalizeTxn(txn, accountName) {
  return {
    id:       txn.id,
    date:     txn.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    desc:     txn.description || txn.merchant?.name || 'Transação',
    amount:   txn.type === 'DEBIT' ? -(Math.abs(txn.amount)) : Math.abs(txn.amount),
    category: mapCategory(txn.category),
    account:  accountName,
    raw:      txn,
  }
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || ''
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers })

  try {
    const { itemId, from, to } = await req.json()
    if (!itemId) return new Response(JSON.stringify({ error: 'itemId required' }), { status: 400, headers })

    const apiKey = await getPluggyApiKey()

    const reqHeaders = { 'Content-Type': 'application/json', 'X-API-KEY': apiKey }

    // 1. Get item (connection) info
    const itemRes = await fetch(`${PLUGGY_API}/items/${itemId}`, { headers: reqHeaders })
    if (!itemRes.ok) throw new Error(`Item fetch failed: ${itemRes.status}`)
    const item = await itemRes.json()

    // 2. List accounts for this item
    const accRes = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, { headers: reqHeaders })
    if (!accRes.ok) throw new Error(`Accounts fetch failed: ${accRes.status}`)
    const { results: accounts } = await accRes.json()

    // 3. Fetch transactions for each account (default: last 90 days)
    const today = new Date()
    const defaultFrom = new Date(today)
    defaultFrom.setDate(today.getDate() - 90)

    const fromDate = from || defaultFrom.toISOString().slice(0, 10)
    const toDate   = to   || today.toISOString().slice(0, 10)

    const allTxns = []

    for (const account of accounts) {
      // Paginate if needed (Pluggy returns max 500 per page)
      let page = 1
      let totalPages = 1

      do {
        const txnRes = await fetch(
          `${PLUGGY_API}/transactions?accountId=${account.id}&from=${fromDate}&to=${toDate}&pageSize=500&page=${page}`,
          { headers: reqHeaders }
        )
        if (!txnRes.ok) break

        const { results, totalPages: tp } = await txnRes.json()
        totalPages = tp || 1

        for (const txn of results || []) {
          allTxns.push(normalizeTxn(txn, account.name || account.type))
        }

        page++
      } while (page <= totalPages && page <= 5) // max 5 pages = 2500 txns
    }

    // Sort newest first
    allTxns.sort((a, b) => b.date.localeCompare(a.date))

    return new Response(JSON.stringify({
      itemId,
      connectorName: item.connector?.name || 'Banco',
      connectorId:   item.connector?.id,
      accounts:      accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance })),
      transactions:  allTxns,
      count:         allTxns.length,
      syncedAt:      new Date().toISOString(),
    }), { status: 200, headers })

  } catch (err) {
    console.error('[pluggy-sync]', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers })
  }
}
