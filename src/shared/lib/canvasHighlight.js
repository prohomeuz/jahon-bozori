// Canvas-based floor plan highlight utilities shared between bolim and admin pages.

const OVERLAY_LOADERS = {
  A: [
    () => import('@/pages/bolim/config/aRectOverlays').then(m => m.A_RECT_OVERLAYS),
    () => import('@/pages/bolim/config/aFloor2RectOverlays').then(m => m.A_FLOOR2_RECT_OVERLAYS),
  ],
  B: [
    () => import('@/pages/bolim/config/bRectOverlays').then(m => m.B_RECT_OVERLAYS),
    () => import('@/pages/bolim/config/bFloor2RectOverlays').then(m => m.B_FLOOR2_RECT_OVERLAYS),
  ],
  C: [
    () => import('@/pages/bolim/config/cRectOverlays').then(m => m.C_RECT_OVERLAYS),
    () => import('@/pages/bolim/config/cFloor2RectOverlays').then(m => m.C_FLOOR2_RECT_OVERLAYS),
  ],
}

export async function getBolimViewBox(blockId, floor, bolimNum) {
  try {
    const overlays = await OVERLAY_LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    return overlays?.[bolimNum]?.viewBox ?? null
  } catch { return null }
}

export async function getAptRect(blockId, floor, bolimNum, address) {
  try {
    const overlays = await OVERLAY_LOADERS[blockId]?.[floor === 2 ? 1 : 0]?.()
    const bolimData = overlays?.[bolimNum]
    if (!bolimData) return null
    const rect = bolimData.rects?.find(r => r.id === address)
    return rect ? { rect, viewBox: bolimData.viewBox } : null
  } catch { return null }
}

export function pathBBox(d) {
  const nums = d.match(/[-\d.]+/g)?.map(Number) ?? []
  const xs = [], ys = []
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]) }
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

export async function imgToDataUrl(url) {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch { return null }
}

export async function drawHighlight(imgSrc, rect, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!rect || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw, sy = img.naturalHeight / vh
  let bboxVb
  if (rect.d) {
    ctx.save(); ctx.scale(sx, sy)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fill(new Path2D(rect.d))
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = vw / 90; ctx.stroke(new Path2D(rect.d))
    ctx.restore(); bboxVb = pathBBox(rect.d)
  } else {
    const lw = Math.max(4, img.naturalWidth / 250)
    ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = lw; ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
    bboxVb = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const bboxPx = bboxVb.x * sx, bboxPy = bboxVb.y * sy
  const bboxPw = bboxVb.width * sx, bboxPh = bboxVb.height * sy
  const padX = bboxPw * 5, padY = bboxPh * 1.5
  const cx = Math.max(0, bboxPx - padX), cy = Math.max(0, bboxPy - padY)
  const cw = Math.min(img.naturalWidth - cx, bboxPw + padX * 2)
  const ch = Math.min(img.naturalHeight - cy, bboxPh + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = cw; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return cropped.toDataURL('image/png')
}

export async function drawWcHighlight(imgSrc, points, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!points || !viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw, sy = img.naturalHeight / vh
  const coords = points.trim().split(/[\s,]+/).map(Number)
  const path = new Path2D()
  for (let i = 0; i + 1 < coords.length; i += 2) {
    if (i === 0) path.moveTo(coords[i] * sx, coords[i + 1] * sy)
    else path.lineTo(coords[i] * sx, coords[i + 1] * sy)
  }
  path.closePath()
  ctx.fillStyle = 'rgba(56,189,248,0.35)'; ctx.fill(path)
  ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = Math.max(4, vw / 130); ctx.stroke(path)
  const xs = [], ys = []
  for (let i = 0; i + 1 < coords.length; i += 2) { xs.push(coords[i] * sx); ys.push(coords[i + 1] * sy) }
  const bboxPx = Math.min(...xs), bboxPy = Math.min(...ys)
  const bboxPw = Math.max(...xs) - bboxPx, bboxPh = Math.max(...ys) - bboxPy

  const wcCx = bboxPx + bboxPw / 2, wcCy = bboxPy + bboxPh / 2
  const arrowAngle = Math.PI * 0.75
  const tipGap = Math.min(bboxPw, bboxPh) * 0.6
  const arrowTip = { x: wcCx + Math.cos(arrowAngle) * tipGap, y: wcCy + Math.sin(arrowAngle) * tipGap }
  const arrowLen = Math.max(bboxPw, bboxPh) * 1.6
  const arrowStart = { x: wcCx + Math.cos(arrowAngle) * arrowLen, y: wcCy + Math.sin(arrowAngle) * arrowLen }
  const lw = Math.max(8, Math.min(bboxPw, bboxPh) * 0.10)
  const headLen = lw * 5, headHalf = Math.PI / 5
  const angle = Math.atan2(arrowTip.y - arrowStart.y, arrowTip.x - arrowStart.x)
  const shaftEndX = arrowTip.x - Math.cos(angle) * headLen * 0.85
  const shaftEndY = arrowTip.y - Math.sin(angle) * headLen * 0.85
  ctx.save()
  ctx.strokeStyle = '#1d4ed8'; ctx.fillStyle = '#1d4ed8'
  ctx.lineWidth = lw; ctx.lineCap = 'butt'
  ctx.beginPath(); ctx.moveTo(arrowStart.x, arrowStart.y); ctx.lineTo(shaftEndX, shaftEndY); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(arrowTip.x, arrowTip.y)
  ctx.lineTo(arrowTip.x - headLen * Math.cos(angle - headHalf), arrowTip.y - headLen * Math.sin(angle - headHalf))
  ctx.lineTo(arrowTip.x - headLen * Math.cos(angle + headHalf), arrowTip.y - headLen * Math.sin(angle + headHalf))
  ctx.closePath(); ctx.fill()
  ctx.restore()

  const padX = bboxPw * 2.5, padY = bboxPh * 1.5
  const cx = Math.max(0, bboxPx - padX), cy = Math.max(0, bboxPy - padY)
  const cw = Math.min(img.naturalWidth - cx, bboxPw + padX * 2)
  const ch = Math.min(img.naturalHeight - cy, bboxPh + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = cw; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return cropped.toDataURL('image/png')
}

export async function drawPairHighlight(imgSrc, rect1, rect2, viewBox) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgSrc })
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  if (!viewBox) return canvas.toDataURL('image/png')
  const [, , vw, vh] = viewBox.split(' ').map(Number)
  const sx = img.naturalWidth / vw, sy = img.naturalHeight / vh
  const bboxes = []
  function drawRect(rect) {
    if (!rect) return
    let bboxVb
    if (rect.d) {
      ctx.save(); ctx.scale(sx, sy)
      ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fill(new Path2D(rect.d))
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = vw / 90; ctx.stroke(new Path2D(rect.d))
      ctx.restore(); bboxVb = pathBBox(rect.d)
    } else {
      const lw = Math.max(4, img.naturalWidth / 250)
      ctx.fillStyle = 'rgba(239,68,68,0.22)'; ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = lw; ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy)
      bboxVb = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    bboxes.push({ px: bboxVb.x * sx, py: bboxVb.y * sy, pw: bboxVb.width * sx, ph: bboxVb.height * sy })
  }
  drawRect(rect1); drawRect(rect2)
  if (bboxes.length === 0) return canvas.toDataURL('image/png')
  const allMinX = Math.min(...bboxes.map(b => b.px)), allMinY = Math.min(...bboxes.map(b => b.py))
  const allMaxX = Math.max(...bboxes.map(b => b.px + b.pw)), allMaxY = Math.max(...bboxes.map(b => b.py + b.ph))
  const combinedW = allMaxX - allMinX, combinedH = allMaxY - allMinY
  const padX = combinedW * 4, padY = combinedH * 1.5
  const cx = Math.max(0, allMinX - padX), cy = Math.max(0, allMinY - padY)
  const cw = Math.min(img.naturalWidth - cx, combinedW + padX * 2)
  const ch = Math.min(img.naturalHeight - cy, combinedH + padY * 2)
  const cropped = document.createElement('canvas')
  cropped.width = cw; cropped.height = ch
  cropped.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
  return cropped.toDataURL('image/png')
}
