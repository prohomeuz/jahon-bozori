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

export async function downloadBookingPDF(b) {
  const [blockId, bolimStr, aptStr] = b.apartment_id.split('-')
  const bolimNum = parseInt(bolimStr)
  // D blok: do'konlar (1-5) rasmlari D/1/ papkasida, rastalar D/rasta/ papkasida
  const floor = blockId === 'D'
    ? (bolimNum <= 5 ? 1 : 'rasta')
    : (aptStr ? parseInt(aptStr[0]) : 1)

  let partnerBooking = null
  if (b.pair_group_id) {
    try {
      const pairRes = await apiFetch(`/api/bookings/pair-group/${b.pair_group_id}`).then(r => r.json())
      partnerBooking = Array.isArray(pairRes) ? pairRes.find(p => p.id !== b.id) : null
    } catch { partnerBooking = null }
  }

  const [{ pdf }, aptRes] = await Promise.all([
    import('@react-pdf/renderer'),
    apiFetch(`/api/apartments?block=${blockId}&bolim=${bolimNum}&floor=${floor}`).then(r => r.json()),
  ])

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

  let combinedBoshlangich = b.boshlangich
  let combinedUmumiy = b.umumiy || ''
  if (partnerBooking) {
    const b1 = Number(String(b.boshlangich).replace(/\s/g, '')) || 0
    const b2 = Number(String(partnerBooking.boshlangich).replace(/\s/g, '')) || 0
    combinedBoshlangich = String(b1 + b2)
    const u1 = Number(String(b.umumiy || '').replace(/\s/g, '')) || 0
    const u2 = Number(String(partnerBooking.umumiy || '').replace(/\s/g, '')) || 0
    if (u1 > 0 || u2 > 0) combinedUmumiy = String(u1 + u2)
  }

  const form = {
    ism: b.ism, familiya: b.familiya, telefon: b.phone || '',
    boshlangich: combinedBoshlangich, oylar: String(b.oylar), umumiy: combinedUmumiy,
    narx_m2: b.narx_m2 || '', chegirma_m2: b.chegirma_m2 || '', asl_narx_m2: b.asl_narx_m2 || '',
    passport: b.passport || '', passport_place: b.passport_place || '', manzil: b.manzil || '',
  }

  let blob
  if (b.type === 'sotish') {
    let contractNumber = null
    try {
      const cnRes = await apiFetch(`/api/bookings/${b.id}/contract-number`).then(r => r.json())
      contractNumber = cnRes.contract_number ?? null
    } catch { contractNumber = null }
    const { ShartnomaPDF } = await import('@/pages/bolim/ui/ShartnomaPDF')
    const pdfApt = partnerApt ? { ...apartment, size: effectiveSize, pairAddress: partnerApt.address } : apartment
    blob = await pdf(
      <ShartnomaPDF
        apartment={pdfApt} floor={floor} blockId={blockId} bolimNum={bolimNum}
        form={form} contractDate={new Date(b.created_at)} bookingId={b.id}
        contractNumber={contractNumber}
      />
    ).toBlob()
  } else {
    const [{ ContractPDF }, qrImg, logoSrc] = await Promise.all([
      import('@/pages/bolim/ui/ContractPDF'),
      import('@/assets/qrcode.png'),
      imgToDataUrl('/logo.png'),
    ])
    const pdfApartment = partnerApt ? { ...apartment, size: effectiveSize, pairAddress: partnerApt.address } : apartment
    const _d = new Date(b.created_at)
    const _months = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr']
    const date = `${_d.getDate()}-${_months[_d.getMonth()]}, ${_d.getFullYear()}-yil`
    blob = await pdf(
      <ContractPDF
        apartment={pdfApartment} floor={floor} blockId={blockId} bolimNum={bolimNum}
        form={form} type={b.type} date={date} floorImgSrc={floorImgSrc}
        qrDataUrl={qrImg.default} managerName={b.manager_name || ''} sourceName={b.source_name || ''}
        logoSrc={logoSrc}
      />
    ).toBlob()
  }

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
