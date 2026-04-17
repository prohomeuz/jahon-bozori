import {
  Document, Page, View, Text, StyleSheet,
  Image, Svg, Path, Rect,
} from '@react-pdf/renderer'

/* ── Palette ──────────────────────────────────────────── */
const P = {
  fg:      '#111827',
  muted:   '#6b7280',
  mutedLt: '#9ca3af',
  border:  '#e5e7eb',
  bg:      '#f9fafb',
  amber:   '#d97706',
  amberBg: '#fffbeb',
  amberBd: '#fcd34d',
  amberFg: '#92400e',
  red:     '#dc2626',
  white:   '#ffffff',
}

/* ── Lucide-style SVG icons ───────────────────────────── */
const IP = {
  globe:       ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  dollarSign:  'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  maximize:    'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  clock:       ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M12 6v6l4 2'],
  ruler:       ['M3 3l18 18', 'M13.5 3h7.5v7.5', 'M3 10.5V3h7.5'],
  building:    ['M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18',
                'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
                'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
                'M10 6h4M10 10h4M10 14h4M10 18h4'],
  creditCard:  ['M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9',
                'M2 9V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2',
                'M6 14h.01M10 14h4'],
  trendingUp:  ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'],
  tag:         ['M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.3-7.3a1 1 0 0 0 0-1.41L12 2',
                'M7 7h.01'],
  phone:       'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92',
  mapPin:      ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0',
                'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  instagram:   ['M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z',
                'M12 6.865a5.135 5.135 0 1 0 0 10.27 5.135 5.135 0 0 0 0-10.27',
                'M17.796 6.375a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4'],
}

function Icon({ d, size = 10, color = P.mutedLt }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <Svg viewBox="0 0 24 24" style={{ width: size, height: size }}>
      {paths.map((p, i) => (
        <Path key={i} d={p} stroke={color} strokeWidth={1.8}
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  )
}

/* ── Styles ───────────────────────────────────────────── */
const s = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: P.white,
    padding: 26,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: P.fg,
    gap: 18,
  },

  /* LEFT main */
  main: { flex: 1, flexDirection: 'column', gap: 10 },

  /* Breadcrumb */
  breadcrumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  crumbText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    color: P.fg,
    letterSpacing: 0.5,
  },

  /* Info grid */
  grid: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    padding: 9,
    borderRightWidth: 1,
    borderRightColor: P.border,
    backgroundColor: '#f8fafc',
  },
  cellLast:  { flex: 1, padding: 9, backgroundColor: '#f8fafc' },
  cellTopBorder: { borderBottomWidth: 1, borderBottomColor: P.border },
  cellLabel: { color: P.muted, fontSize: 7, marginBottom: 4 },
  cellVal:   { fontFamily: 'Helvetica-Bold', fontSize: 13, color: P.fg },
  cellValM:  { fontFamily: 'Helvetica-Bold', fontSize: 13, color: P.mutedLt },

  /* Image — reduced to fit benefits section on 1 A4 page */
  imgBox: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: P.bg,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: 200, objectFit: 'contain' },
  imgPlaceholder: { color: P.mutedLt, fontSize: 7, padding: 20 },

  /* Note */
  note: {
    backgroundColor: P.amberBg,
    borderWidth: 1,
    borderColor: P.amberBd,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1 },
  noteTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: P.amber,
    marginBottom: 3,
  },
  noteBody: { fontSize: 8, color: P.amberFg, lineHeight: 1.6 },

  /* RIGHT sidebar */
  sidebar: {
    width: 142,
    flexDirection: 'column',
    gap: 12,
    borderLeftWidth: 1,
    borderLeftColor: P.border,
    paddingLeft: 16,
  },

  /* Logo */
  logoMark: { width: 36, height: 36, marginBottom: 4 },
  logoName: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: P.fg, lineHeight: 1.2 },
  logoSub:  { fontSize: 6, color: P.muted, letterSpacing: 1.5, marginTop: 1 },

  divider: { borderTopWidth: 1, borderTopColor: P.border },

  /* Sidebar sections */
  section: { gap: 4 },
  sTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: P.fg },
  sRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sText:  { fontSize: 7.5, color: P.muted, lineHeight: 1.6, flex: 1 },

  /* QR placeholder */
  qrBox: {
    width: 72, height: 72,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.bg,
    marginTop: 4,
  },
  qrText: { fontSize: 6, color: P.mutedLt, textAlign: 'center' },

  /* Benefits section */
  benefits: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 5,
  },
  benefitsTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
    color: P.fg,
    marginBottom: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minHeight: 20,
  },
  benefitNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.amber,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  benefitNumText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: P.white,
  },
  benefitText: {
    flex: 1,
    fontSize: 12,
    color: P.fg,
    lineHeight: 1.5,
    paddingTop: 2,
  },
  benefitBold: {
    fontFamily: 'Helvetica-Bold',
  },
})

/* ── Logo mark SVG ────────────────────────────────────── */
function LogoMark() {
  return (
    <Svg viewBox="0 0 48 48" style={s.logoMark}>
      {/* Base building */}
      <Rect x="6" y="20" width="36" height="24" rx="2" fill={P.fg} />
      {/* Left tower */}
      <Rect x="8" y="10" width="12" height="34" rx="2" fill={P.fg} />
      {/* Right tower */}
      <Rect x="28" y="14" width="12" height="30" rx="2" fill={P.fg} />
      {/* Center spire */}
      <Rect x="20" y="4" width="8" height="40" rx="2" fill={P.red} />
      {/* Windows */}
      <Rect x="10" y="14" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="15" y="14" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="10" y="20" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="15" y="20" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="30" y="18" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="35" y="18" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="30" y="24" width="3" height="3" rx="0.5" fill={P.white} />
      <Rect x="35" y="24" width="3" height="3" rx="0.5" fill={P.white} />
    </Svg>
  )
}

/* ── Grid cell ────────────────────────────────────────── */
function Cell({ label, value, last = false, top = false }) {
  const hasValue = value && value !== '—'
  return (
    <View style={[last ? s.cellLast : s.cell, top && s.cellTopBorder]}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={hasValue ? s.cellVal : s.cellValM}>{value || '—'}</Text>
    </View>
  )
}

/* ── Main component ───────────────────────────────────── */
export function ContractPDF({
  apartment, floor, blockId, bolimNum,
  form, type, date, floorImgSrc, managerName, qrDataUrl, logoSrc,
}) {
  const [, , apt] = (apartment.address ?? '').split('-')
  const aptNum = apt ?? apartment.address

  const rawNum = String(form.boshlangich || '').replace(/\s/g, '')
  const boshlangichFmt = rawNum
    ? Number(rawNum).toLocaleString('ru-RU') + ' USD'
    : '—'

  const rawUmumiy = String(form.umumiy || '').replace(/\s/g, '')
  const rawNarxM2 = String(form.narx_m2 || '').replace(/\s/g, '')
  const calcUmumiy = !rawUmumiy && rawNarxM2 && apartment.size > 0
    ? Math.round(Number(rawNarxM2) * apartment.size)
    : null
  const umumiyFmt = rawUmumiy
    ? Number(rawUmumiy).toLocaleString('ru-RU') + ' USD'
    : calcUmumiy
      ? calcUmumiy.toLocaleString('ru-RU') + ' USD'
      : '—'

  const narxPerM2 = rawNarxM2
    ? Number(rawNarxM2).toLocaleString('ru-RU') + ' USD'
    : rawNum && apartment.size > 0
      ? Math.round(Number(rawNum) / apartment.size).toLocaleString('ru-RU') + ' USD'
      : '—'

  const umumiyRaw = rawUmumiy ? Number(rawUmumiy) : (calcUmumiy ?? 0)
  const oylar = parseInt(form.oylar) || 0
  const oylikVal = umumiyRaw > 0 && oylar > 0
    ? Math.round((umumiyRaw - Number(rawNum || '0')) / oylar)
    : 0
  const oylikFmt = oylikVal > 0 ? oylikVal.toLocaleString('ru-RU') + ' USD' : '—'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ════════════ LEFT: MAIN ════════════ */}
        <View style={s.main}>

          {/* Breadcrumb */}
          <View style={s.breadcrumb}>
            <Text style={s.crumbText}>
              {blockId}-BLOK  {'>'}  {bolimNum}-BO'LIM  {'>'}  {floor}-QAVAT  {'>'}  {aptNum}-DO'KON
            </Text>
          </View>

          {/* Info grid */}
          <View style={s.grid}>
            {/* Row 1 */}
            <View style={s.gridRow}>
              <Cell label="1 kv/m"    value={narxPerM2}                                           top />
              <Cell label="O'lcham"   value={apartment.size > 0 ? `${apartment.size} m²` : '—'}  top />
              <Cell label="Muddat"    value={`${form.oylar} oy`}                                  top last />
            </View>
            {/* Row 2 */}
            <View style={s.gridRow}>
              <Cell label="Kafolat summasi" value={boshlangichFmt} />
              <Cell label="Oylik to'lov"    value={oylikFmt} />
              <Cell label="Umumiy narx"     value={umumiyFmt}      last />
            </View>
          </View>

          {/* Floor plan — highlighted */}
          <View style={s.imgBox}>
            {floorImgSrc
              ? <Image src={floorImgSrc} style={s.img} />
              : <Text style={s.imgPlaceholder}>Reja rasmi mavjud emas</Text>
            }
          </View>

          {/* Benefits */}
          <View style={s.benefits}>
            <Text style={s.benefitsTitle}>Agar JAHON BOZORIdan do'kon xarid qilsam nimalar yutaman?</Text>
            {[
              ['Ajoyib joylashuv', 'Viloyat va vodiyning markazi'],
              ['Keng qamrovli transport tarmog\'i', 'Logistika markazi'],
              ['Yevropa va Osiyoga to\'g\'ridan to\'g\'ri ulanish', 'Import va Export'],
              ['Xavfsiz va qulay harakatlanish kafolati', null],
              ['Yong\'indan mutlaq himoya', 'hududda yong\'indan himoyalanish uchun barcha choralar ko\'rilgan'],
            ].map(([bold, rest], i) => (
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

        </View>

        {/* ════════════ RIGHT: SIDEBAR ════════════ */}
        <View style={s.sidebar}>

          {/* Brand */}
          <View>
            {logoSrc
              ? <Image src={logoSrc} style={{ width: 138, height: 90, objectFit: 'contain' }} />
              : <Text style={s.logoName}>JAHON BOZORI</Text>
            }
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
            <Text style={{ fontSize: 7.5, color: P.fg, lineHeight: 1.6 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Telegram: </Text>
              <Text style={{ color: '#2563eb' }}>@HengTai_Admin</Text>
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: P.fg, marginTop: 3 }}>
              Murojaat uchun:
            </Text>
            <View style={s.sRow}>
              <Icon d={IP.phone} size={9} color={P.muted} />
              <Text style={{ fontSize: 7.5, color: P.muted }}>88-219-66-66</Text>
            </View>
            <View style={s.sRow}>
              <Icon d={IP.phone} size={9} color={P.muted} />
              <Text style={{ fontSize: 7.5, color: P.muted }}>88-692-33-33</Text>
            </View>
            <View style={[s.sRow, { marginTop: 3 }]}>
              <Icon d={IP.globe} size={9} color={P.muted} />
              <Text style={{ fontSize: 7.5, color: '#2563eb' }}>jahonbozori.uz</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* Mijoz */}
          <View style={s.section}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: P.fg }}>
              {form.ism} {form.familiya}
            </Text>
            {form.telefon ? <Text style={{ fontSize: 7.5, color: P.muted, marginTop: 3 }}>{form.telefon}</Text> : null}
            {form.passport ? <Text style={{ fontSize: 7.5, color: P.muted, marginTop: 2 }}>{form.passport}</Text> : null}
          </View>

          {managerName ? (
            <>
              <View style={s.divider} />
              <View style={s.section}>
                <Text style={{ fontSize: 7, color: P.mutedLt, marginBottom: 3, letterSpacing: 0.5 }}>
                  SOTUV MENEJER
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: P.fg }}>
                  {managerName}
                </Text>
              </View>
            </>
          ) : null}

          {/* QR code — sidebar bottom */}
          {qrDataUrl ? (
            <>
              <View style={{ flex: 1 }} />
              <View style={s.divider} />
              <View style={{ alignItems: 'center', gap: 4, paddingTop: 8 }}>
                <Image src={qrDataUrl} style={{ width: 110, height: 110 }} />
                <Text style={{ fontSize: 7, color: P.muted, textAlign: 'center', fontFamily: 'Helvetica-Bold' }}>
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
