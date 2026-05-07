export const sseClients = new Set()
export const SSE_MAX_CLIENTS = 200

export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of sseClients) {
    try { send(msg) } catch { sseClients.delete(send) }
  }
}
