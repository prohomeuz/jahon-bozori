import nodeFetch from 'node-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { copyFileSync, unlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'
import { db, dbPath } from '../db.js'

const _socksAgent = process.env.SOCKS_PROXY ? new SocksProxyAgent(process.env.SOCKS_PROXY, { maxSockets: 50 }) : null

export function proxiedFetch(url, opts = {}, timeoutMs = 15_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const finalOpts = { ...opts, signal: controller.signal }
  if (_socksAgent) finalOpts.agent = _socksAgent
  const fn = _socksAgent ? nodeFetch : fetch
  return fn(url, finalOpts).finally(() => clearTimeout(timer))
}

export const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID ?? '7874777577'

export async function sendBackupFile(chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return false

  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)') } catch {}
  const tmpPath = pathJoin(tmpdir(), `jahon_backup_${Date.now()}.sqlite`)
  try { copyFileSync(dbPath, tmpPath) }
  catch (e) { console.error('[backup] copy xato:', e.message); return false }

  const uzbNow  = new Date(Date.now() + 5 * 3600_000)
  const fname   = `jahon_${uzbNow.toISOString().slice(0,10)}_${String(uzbNow.getUTCHours()).padStart(2,'0')}00.sqlite`
  const fileData = readFileSync(tmpPath)
  try { unlinkSync(tmpPath) } catch {}

  const fd = new FormData()
  fd.append('chat_id',  String(chatId))
  fd.append('document', new Blob([fileData], { type: 'application/octet-stream' }), fname)
  try {
    const res  = await proxiedFetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.ok) { console.log('[backup] OK → chatId:', chatId); return true }
    else { console.error('[backup] Telegram xato:', JSON.stringify(json)); return false }
  } catch (e) { console.error('[backup] fetch xato:', e.message); return false }
}

export async function notifyBackupAll() {
  const uzbHour = new Date(Date.now() + 5 * 3600_000).getUTCHours()
  if (uzbHour < 6 || uzbHour >= 21) {
    console.log('[backup] soat', uzbHour, "UZB — vaqt tashqarida (06:00–21:00), o'tkazib yuborildi")
    return
  }
  await sendBackupFile(OWNER_CHAT_ID)
}

export async function setupTelegramWebhook() {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const domain = process.env.WEBHOOK_DOMAIN
  if (!token || !domain) {
    if (token && !domain) console.log('[telegram] WEBHOOK_DOMAIN yo\'q — webhook o\'rnatilmadi')
    return
  }
  const webhookUrl = `${domain.replace(/\/$/, '')}/api/telegram/webhook`
  try {
    const res = await proxiedFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: false }),
    })
    const json = await res.json()
    if (json.ok) console.log(`[telegram] Webhook o'rnatildi: ${webhookUrl}`)
    else console.error('[telegram] Webhook xato:', json.description)
  } catch (e) { console.error('[telegram] Webhook setup xato:', e.message) }
}

let _webhookWarnedAt = 0
export async function checkWebhookHealth() {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const domain = process.env.WEBHOOK_DOMAIN
  if (!token || !domain) return
  try {
    const info = await proxiedFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      .then(r => r.json()).then(j => j.ok ? j.result : null)
    if (!info) return
    const expectedUrl = `${domain.replace(/\/$/, '')}/api/telegram/webhook`
    if (info.url !== expectedUrl) {
      await setupTelegramWebhook()
      const info2 = await proxiedFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
        .then(r => r.json()).then(j => j.ok ? j.result : null)
      if (!info2 || info2.url === expectedUrl) return
    }
    const hasProblem = info.url !== expectedUrl || info.pending_update_count > 100
    if (!hasProblem) return
    const now = Date.now()
    if (now - _webhookWarnedAt < 2 * 3600_000) return
    _webhookWarnedAt = now
    await proxiedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: OWNER_CHAT_ID,
        text: `⚠️ <b>Webhook muammo hal etilmadi</b>\n\nURL: ${info.url || 'yo\'q'}\nPending: ${info.pending_update_count}`,
        parse_mode: 'HTML',
      }),
    }).catch(() => {})
  } catch (e) { console.error('[telegram] Webhook health check xato:', e.message) }
}
