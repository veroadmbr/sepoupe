/**
 * api/pluggy-token.js
 * POST /api/pluggy-token
 *
 * Returns a short-lived Pluggy Connect Token so the frontend can
 * open the Pluggy Widget without exposing the API secret.
 *
 * Flow:
 *  1. Frontend calls POST /api/pluggy-token
 *  2. This function authenticates with Pluggy and returns a connectToken
 *  3. Frontend opens Pluggy Widget with that token
 *  4. User selects bank and authenticates inside the widget
 *  5. Widget returns an itemId → frontend calls /api/pluggy-sync
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
  const data = await res.json()
  return data.apiKey
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Basic CORS for your Vercel frontend domain
  const origin = req.headers.get('origin') || ''
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  try {
    // 1. Get Pluggy API key
    const apiKey = await getPluggyApiKey()

    // 2. Create a Connect Token (valid for 30 min)
    const tokenRes = await fetch(`${PLUGGY_API}/connect_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        // Optional: pass a webhook URL to receive sync notifications
        // webhookUrl: 'https://yourapp.vercel.app/api/pluggy-webhook',
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      throw new Error(`Connect token failed: ${err}`)
    }

    const { accessToken } = await tokenRes.json()

    return new Response(JSON.stringify({ accessToken }), { status: 200, headers })
  } catch (err) {
    console.error('[pluggy-token]', err)
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers }
    )
  }
}
