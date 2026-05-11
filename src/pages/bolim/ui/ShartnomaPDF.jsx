import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

function fmtD(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}
function fmtUZ(date) {
  const d = date instanceof Date ? date : new Date(date)
  const M = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr']
  return `${d.getFullYear()}-yil ${d.getDate()}-${M[d.getMonth()]}`
}
function n(v) { return Number(String(v ?? '').replace(/\s/g,'')) || 0 }
function usd(v) { return v > 0 ? Number(v).toLocaleString('ru-RU') : '0' }

const BD = '#d1d5db'
const s = StyleSheet.create({
  page: { padding: 27, fontFamily: 'Helvetica', fontSize: 7.5, color: '#111827', lineHeight: 1.55 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, textAlign: 'center', marginBottom: 3 },
  sub:   { fontSize: 7, textAlign: 'center', color: '#6b7280', marginBottom: 11 },
  secHead: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginTop: 9, marginBottom: 3,
    paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: BD },
  p: { marginBottom: 3, lineHeight: 1.55 },

  iTable: { borderWidth: 0.5, borderColor: BD, marginTop: 12, flexDirection: 'row' },
  iCol:   { flex: 1, borderRightWidth: 0.5, borderRightColor: BD },
  iColL:  { flex: 1 },
  iHead:  { padding: '4 6', fontFamily: 'Helvetica-Bold', fontSize: 7.5, backgroundColor: '#f3f4f6',
    borderBottomWidth: 0.5, borderBottomColor: BD, textAlign: 'center' },
  iRow:   { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', minHeight: 16 },
  iLbl:   { width: 78, padding: '2.5 5', fontSize: 6.5, color: '#6b7280', borderRightWidth: 0.5, borderRightColor: '#f0f0f0' },
  iVal:   { flex: 1, padding: '2.5 5', fontSize: 7.5 },

  signRow: { flexDirection: 'row', marginTop: 20, gap: 24 },
  signCol: { flex: 1 },
  signHd:  { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginBottom: 18 },
  signLn:  { borderBottomWidth: 0.5, borderBottomColor: '#374151', marginBottom: 2 },
  signHt:  { fontSize: 6, color: '#9ca3af' },

  sumRow:  { flexDirection: 'row', gap: 5, marginBottom: 7 },
  sumCell: { flex: 1, borderWidth: 0.5, borderColor: BD, padding: '4 5', borderRadius: 2 },
  sumLbl:  { fontSize: 6, color: '#6b7280', marginBottom: 1.5 },
  sumVal:  { fontFamily: 'Helvetica-Bold', fontSize: 7.5 },

  aTable:  { borderWidth: 0.5, borderColor: BD },
  aHead:   { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 0.5, borderBottomColor: BD },
  aRow:    { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  aRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fafafa' },
  th: { padding: '2.5 4', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center', borderRightWidth: 0.5, borderRightColor: BD },
  thL:{ padding: '2.5 4', fontFamily: 'Helvetica-Bold', fontSize: 6.5, textAlign: 'center' },
  td: { padding: '2 4', fontSize: 7, textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#f0f0f0' },
  tdL:{ padding: '2 4', fontSize: 7, textAlign: 'center' },
  note: { fontSize: 6, color: '#6b7280', marginTop: 5, lineHeight: 1.5 },
})

function B({ children }) { return <Text style={{ fontFamily: 'Helvetica-Bold' }}>{children}</Text> }
function U({ children }) { return <Text style={{ fontFamily: 'Helvetica-Bold', textDecoration: 'underline' }}>{children}</Text> }

export function ShartnomaPDF({ apartment, floor, blockId, bolimNum, form, contractDate, bookingId }) {
  const aptNum = (apartment.address ?? '').split('-').pop()
  const total  = n(form.umumiy) || (n(form.narx_m2) > 0 && apartment.size > 0 ? Math.round(n(form.narx_m2) * apartment.size) : 0)
  const boshl  = n(form.boshlangich)
  const oylar  = parseInt(form.oylar) || 12
  const narxM2 = n(form.narx_m2)
  const chegM2 = n(form.chegirma_m2)
  const aslM2  = n(form.asl_narx_m2)
  const hasCheg = chegM2 > 0 && aslM2 > 0
  const qolgan  = Math.max(0, total - boshl)
  const oylik   = oylar > 0 && qolgan > 0 ? Math.round(qolgan / oylar) : 0
  const cd      = contractDate instanceof Date ? contractDate : new Date()
  const payDay  = cd.getDate()
  const endDate = new Date(cd); endDate.setMonth(endDate.getMonth() + oylar)
  const investorName = `${form.ism || ''} ${form.familiya || ''}`.trim()
  const cdStr  = fmtUZ(cd)
  const endStr = fmtUZ(endDate)

  const schedule = Array.from({ length: oylar }, (_, i) => {
    const d = new Date(cd)
    d.setMonth(d.getMonth() + i + 1)
    d.setDate(Math.min(payDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    const paid = oylik * (i + 1)
    return { num: i + 1, date: fmtD(d), amount: oylik, remaining: i === oylar - 1 ? 0 : Math.max(0, qolgan - paid) }
  })

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Investitsiya va savdo markazini qurish bo'yicha hamkorlik shartnomasi</Text>
        <Text style={s.sub}>Shartnoma № {bookingId}  ·  {cdStr}  ·  Farg'ona shahri</Text>

        {/* Parties */}
        <View style={[s.p, { marginBottom: 8, lineHeight: 1.7 }]}>
          <Text>
            <B>«HENG TAI» MCHJ XK</B> (keyingi o'rinlarda <B>«Quruvchi»</B> deb yuritiladi), Nizom asosida faoliyat yurituvchi ZHANG XIAOLI nomidan, bir tomondan;{'\n'}
            Jismoniy shaxs: <U>{investorName}</U>, Pasport / ID raqami: <U>{form.passport || '____________'}</U> (keyingi o'rinlarda <B>«Investor»</B> deb yuritiladi), ikkinchi tomondan;{'\n'}
            Tomonlar quyidagilar to'g'risida mazkur Shartnomani tuzdilar:
          </Text>
        </View>

        <Text style={s.secHead}>1. SHARTNOMA PREDMETI</Text>
        <View style={s.p}><Text><B>1.1 </B>Mazkur Shartnomaning predmeti: Tomonlar birgalikda Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastkada quriladigan "Yevro-Osiyo xalqaro savdo markazi" loyihasidir.</Text></View>
        <View style={s.p}><Text><B>1.2 </B>Ushbu investitsiya loyihasini amalga oshirish uchun Quruvchi o'z vakolatlari doirasida tegishli qurilish tashkilotlarini jalb qiladi; Investor yuqoridagi birgalikda qurilayotgan loyihaga pul mablag'larini (investitsiyani) kiritishni va ushbu Shartnomada belgilangan shartlar va muddatlarda ko'chmas mulkka egalik huquqini olishni o'z zimmasiga oladi.</Text></View>
        <View style={s.p}>
          <Text><B>1.3 </B>Loyihadagi ko'chmas mulk: Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastkada quriladigan "Yevro-Osiyo xalqaro savdo markazi" loyihasidagi <U>{blockId}-maydon</U>, <U>{bolimNum}-bino</U>, <U>{floor}-qavat</U>, <U>{aptNum}-do'kon</U>, maydoni <U>{apartment.size}</U> kv.m.</Text>
        </View>
        <View style={s.p}>
          <Text>
            <B>1.4 </B>Shartnomaning umumiy summasi: <U>{usd(total)} AQSH dollari</U> (QQS bilan birga), Investor yakuniy natijada ushbu ko'chmas mulkka to'liq egalik huquqini oladi.
            {hasCheg ? `\n       (Asl narx: ${usd(Math.round(aslM2 * apartment.size))} USD · chegirma: −${usd(chegM2)} USD/m² · yakuniy narx: ${usd(narxM2)} USD/m²)` : ''}
          </Text>
        </View>
        <View style={s.p}><Text><B>1.5 </B>Quruvchi investitsiya shartnomasining subyekti va boshqaruvchisi sifatida investitsiya faoliyatini ta'minlaydi; Investor Quruvchiga qurilish pudratchilariga nisbatan buyurtmachi vakolatlarini beradi.</Text></View>
        <View style={s.p}><Text><B>1.6 </B>Ko'chmas mulk standarti: Ko'chmas mulk Investorga topshirilgandan va mulk huquqi ro'yxatdan o'tkazilgandan so'ng, qurilish ishlarining mazmuni va sifati arxitektura loyiha tashkiloti tomonidan ishlab chiqilgan loyiha hujjatlariga mos kelishi shart.</Text></View>
        <View style={s.p}><Text><B>1.7 </B>Investor ko'chmas mulkka egalik huquqini olgan kundan boshlab, mustaqil ravishda tegishli tashkilotlar bilan suv, elektr energiyasi va boshqa kommunal xizmatlar uchun shartnomalar tuzadi va xarajatlarni o'z zimmasiga oladi.</Text></View>
        <View style={s.p}><Text><B>1.8 </B>Ko'chmas mulkning ichki qurilish standarti — Qora holatda: alyuminiy shisha eshik o'rnatilgan; tashqi devorlarda tosh bo'yoq; ichki qismlar devor bilan ajratilgan; zamin asosi tayyor; kuchli va zaif elektr simlari xonaga kiritilgan.</Text></View>
        <View style={s.p}><Text><B>1.9 </B>Quruvchi barcha loyiha-smeta hujjatlarini ishlab chiqish, takomillashtirish, tasdiqlash va barcha zarur ruxsatnomalarni olish majburiyatini oladi; o'z nomidan shartnomalar tuzadi, qurilishni tashkil etadi va Investorga tegishli ulushdagi ko'chmas mulkka egalik huquqini rasmiylashtiradi.</Text></View>

        <Text style={s.secHead}>2. TARAFLARNING HUQUQ VA MAJBURIYATLARI</Text>
        <View style={s.p}><Text><B>2.1 Investorning majburiyatlari va huquqlari</B></Text></View>
        <View style={s.p}>
          <Text><B>2.1.1 </B>Investor Quruvchi tomonidan taqdim etilgan bank hisob raqamiga birinchi to'lovni <U>{usd(boshl)} AQSH dollari</U> miqdorida to'laydi, investitsiyaning umumiy miqdori shartnoma amal qilish muddati davomida o'zgarmaydi, muddat: <U>{cdStr}</U> — <U>{endStr}</U>.</Text>
        </View>
        <View style={s.p}><Text><B>2.1.2 </B>Loyiha moliyalashtirish manbai xaridorlarning mablag'lari hisoblanadi, Investor to'lov jadvali (2-ilova) bo'yicha o'z vaqtida to'lovlarni amalga oshirishi shart, to'lovlar bank kartasi yoki bank o'tkazmasi orqali amalga oshirilishi mumkin.</Text></View>
        <View style={s.p}><Text><B>2.1.3 </B>Investor tomonidan to'langan investitsiya mablag'lari naqd pul kvitansiyasi yoki bank o'tkazmasi hujjati bilan tasdiqlanadi.</Text></View>
        <View style={s.p}><Text><B>2.2 Quruvchining majburiyatlari va huquqlari</B></Text></View>
        <View style={s.p}><Text><B>2.2.1 </B>Quruvchi O'zbekiston Respublikasining amaldagi qurilish normalari, loyiha-smeta hujjatlariga muvofiq, kelishilgan uchastkada ko'chmas mulk qurilishini yakunlashi shart.</Text></View>
        <View style={s.p}><Text><B>2.2.2 </B>Quruvchi shartnoma tuzilgan kundan boshlab <U>_______</U> yil ichida ko'chmas mulk qurilishini yakunlashi va Investorga barcha zarur hujjatlarni taqdim etishi shart; Investor barcha to'lovlarni to'liq to'lagandan so'ng, notarial tasdiqlash va mulk huquqini ro'yxatdan o'tkazish rasmiylashtiriladi; agar Investor ko'chmas mulkni topshirish paytida to'lovlarni to'lamagan bo'lsa, ko'chmas mulkka egalik huquqi Quruvchi nomiga ro'yxatdan o'tkaziladi va Investor foydalanish hamda boshqarish huquqiga ega bo'ladi, biroq Quruvchi ruxsatisiz uchinchi shaxslarga berish qat'iyan man etiladi.</Text></View>
        <View style={s.p}><Text><B>2.2.3 </B>Ko'chmas mulk davlat ro'yxatidan o'tkazilgandan so'ng 60 bank ish kuni ichida Investorga mulk huquqini ro'yxatdan o'tkazadi; tegishli xarajatlar Investor tomonidan qoplanadi.</Text></View>
        <View style={s.p}><Text><B>2.2.4 </B>Quruvchi ko'chmas mulk qurilishi mahalliy hokimiyat va qurilish idoralarining barcha qonuniy talablariga mos kelishini kafolatlaydi.</Text></View>
        <View style={s.p}><Text><B>2.2.5 </B>Quruvchi Investor bilan kelishilgan holda qurilish tugatish muddatini o'zgartirishi va bu haqda Investorga yozma ravishda xabar berishi mumkin.</Text></View>
        <View style={s.p}><Text><B>2.2.6 </B>Agar o'lchov maydoni 1.3-bandda belgilangan maydondan kichik bo'lsa, Quruvchi 60 bank ish kuni ichida Investorga ortiqcha to'langan pulni qaytaradi; agar maydon katta bo'lsa, Investor 30 kalendar kun ichida shartnomadagi birlik narxi bo'yicha farqni to'laydi.</Text></View>
        <View style={s.p}><Text><B>2.2.7 </B>Mazkur loyihaning umumiy foydalanishdagi hududlari, avtoturargohlar, tom yuzasi, tashqi devorlari va boshqa qo'shimcha inshootlarning tadbirkorlik huquqi Quruvchiga tegishlidir. Investor bunga e'tiroz bildirmaydi va Quruvchining normal tadbirkorlik faoliyatiga aralashmaslikni o'z zimmasiga oladi.</Text></View>

        <Text style={s.secHead}>3. KO'CHMAS MULK SIFATI KAFOLATI</Text>
        <View style={s.p}><Text><B>3.1 </B>Quruvchi ko'chmas mulk qurilish sifati uchun javobgar bo'lib, quyidagilarni kafolatlaydi: loyiha smetasiga qat'iy rioya qilgan holda qurilish; O'zbekiston qurilish normalari va standartlariga rioya qilish; ko'chmas mulkni belgilangan muddatda topshirish; ko'chmas mulkning rejalashtirish va loyiha talablariga mos kelishi.</Text></View>
        <View style={s.p}><Text><B>3.2 </B>Agar ko'chmas mulkda sifat nuqsonlari mavjud bo'lsa, Investor ko'chmas mulkni qabul qilgan kundan boshlab 6 oy ichida yozma ravishda e'tiroz bildirishi shart, Quruvchi nuqsonlarni tuzatish uchun javobgardir.</Text></View>

        <Text style={s.secHead}>4. TARAFLARNING JAVOBGARLIGI</Text>
        <View style={s.p}><Text><B>4.1.1 </B>Har bir kalendar yil davomida Investor bir marta to'lovni kechiktirish uchun imtiyozli davrga ega — eng ko'pi bilan 60 kalendar kun. Investor imtiyozli davr tugagunga qadar barcha muddati o'tgan to'lovlarni bir marta to'liq to'lashi shart.</Text></View>
        <View style={s.p}><Text><B>4.1.2 </B>Agar Investor to'lovni 60 kalendar kundan ortiq muddatga kechiktirsa, Quruvchi 10 kalendar kun oldin yozma bekor qilish xabarini yuborib, ushbu Shartnomani bir tomonlama bekor qilish huquqiga ega.</Text></View>
        <View style={s.p}><Text><B>4.1.3 </B>Shartnoma bekor qilingandan so'ng, Quruvchi yangi investor bilan rasmiy investitsiya shartnomasi tuzilgan kundan boshlab 180 bank ish kuni ichida avvalgi Investorga barcha mablag'larini qaytaradi, biroq quyidagilarni ushlab qolish huquqiga ega: (1) qurilish xarajatlari; (2) vositachilik komissiyasi — shartnoma umumiy summasining 5% dan oshmasligi; (3) bank xizmatlari va boshqa hujjatlashtirilgan xarajatlar. Barcha ushlab qolingan xarajatlar avvalgi Investor to'lagan umumiy summaning 10% dan oshmasligi kerak.</Text></View>
        <View style={s.p}><Text><B>4.2 </B>Investorning majburiyatlari: o'z vaqtida va to'liq hajmda to'lovlarni amalga oshirish; manzil va telefon o'zgartirilgandan so'ng 3 kun ichida yozma xabardor qilish; ko'chmas mulkni topshirish xabarnomasi olgandan so'ng 7 kun ichida qabul qilish; kommunal xarajatlarni o'z zimmasiga olish; mulk huquqi va Quruvchi yozma roziligini olmaguncha o'zgartirish ishlarini olib bormaslik; ko'chmas mulk tuzilishini o'zgartirmaslik; barcha to'lovlar to'liq to'lanmaguncha ushbu Shartnoma bo'yicha huquqlarini uchinchi shaxslarga bermaslik — buzilsa Quruvchi darhol bekor qilish huquqiga ega, to'langan mablag'lar qaytarilmaydi; mulk huquqini ro'yxatdan o'tkazish xarajatlarini o'z zimmasiga olish; Quruvchi roziligisiz suv, elektr, gaz tarmoqlariga ulanmaslik; umumiy hududlarni egallamaslik va Quruvchi boshqaruviga to'sqinlik qilmaslik.</Text></View>
        <View style={s.p}><Text><B>4.3 </B>Har qanday tomon majburiyatlarni bajarmasa yoki lozim darajada bajarmasa, O'zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo'ladi.</Text></View>
        <View style={s.p}><Text><B>4.4 </B>Investor to'lovlarni to'xtatish uchun malakali mustaqil ekspert tashkiloti tomonidan berilgan yozma xulosaga asoslanishi kerak. Aks holda, Investor to'lovlarni bir tomonlama to'xtata olmaydi.</Text></View>
        <View style={s.p}><Text><B>4.5 </B>Tomonlarning majburiyatlarni bajarmaganlik uchun javobgarligi O'zbekiston Respublikasining Fuqarolik Kodeksi va boshqa tegishli qonun hujjatlariga muvofiq belgilanadi.</Text></View>

        <Text style={s.secHead}>5. FORS-MAJOR</Text>
        <View style={s.p}><Text>Urush, tabiiy ofatlar, epidemiya, hukumat harakatlari kabi fors-major holatlari tufayli shartnomani bajarish imkoni bo'lmasa, tomonlar javobgar bo'lmaydi, majburiyatlar to'xtatiladi; 10 kun oldin yozma xabarnoma yuborib, shartnomani bekor qilish va haqiqiy xarajatlar asosida hisob-kitob qilish mumkin.</Text></View>

        <Text style={s.secHead}>6. NIZOLARNI HAL QILISH</Text>
        <View style={s.p}><Text><B>6.1 </B>Barcha nizolar birinchi navbatda muzokaralar yo'li bilan hal qilinadi.</Text></View>
        <View style={s.p}><Text><B>6.2 </B>Muzokaralar natija bermasa, ish Farg'ona shahrining vakolatli sudiga ko'rib chiqish uchun topshiriladi.</Text></View>

        <Text style={s.secHead}>7. YAKUNLOVCHI QOIDALAR</Text>
        <View style={s.p}><Text><B>7.1 </B>Ushbu Shartnoma tomonlarning yozma kelishuvi bilan bekor qilinishi mumkin; bir tomonlama bekor qilish shartnomada belgilangan shartlarga muvofiq amalga oshiriladi.</Text></View>
        <View style={s.p}><Text><B>7.2 </B>Ushbu Shartnoma shartlariga har qanday o'zgartirish, shu jumladan shartnoma tomonini o'zgartirish, tomonlarning kelishuvi asosida yozma shaklda qo'shimcha bitim imzolanishi bilan amalga oshiriladi.</Text></View>
        <View style={s.p}><Text><B>7.3 </B>Tomonlar shartnomani imzolashda aldash, majburlash, noto'g'ri tushunish mavjud emasligini va barcha shartlarni to'liq bilishlarini tasdiqlaydilar.</Text></View>
        <View style={s.p}><Text><B>7.4 </B>Ushbu Shartnoma ikki nusxada tuzilgan bo'lib, har bir tomonda bittadan nusxa saqlanadi va ikkala nusxa ham teng yuridik kuchga ega.</Text></View>

        {/* Party info table */}
        <View style={s.iTable}>
          <View style={s.iCol}>
            <Text style={s.iHead}>Quruvchi | HENG TAI MCHJ XK</Text>
            {[["Nomi","HENG TAI MCHJ XK"],["Manzil","Fargʼona viloyati, Fargʼona tumani"],["STIR","312256591"],["MFO","00440"],["H/r (USD)","20208840907268122001"],["H/r (soʼm)","20208000807268122001"],["Bank",'TOSHKENT SH., "UZSANOATKURILISHBANKI" ATB']].map(([l,v]) => (
              <View key={l} style={s.iRow}>
                <Text style={s.iLbl}>{l}:</Text>
                <Text style={s.iVal}>{v}</Text>
              </View>
            ))}
            <View style={[s.iRow,{marginTop:18,borderTopWidth:0.5,borderTopColor:'#e5e7eb'}]}>
              <Text style={s.iLbl}>Imzo:</Text>
              <Text style={[s.iVal,{borderBottomWidth:0.5,borderBottomColor:'#374151'}]}> </Text>
            </View>
          </View>
          <View style={s.iColL}>
            <Text style={s.iHead}>Investor</Text>
            {[["F.I.O.",investorName],["Manzil",form.manzil||"—"],["Pasport/ID",form.passport||"—"],["Pasport berilgan",form.passport_place||"—"],["Telefon",form.telefon||"—"]].map(([l,v]) => (
              <View key={l} style={s.iRow}>
                <Text style={s.iLbl}>{l}:</Text>
                <Text style={s.iVal}>{v}</Text>
              </View>
            ))}
            <View style={[s.iRow,{marginTop:18,borderTopWidth:0.5,borderTopColor:'#e5e7eb'}]}>
              <Text style={s.iLbl}>Imzo:</Text>
              <Text style={[s.iVal,{borderBottomWidth:0.5,borderBottomColor:'#374151'}]}> </Text>
            </View>
          </View>
        </View>

        {/* ── APPENDIX 1 ── */}
        <View break>
          <Text style={[s.title,{fontSize:9}]}>1-ILOVA: INVESTITSIYA TASDIQNOMASI</Text>
          <Text style={[s.sub,{marginBottom:10}]}>Shartnoma № {bookingId}  ·  {cdStr}</Text>

          <View style={s.p}>
            <Text>
              Men, <U>{investorName}</U>, quyidagilarni tasdiqlayman:{'\n\n'}
              {cdStr}-{bookingId}-sonli "Investitsiya shartnomasi"ga asosan, Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastkada qurilayotgan "Yevro-Osiyo xalqaro savdo markazi" loyihasidagi{' '}
              <U>{blockId}-maydon</U>, <U>{bolimNum}-bino</U>, <U>{floor}-qavat</U>, <U>{aptNum}-do'kon</U>, maydoni <U>{apartment.size}</U> kv.m,
              men tomonimdan sotib olingan va men ushbu Shartnomaga muvofiq barcha investitsiya to'lovlarini to'liq to'lash majburiyatini o'z zimmasiga olaman.
            </Text>
          </View>
          <View style={[s.p,{marginTop:6}]}>
            <Text>
              Men ushbu Shartnomaning barcha shartlarini to'liq bilaman va roziman. 2-ilovada belgilangan to'lov jadvaliga qat'iy rioya qilgan holda, har oyning <U>{payDay}</U>-kuniga qadar o'z vaqtida va to'liq hajmda to'lovlarni amalga oshirishni va'da qilaman.
            </Text>
          </View>
          <View style={[s.p,{marginTop:6}]}>
            <Text>
              Agar to'lovim 60 kalendar kundan ortiq muddatga kechiktirilsa, Quruvchining ushbu Shartnomaning 4.1-bandiga muvofiq shartnomani bir tomonlama bekor qilishiga roziman. Shartnoma bekor qilingandan so'ng, Quruvchi yangi investor bilan rasmiy investitsiya shartnomasi tuzilgan kundan boshlab 180 bank ish kuni ichida menga to'lagan barcha mablag'larimni qaytaradi, biroq quyidagilarni ushlab qolish huquqiga ega: (1) qurilish xarajatlari; (2) vositachilik komissiyasi — umumiy summaning 5% dan oshmasligi; (3) bank xizmatlari xarajatlari. Ushlab qolingan xarajatlar yig'indisi men to'lagan umumiy summaning 10% dan oshmasligi kerak.
            </Text>
          </View>

          <View style={s.signRow}>
            <View style={s.signCol}>
              <Text style={s.signHd}>F.I.O.:</Text>
              <View style={s.signLn}/><Text style={s.signHt}>{investorName}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={s.signHd}>Imzo:</Text>
              <View style={s.signLn}/><Text style={s.signHt}> </Text>
            </View>
          </View>
        </View>

        {/* ── APPENDIX 2 ── */}
        <View break>
          <Text style={[s.title,{fontSize:9}]}>2-ILOVA: INVESTITSIYA VA QURILISH TO'LOVLARI JADVALI</Text>
          <Text style={[s.sub,{marginBottom:8}]}>Shartnoma № {bookingId}  ·  {cdStr}</Text>

          <View style={s.sumRow}>
            {[["Jami summa",`${usd(total)} USD`],["Birlik narxi",narxM2>0?`${usd(narxM2)} USD/m\xB2`:"—"],["Boshlangʼich toʼlov",`${usd(boshl)} USD`],["Boʼlib toʼlash summasi",`${usd(qolgan)} USD`],["Boʼlib toʼlash muddati",`${fmtD(cd)} — ${fmtD(endDate)}`],["Oylik toʼlov",`${usd(oylik)} USD`]].map(([l,v])=>(
              <View key={l} style={s.sumCell}>
                <Text style={s.sumLbl}>{l}</Text>
                <Text style={s.sumVal}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={s.aTable}>
            <View style={s.aHead}>
              <Text style={[s.th,{width:22}]}>№</Text>
              <Text style={[s.th,{width:68}]}>Sana</Text>
              <Text style={[s.th,{flex:1}]}>To'lov summasi (USD)</Text>
              <Text style={[s.thL,{flex:1}]}>Qolgan summa (USD)</Text>
            </View>
            {schedule.map((row,i)=>(
              <View key={row.num} style={i%2===0?s.aRow:s.aRowAlt}>
                <Text style={[s.td,{width:22}]}>{row.num}</Text>
                <Text style={[s.td,{width:68}]}>{row.date}</Text>
                <Text style={[s.td,{flex:1}]}>{usd(row.amount)}</Text>
                <Text style={[s.tdL,{flex:1}]}>{usd(row.remaining)}</Text>
              </View>
            ))}
          </View>

          <Text style={s.note}>
            * Agar mijoz to'lovni so'mda amalga oshirsa, to'lov kuni amaldagi valyuta kursi bo'yicha so'mga aylantirilib to'lanadi.{'\n'}
            Bank: TOSHKENT SH., "UZSANOATKURILISHBANKI" ATB BOS OFISI  ·  MFO: 00440  ·  STIR: 312256591{'\n'}
            H/r (USD): 20208840907268122001  ·  H/r (so'm): 20208000807268122001
          </Text>
        </View>
      </Page>
    </Document>
  )
}
