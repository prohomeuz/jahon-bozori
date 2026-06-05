import { getBolimViewBox, getAptRect, drawHighlight, drawWcHighlight, drawPairHighlight, imgToDataUrl } from '@/shared/lib/canvasHighlight'
import { WC_OVERLAYS } from '../config/hojatxonaOverlays'

const allBlockImgs = import.meta.glob('@/assets/blocks/**/*.webp', { eager: true })

const _imgIndex = new Map()
for (const [k, v] of Object.entries(allBlockImgs)) {
  const parts = k.replace(/\\/g, '/').split('/')
  const name = parts.pop()?.split('.')[0]
  const floorDir = parts.pop()
  const blockDir = parts.pop()
  _imgIndex.set(`${blockDir}/${floorDir}/${name}`, v?.default ?? null)
}

export function loadImg(blockId, floor, bolimNum) {
  return _imgIndex.get(`${blockId}/${floor}/${bolimNum}`) ?? null
}

export async function downloadShartnomaPDF({ apartment, floor, blockId, bolimNum, form, bookingId, pairApartment = null, contractDate = null, contractNumber = null }) {
  const { pdf } = await import('@react-pdf/renderer')
  const { ShartnomaPDF } = await import('../ui/ShartnomaPDF.jsx')
  const { apiFetch } = await import('@/shared/lib/auth')

  const cd = contractDate instanceof Date ? contractDate : (contractDate ? new Date(contractDate) : new Date())
  const apt = pairApartment
    ? { ...apartment, size: Number((apartment.size + pairApartment.size).toFixed(2)), pairAddress: pairApartment.address }
    : apartment

  let resolvedContractNum = contractNumber
  if (!resolvedContractNum && bookingId) {
    try {
      const r = await apiFetch(`/api/bookings/${bookingId}/contract-number`).then(x => x.json())
      resolvedContractNum = r.contract_number ?? null
    } catch { resolvedContractNum = null }
  }

  const blob = await pdf(
    <ShartnomaPDF
      apartment={apt}
      floor={floor}
      blockId={blockId}
      bolimNum={bolimNum}
      form={form}
      contractDate={cd}
      bookingId={bookingId}
      contractNumber={resolvedContractNum}
    />
  ).toBlob()
  return blob
}

export async function downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName, sourceName = '', pairApartment = null, contractDate = null }) {
  const { pdf } = await import('@react-pdf/renderer')
  const { ContractPDF } = await import('../ui/ContractPDF')
  const qrImg = await import('@/assets/qrcode.png')
  const qrDataUrl = qrImg.default

  const [logoSrc, rawFloorImg] = await Promise.all([
    imgToDataUrl('/logo.png'),
    Promise.resolve(loadImg(blockId, floor, bolimNum)),
  ])

  let floorImgSrc = null
  if (rawFloorImg) {
    try {
      if (apartment.is_wc) {
        const wcPoints = WC_OVERLAYS[blockId]?.[floor]?.[bolimNum] ?? null
        const viewBox  = await getBolimViewBox(blockId, floor, bolimNum)
        floorImgSrc = await drawWcHighlight(rawFloorImg, wcPoints, viewBox)
      } else if (pairApartment) {
        const [overlay1, overlay2] = await Promise.all([
          getAptRect(blockId, floor, bolimNum, apartment.address),
          getAptRect(blockId, floor, bolimNum, pairApartment.address),
        ])
        floorImgSrc = await drawPairHighlight(
          rawFloorImg, overlay1?.rect ?? null, overlay2?.rect ?? null, overlay1?.viewBox ?? null
        )
      } else {
        const overlay = await getAptRect(blockId, floor, bolimNum, apartment.address)
        floorImgSrc = await drawHighlight(rawFloorImg, overlay?.rect ?? null, overlay?.viewBox ?? null)
      }
    } catch { floorImgSrc = null }
  }

  const pdfApartment = pairApartment
    ? { ...apartment, size: Number((apartment.size + pairApartment.size).toFixed(2)), pairAddress: pairApartment.address }
    : apartment

  const dateObj = contractDate instanceof Date ? contractDate : (contractDate ? new Date(contractDate) : new Date())
  const _months = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr']
  const date = `${dateObj.getDate()}-${_months[dateObj.getMonth()]}, ${dateObj.getFullYear()}-yil`
  const blob = await pdf(
    <ContractPDF
      apartment={pdfApartment}
      floor={floor}
      blockId={blockId}
      bolimNum={bolimNum}
      form={form}
      type={type}
      date={date}
      floorImgSrc={floorImgSrc}
      managerName={managerName}
      sourceName={sourceName}
      qrDataUrl={qrDataUrl}
      logoSrc={logoSrc}
    />
  ).toBlob()
  return blob
}
