import { apiFetch } from '@/shared/lib/auth'
import { getBolimViewBox, getAptRect, drawHighlight, drawWcHighlight, drawPairHighlight, imgToDataUrl } from '@/shared/lib/canvasHighlight'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.{png,jpg,webp}', { eager: true })

function loadImg(blockId, floor, bolimNum) {
  const filename = String(bolimNum)
  const entry = Object.entries(allBlockImgs).find(([k]) => {
    const parts = k.replace(/\\/g, '/').split('/')
    const name = parts.pop()?.split('.')[0]
    const floorDir = parts.pop()
    const blockDir = parts.pop()
    return name === filename && floorDir === String(floor) && blockDir === blockId
  })
  return entry?.[1]?.default ?? null
}

const PDF_BONUS_MAP = {
  30:  ['Konditsioner'],
  40:  ['Konditsioner'],
  50:  ['Konditsioner', 'TV (43)'],
  60:  ['Konditsioner', 'TV (43)'],
  70:  ['Konditsioner', 'Muzlatgich'],
  100: ['Konditsioner', 'TV (43)', 'Muzlatgich'],
}

export async function downloadBookingPDF(b) {
  const [blockId, bolimStr, aptStr] = b.apartment_id.split('-')
  const bolimNum = parseInt(bolimStr)
  const floor    = aptStr ? parseInt(aptStr[0]) : 1

  let partnerBooking = null
  if (b.pair_group_id) {
    try {
      const pairRes = await apiFetch(`/api/bookings/pair-group/${b.pair_group_id}`).then(r => r.json())
      partnerBooking = Array.isArray(pairRes) ? pairRes.find(p => p.id !== b.id) : null
    } catch { partnerBooking = null }
  }

  const [{ pdf }, aptRes, qrImg] = await Promise.all([
    import('@react-pdf/renderer'),
    apiFetch(`/api/apartments?block=${blockId}&bolim=${bolimNum}&floor=${floor}`).then(r => r.json()),
    import('@/assets/qrcode.png'),
  ])
  const qrDataUrl = qrImg.default
  const { ContractPDF } = await import('@/pages/bolim/ui/ContractPDF')

  const aptData  = Array.isArray(aptRes) ? aptRes.find(a => a.address === b.apartment_id) : null
  const apartment = aptData ?? { address: b.apartment_id, size: 0, status: b.type === 'sotish' ? 'SOLD' : 'RESERVED' }

  let partnerApt = null
  if (partnerBooking) {
    const [pBlockId, pBolimStr, pAptStr] = partnerBooking.apartment_id.split('-')
    const pBolimNum = parseInt(pBolimStr)
    const pFloor    = pAptStr ? parseInt(pAptStr[0]) : 1
    if (pBlockId === blockId && pBolimNum === bolimNum && pFloor === floor) {
      const pAptData = Array.isArray(aptRes) ? aptRes.find(a => a.address === partnerBooking.apartment_id) : null
      partnerApt = pAptData ?? { address: partnerBooking.apartment_id, size: 0 }
    } else {
      try {
        const pAptRes = await apiFetch(`/api/apartments?block=${pBlockId}&bolim=${pBolimNum}&floor=${pFloor}`).then(r => r.json())
        const pAptData = Array.isArray(pAptRes) ? pAptRes.find(a => a.address === partnerBooking.apartment_id) : null
        partnerApt = pAptData ?? { address: partnerBooking.apartment_id, size: 0 }
      } catch { partnerApt = { address: partnerBooking.apartment_id, size: 0 } }
    }
  }

  const effectiveSize = partnerApt
    ? Number((apartment.size + partnerApt.size).toFixed(2))
    : apartment.size

  const rawFloorImg = loadImg(blockId, floor, bolimNum)
  let floorImgSrc = null
  if (rawFloorImg) {
    try {
      if (apartment.is_wc) {
        const { WC_OVERLAYS } = await import('@/pages/bolim/config/hojatxonaOverlays')
        const wcPoints = WC_OVERLAYS[blockId]?.[floor]?.[bolimNum] ?? null
        const viewBox  = await getBolimViewBox(blockId, floor, bolimNum)
        floorImgSrc    = await drawWcHighlight(rawFloorImg, wcPoints, viewBox)
      } else if (partnerApt) {
        const [overlay1, overlay2] = await Promise.all([
          getAptRect(blockId, floor, bolimNum, b.apartment_id),
          getAptRect(blockId, floor, bolimNum, partnerApt.address),
        ])
        floorImgSrc = await drawPairHighlight(rawFloorImg, overlay1?.rect ?? null, overlay2?.rect ?? null, overlay1?.viewBox ?? null)
      } else {
        const overlay = await getAptRect(blockId, floor, bolimNum, b.apartment_id)
        floorImgSrc   = await drawHighlight(rawFloorImg, overlay?.rect ?? null, overlay?.viewBox ?? null)
      }
    } catch { floorImgSrc = null }
  }

  const form = {
    ism: b.ism, familiya: b.familiya, telefon: b.phone || '',
    boshlangich: b.boshlangich, oylar: String(b.oylar), umumiy: b.umumiy || '',
    narx_m2: b.narx_m2 || '', chegirma_m2: b.chegirma_m2 || '', asl_narx_m2: b.asl_narx_m2 || '',
    passport: b.passport || '', passport_place: b.passport_place || '', manzil: b.manzil || '',
  }

  let bonusItems = []
  const chegirmaM2 = Number(String(b.chegirma_m2 || '').replace(/\s/g, '')) || 0
  const aslNarxM2  = Number(String(b.asl_narx_m2 || '').replace(/\s/g, '')) || 0
  if (chegirmaM2 > 0 && aslNarxM2 > 0 && effectiveSize > 0) {
    const baseTotal = Math.round(aslNarxM2 * effectiveSize)
    const downVal   = Number(String(b.boshlangich || '').replace(/\s/g, '')) || 0
    const umumiyNum = Number(String(b.umumiy || '').replace(/\s/g, '')) || 0
    const pctOfBase = baseTotal > 0 && downVal > 0
      ? (umumiyNum > 0 && downVal >= umumiyNum ? 100 : Math.floor((downVal / baseTotal) * 100))
      : 0
    const bracket = [100, 70, 60, 50, 40, 30].find(p => pctOfBase >= p) ?? null
    bonusItems = bracket ? (PDF_BONUS_MAP[bracket] ?? []).map(name => ({ name })) : []
  }

  const logoSrc = await imgToDataUrl('/logo.png')
  const pdfApartment = partnerApt
    ? { ...apartment, size: effectiveSize, pairAddress: partnerApt.address }
    : apartment

  const date = new Date(b.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
  const blob = await pdf(
    <ContractPDF
      apartment={pdfApartment} floor={floor} blockId={blockId} bolimNum={bolimNum}
      form={form} type={b.type} date={date} floorImgSrc={floorImgSrc}
      qrDataUrl={qrDataUrl} managerName={b.manager_name || ''} sourceName={b.source_name || ''}
      logoSrc={logoSrc} bonusItems={bonusItems}
    />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const aptNum = b.apartment_id.split('-').pop()
  a.download = partnerApt
    ? `shartnoma-${aptNum}-${partnerApt.address.split('-').pop()}.pdf`
    : `shartnoma-${b.apartment_id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
