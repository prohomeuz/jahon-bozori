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

const PDF_BONUS_TABLE = {
  30:  ['Konditsioner'],
  40:  ['Konditsioner'],
  50:  ['Konditsioner', 'TV (43)'],
  60:  ['Konditsioner', 'TV (43)'],
  70:  ['Konditsioner', 'Muzlatgich'],
  100: ['Konditsioner', 'TV (43)', 'Muzlatgich'],
}
const CHEGIRMA_BRACKETS = [100, 70, 60, 50, 40, 30]

export async function downloadContractPDF({ apartment, floor, blockId, bolimNum, form, type, managerName, sourceName = '', pairApartment = null }) {
  const { pdf } = await import('@react-pdf/renderer')
  const { ContractPDF } = await import('../ui/ContractPDF')
  const qrImg = await import('@/assets/qrcode.png')
  const qrDataUrl = qrImg.default

  const effectiveSize = pairApartment
    ? Number((apartment.size + pairApartment.size).toFixed(2))
    : apartment.size

  const chegirmaM2 = Number(String(form.chegirma_m2 || '').replace(/\s/g, '')) || 0
  const aslNarxM2  = Number(String(form.asl_narx_m2 || '').replace(/\s/g, '')) || 0
  let bonusDataItems = []
  if (chegirmaM2 > 0 && aslNarxM2 > 0) {
    const baseTotal  = Math.round(aslNarxM2 * effectiveSize)
    const downVal    = Number(String(form.boshlangich || '').replace(/\s/g, '')) || 0
    const umumiyNum  = Number(String(form.umumiy || '').replace(/\s/g, '')) || 0
    const pctOfBase  = baseTotal > 0 && downVal > 0
      ? (umumiyNum > 0 && downVal >= umumiyNum ? 100 : Math.floor((downVal / baseTotal) * 100))
      : 0
    const bracket    = CHEGIRMA_BRACKETS.find(p => pctOfBase >= p) ?? null
    bonusDataItems   = bracket ? (PDF_BONUS_TABLE[bracket] ?? []).map(name => ({ name })) : []
  }

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
    ? { ...apartment, size: effectiveSize, pairAddress: pairApartment.address }
    : apartment

  const date = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })
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
      bonusItems={bonusDataItems}
    />
  ).toBlob()
  return blob
}
