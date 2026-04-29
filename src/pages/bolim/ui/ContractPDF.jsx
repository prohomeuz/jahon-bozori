import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'

/* ── Palette ──────────────────────────────────────────── */
const P = {
  fg: '#111827',
  muted: '#6b7280',
  mutedLt: '#9ca3af',
  border: '#e5e7eb',
  bg: '#f9fafb',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBd: '#fcd34d',
  amberFg: '#92400e',
  green: '#15803d',
  greenBg: '#f0fdf4',
  greenBd: '#86efac',
  red: '#dc2626',
  white: '#ffffff',
}

/* ── Lucide-style SVG icons ───────────────────────────── */
const IP = {
  globe: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    'M2 12h20',
    'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  ],
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92',
  mapPin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  gift: [
    'M20 12v10H4V12',
    'M2 7h20v5H2z',
    'M12 22V7',
    'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z',
    'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  ],
}

function Icon({ d, size = 10, color = P.mutedLt }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      {paths.map((p, i) => (
        <Path
          key={i}
          d={p}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  )
}

/* ── Styles ───────────────────────────────────────────── */
const s = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: P.white,
    padding: 22,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: P.fg,
    gap: 16,
  },

  main: { flex: 1, flexDirection: 'column', gap: 8, overflow: 'hidden' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center' },
  crumbText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 15,
    color: P.fg,
    letterSpacing: 0.5,
  },

  /* Info grid */
  grid: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 7,
    overflow: 'hidden',
  },
  gridRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: P.border,
    backgroundColor: '#f8fafc',
  },
  cellLast: { flex: 1, padding: 8, backgroundColor: '#f8fafc' },
  cellTopBorder: { borderBottomWidth: 1, borderBottomColor: P.border },
  cellLabel: { color: P.muted, fontSize: 6.5, marginBottom: 3 },
  cellVal: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: P.fg },
  cellValM: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: P.mutedLt },
  cellStrike: { fontSize: 9, color: P.mutedLt, textDecoration: 'line-through' },

  /* Chegirma row — green tint inside grid */
  chegirmaCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#bbf7d0',
    backgroundColor: P.greenBg,
  },
  chegirmaCellLast: {
    flex: 1,
    padding: 8,
    backgroundColor: P.greenBg,
  },
  chegirmaLabel: { color: P.green, fontSize: 6.5, marginBottom: 3 },
  chegirmaVal: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: P.fg },
  chegirmaValGreen: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: P.green },
  chegirmaValRed: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: P.red },

  /* Image */
  imgBox: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: P.bg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
  },
  img: { width: '100%', height: 250, objectFit: 'contain' },

  /* WC marketing block */
  wcBlock: {
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 7,
    backgroundColor: '#f0f9ff',
    padding: 9,
    gap: 5,
  },
  wcBlockTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#0369a1',
    marginBottom: 2,
  },
  wcRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  wcDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0ea5e9',
    marginTop: 3,
    flexShrink: 0,
  },
  wcText: {
    flex: 1,
    fontSize: 9,
    color: '#1e3a5f',
    lineHeight: 1.5,
  },
  wcBold: { fontFamily: 'Helvetica-Bold' },

  imgPlaceholder: { color: P.mutedLt, fontSize: 7, padding: 20 },

  /* Benefits */
  benefits: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    padding: 9,
    gap: 5,
  },
  benefitsTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: P.fg,
    marginBottom: 3,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    minHeight: 18,
  },
  benefitNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: P.amber,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitNumText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: P.white },
  benefitText: { flex: 1, fontSize: 10, color: P.fg, lineHeight: 1.5, paddingTop: 1 },
  benefitBold: { fontFamily: 'Helvetica-Bold' },

  /* RIGHT sidebar */
  sidebar: {
    width: 140,
    flexDirection: 'column',
    gap: 8,
    borderLeftWidth: 1,
    borderLeftColor: P.border,
    paddingLeft: 14,
  },

  logoName: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: P.fg, lineHeight: 1.2 },
  divider: { borderTopWidth: 1, borderTopColor: P.border },
  section: { gap: 3 },
  sRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sText: { fontSize: 7, color: P.muted, lineHeight: 1.6, flex: 1 },

  /* Bonus sidebar section */
  bonusTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: P.amber,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bonusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: P.amber,
    flexShrink: 0,
  },
  bonusName: { fontSize: 8, color: P.fg, fontFamily: 'Helvetica-Bold', flex: 1 },
})

/* ── Grid cell ────────────────────────────────────────── */
function Cell({ label, value, strikeValue, last = false, top = false }) {
  const hasValue = value && value !== '—'
  return (
    <View style={[last ? s.cellLast : s.cell, top && s.cellTopBorder]}>
      <Text style={s.cellLabel}>{label}</Text>
      {strikeValue ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
          <Text style={s.cellStrike}>{strikeValue}</Text>
          <Text style={s.cellVal}>{value || '—'}</Text>
        </View>
      ) : (
        <Text style={hasValue ? s.cellVal : s.cellValM}>{value || '—'}</Text>
      )}
    </View>
  )
}

function ChegirmaCell({ label, value, color, last = false }) {
  return (
    <View style={last ? s.chegirmaCellLast : s.chegirmaCell}>
      <Text style={s.chegirmaLabel}>{label}</Text>
      <Text
        style={
          color === 'green'
            ? s.chegirmaValGreen
            : color === 'red'
            ? s.chegirmaValRed
            : s.chegirmaVal
        }
      >
        {value || '—'}
      </Text>
    </View>
  )
}

/* ── Main component ───────────────────────────────────── */
export function ContractPDF({
  apartment,
  floor,
  blockId,
  bolimNum,
  form,
  floorImgSrc,
  managerName,
  qrDataUrl,
  logoSrc,
  bonusItems = [],
}) {
  const [, , apt] = (apartment.address ?? '').split('-')
  const aptNum = apt ?? apartment.address
  // Juft do'kon: address "B-1-140/141" shaklida saqlanadi (pairAddress field orqali)
  const pairAptNumRaw = apartment.pairAddress ? apartment.pairAddress.split('-').pop() : null
  // O'sish tartibida sort: kichik raqam birinchi
  const [sortedAptNum, pairAptNum] = pairAptNumRaw
    ? [Number(aptNum), Number(pairAptNumRaw)].sort((a, b) => a - b).map(String)
    : [aptNum, null]

  const rawDown = String(form.boshlangich || '').replace(/\s/g, '')
  const rawUmumiy = String(form.umumiy || '').replace(/\s/g, '')
  const rawNarxM2 = String(form.narx_m2 || '').replace(/\s/g, '')

  const boshlangichFmt = rawDown ? Number(rawDown).toLocaleString('ru-RU') + ' USD' : '—'

  const calcUmumiy =
    !rawUmumiy && rawNarxM2 && apartment.size > 0
      ? Math.round(Number(rawNarxM2) * apartment.size)
      : null
  const umumiyFmt = rawUmumiy
    ? Number(rawUmumiy).toLocaleString('ru-RU') + ' USD'
    : calcUmumiy
    ? calcUmumiy.toLocaleString('ru-RU') + ' USD'
    : '—'

  const narxPerM2 = rawNarxM2
    ? Number(rawNarxM2).toLocaleString('ru-RU') + ' USD'
    : rawDown && apartment.size > 0
    ? Math.round(Number(rawDown) / apartment.size).toLocaleString('ru-RU') + ' USD'
    : '—'

  const umumiyRaw = rawUmumiy ? Number(rawUmumiy) : calcUmumiy ?? 0
  const oylar = parseInt(form.oylar) || 0

  // Chegirma
  const chegirmaM2 = Number(String(form.chegirma_m2 || '').replace(/\s/g, '')) || 0
  const aslNarxM2 = Number(String(form.asl_narx_m2 || '').replace(/\s/g, '')) || 0
  const hasChegirma = chegirmaM2 > 0 && aslNarxM2 > 0
  const tejamTotal = hasChegirma ? chegirmaM2 * apartment.size : 0
  const origTotal = hasChegirma ? Math.round(aslNarxM2 * apartment.size) : 0

  // Oylik to'lov — kalkulatordagi mantiq: boshlangich chegirmali totalni qoplasa ham
  // pctOfBase < 100 bo'lsa baseTotal - downVal asosida hisoblash
  const downNum = Number(rawDown || '0')
  const baseTotal = aslNarxM2 > 0 ? Math.round(aslNarxM2 * apartment.size) : umumiyRaw
  const pctOfBase = baseTotal > 0 && downNum > 0 ? Math.floor((downNum / baseTotal) * 100) : 0
  const qolgan = Math.max(0, umumiyRaw - downNum)
  const qolganDisp =
    qolgan > 0
      ? qolgan
      : pctOfBase < 100 && downNum < umumiyRaw
      ? Math.max(0, baseTotal - downNum)
      : 0
  const oylikVal = qolganDisp > 0 && oylar > 0 ? Math.round(qolganDisp / oylar) : 0
  const oylikFmt = oylikVal > 0 ? oylikVal.toLocaleString('ru-RU') + ' USD' : '—'
  // Eng muhim 3 ta foyda (biznes/sotuv nuqtai nazaridan)
  const BENEFITS = [
    ['Ajoyib joylashuv', 'Viloyat va vodiyning markazi — maksimal mijoz oqimi'],
    ["Keng qamrovli transport tarmog'i", 'Logistika markazi — tovar yetkazish oson'],
    ["Yevropa va Osiyoga to'g'ridan to'g'ri ulanish", 'Import va Export uchun ideal'],
  ]

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* ════════════ LEFT: MAIN ════════════ */}
        <View style={s.main}>
          {/* Sarlavha */}
          <View style={s.breadcrumb}>
            <Text style={s.crumbText}>
              {blockId}-BLOK {'>'} {bolimNum}-BO'LIM {'>'} {floor}-QAVAT {'>'}{' '}
              {pairAptNum ? `${sortedAptNum}/${pairAptNum}` : aptNum}-
              {apartment.is_wc ? 'HOJATXONA' : "DO'KON"}
            </Text>
          </View>

          {/* Info grid */}
          <View style={s.grid}>
            <View style={s.gridRow}>
              <Cell label="1 kv/m" value={narxPerM2} top />
              <Cell label="O'lcham" value={apartment.size > 0 ? `${apartment.size} m²` : '—'} top />
              <Cell label="Muddat" value={`${form.oylar} oy`} top last />
            </View>
            <View style={s.gridRow}>
              <Cell label="Kafolat summasi" value={boshlangichFmt} />
              <Cell label="Oylik to'lov" value={oylikFmt} />
              <Cell
                label="Umumiy narx"
                value={umumiyFmt}
                strikeValue={
                  hasChegirma && origTotal > 0
                    ? origTotal.toLocaleString('ru-RU') + ' USD'
                    : undefined
                }
                last
              />
            </View>
            {hasChegirma && (
              <View style={s.gridRow}>
                <ChegirmaCell
                  label="Asl narx / m²"
                  value={`${aslNarxM2.toLocaleString('ru-RU')} USD`}
                />
                <ChegirmaCell
                  label="Chegirma / m²"
                  value={`−${chegirmaM2.toLocaleString('ru-RU')} USD`}
                  color="red"
                />
                <ChegirmaCell
                  label="Umumiy tejam"
                  value={`+${tejamTotal.toLocaleString('ru-RU')} USD`}
                  color="green"
                  last
                />
              </View>
            )}
          </View>

          {/* Floor plan */}
          <View style={[s.imgBox, { height: apartment.is_wc ? 320 : 250 }]}>
            {floorImgSrc ? (
              <Image src={floorImgSrc} style={[s.img, { height: apartment.is_wc ? 320 : 250 }]} />
            ) : (
              <Text style={s.imgPlaceholder}>Reja rasmi mavjud emas</Text>
            )}
          </View>

          {/* WC marketing block */}
          {apartment.is_wc && (
            <View style={s.wcBlock}>
              <Text style={s.wcBlockTitle}>Nima uchun hojatxona — aqlli investitsiya?</Text>
              <View style={s.wcRow}>
                <View style={s.wcDot} />
                <Text style={s.wcText}>
                  <Text style={s.wcBold}>{'Doimiy talab'}</Text>
                  {" — har kuni yuzlab tashrif buyuruvchi, hech qachon bo'sh qolmaydi"}
                </Text>
              </View>
              <View style={s.wcRow}>
                <View style={s.wcDot} />
                <Text style={s.wcText}>
                  <Text style={s.wcBold}>{'Minimal xarajat'}</Text>
                  {" — xodim, tovar, ta'mirlash kerak emas; sof passiv daromad"}
                </Text>
              </View>
              <View style={s.wcRow}>
                <View style={s.wcDot} />
                <Text style={s.wcText}>
                  <Text style={s.wcBold}>{'Barqaror cashflow'}</Text>
                  {" — bozor ochiq bo'lgan har kuni avtomatik daromad oqimi"}
                </Text>
              </View>
            </View>
          )}

          {/* Benefits — faqat do'konlar uchun */}
          {!apartment.is_wc && (
            <View style={s.benefits}>
              <Text style={s.benefitsTitle}>
                Agar JAHON BOZORIdan do'kon xarid qilsam nimalar yutaman?
              </Text>
              {BENEFITS.map(([bold, rest], i) => (
                <View key={i} style={s.benefitRow}>
                  <View style={s.benefitNum}>
                    <Text style={s.benefitNumText}>{i + 1}</Text>
                  </View>
                  <Text style={s.benefitText}>
                    <Text style={s.benefitBold}>{bold}</Text>
                    {rest ? `: ${rest}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ════════════ RIGHT: SIDEBAR ════════════ */}
        <View style={s.sidebar}>
          {/* Logo */}
          <View>
            {logoSrc ? (
              <Image src={logoSrc} style={{ width: 126, height: 72, objectFit: 'contain' }} />
            ) : (
              <Text style={s.logoName}>JAHON BOZORI</Text>
            )}
          </View>

          <View style={s.divider} />

          {/* Manzil */}
          <View style={s.section}>
            <View style={[s.sRow, { alignItems: 'flex-start' }]}>
              <Icon d={IP.mapPin} size={9} color={P.muted} />
              <Text style={s.sText}>
                {"Farg'ona vil. Farg'ona shahar\nAhmad Al-Farg'oniy\nshoh ko'chasi, 114"}
              </Text>
            </View>
          </View>

          {/* Aloqa */}
          <View style={s.section}>
            <Text style={{ fontSize: 7, color: P.fg, lineHeight: 1.6 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Telegram: </Text>
              <Text style={{ color: '#2563eb' }}>@HengTai_Admin</Text>
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: P.fg, marginTop: 2 }}>
              Murojaat uchun:
            </Text>
            <View style={s.sRow}>
              <Icon d={IP.phone} size={8} color={P.muted} />
              <Text style={{ fontSize: 7, color: P.muted }}>88-219-66-66</Text>
            </View>
            <View style={s.sRow}>
              <Icon d={IP.phone} size={8} color={P.muted} />
              <Text style={{ fontSize: 7, color: P.muted }}>88-692-33-33</Text>
            </View>
            <View style={[s.sRow, { marginTop: 2 }]}>
              <Icon d={IP.globe} size={8} color={P.muted} />
              <Text style={{ fontSize: 7, color: '#2563eb' }}>jahonbozori.uz</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Mijoz */}
          <View style={s.section}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: P.fg }}>
              {form.ism} {form.familiya}
            </Text>
            {form.telefon ? (
              <Text style={{ fontSize: 7, color: P.muted, marginTop: 2 }}>{form.telefon}</Text>
            ) : null}
            {form.passport ? (
              <Text style={{ fontSize: 7, color: P.muted, marginTop: 1 }}>{form.passport}</Text>
            ) : null}
          </View>

          {managerName ? (
            <>
              <View style={s.divider} />
              <View style={s.section}>
                <Text
                  style={{ fontSize: 6.5, color: P.mutedLt, marginBottom: 2, letterSpacing: 0.5 }}
                >
                  SOTUV MENEJER
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: P.fg }}>
                  {managerName}
                </Text>
              </View>
            </>
          ) : null}

          {/* Bonus texnikalar */}
          {bonusItems.length > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.section}>
                <Text style={s.bonusTitle}>BONUS TEXNIKALAR</Text>
                {bonusItems.map((item, i) => (
                  <View key={i} style={s.bonusRow}>
                    <View style={s.bonusDot} />
                    <Text style={s.bonusName}>{item.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* QR code */}
          {qrDataUrl ? (
            <>
              <View style={{ flex: 1 }} />
              <View style={s.divider} />
              <View style={{ alignItems: 'center', gap: 3, paddingTop: 5 }}>
                <Image src={qrDataUrl} style={{ width: 88, height: 88 }} />
                <Text
                  style={{
                    fontSize: 6.5,
                    color: P.muted,
                    textAlign: 'center',
                    fontFamily: 'Helvetica-Bold',
                  }}
                >
                  Skayner qiling!
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
