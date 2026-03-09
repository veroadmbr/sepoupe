/**
 * api/pluggy-webhook.js
 * POST /api/pluggy-webhook
 *
 * Pluggy calls this URL when an item finishes syncing or has an error.
 * Use this to notify the frontend (via Supabase Realtime or polling).
 *
 * Configure in Pluggy dashboard → Webhooks → Add URL:
 *   https://sepoupe.vercel.app/api/pluggy-webhook
 */

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const event = await req.json()

    // event.event: ITEM_CREATED | ITEM_UPDATED | ITEM_ERROR | ITEM_LOGIN_ERROR
    console.log('[pluggy-webhook]', event.event, event.itemId)

    // TODO: write event to Supabase so frontend can react in real-time
    // const { createClient } = await import('@supabase/supabase-js')
    // const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    // await supabase.from('bank_sync_events').insert({ item_id: event.itemId, event: event.event })

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[pluggy-webhook]', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
