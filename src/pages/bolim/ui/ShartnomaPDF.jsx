import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Roboto-Bold.ttf',    fontWeight: 700 },
  ],
})
Font.register({
  family: 'NotoSC',
  fonts: [
    { src: '/fonts/NotoSansSC-Regular.otf', fontWeight: 400 },
    { src: '/fonts/NotoSansSC-Bold.otf',    fontWeight: 700 },
  ],
})

const BD = '#d1d5db'
const s = StyleSheet.create({
  page:    { padding: '22 28', fontFamily: 'Roboto', fontSize: 7, color: '#111827', lineHeight: 1.45 },
  zh:      { fontFamily: 'NotoSC', fontSize: 6.5, color: '#111827', lineHeight: 1.4, wordBreak: 'break-all' },
  zhB:     { fontFamily: 'NotoSC', fontWeight: 700, fontSize: 6.5, color: '#111827', lineHeight: 1.4, wordBreak: 'break-all' },
  uz:      { fontFamily: 'Roboto', fontSize: 7, color: '#111827', lineHeight: 1.45 },
  uzB:     { fontFamily: 'Roboto', fontWeight: 700, fontSize: 7, color: '#111827' },
  title:   { fontFamily: 'NotoSC', fontWeight: 700, fontSize: 9.5, textAlign: 'center', marginBottom: 1 },
  titleUz: { fontFamily: 'Roboto', fontWeight: 700, fontSize: 9.5, textAlign: 'center', marginBottom: 8 },
  secZh:   { fontFamily: 'NotoSC', fontWeight: 700, fontSize: 7, marginTop: 7, marginBottom: 1,
             paddingBottom: 1.5, borderBottomWidth: 0.5, borderBottomColor: BD },
  secUz:   { fontFamily: 'Roboto', fontWeight: 700, fontSize: 7, marginBottom: 4 },
  block:   { marginBottom: 3.5 },
  // party table
  ptbl:    { borderWidth: 0.5, borderColor: BD, flexDirection: 'row', marginTop: 10 },
  pcol:    { flex: 1, borderRightWidth: 0.5, borderRightColor: BD },
  pcolR:   { flex: 1 },
  phd:     { padding: '3 5', fontFamily: 'NotoSC', fontWeight: 700, fontSize: 7,
             backgroundColor: '#f3f4f6', borderBottomWidth: 0.5, borderBottomColor: BD, textAlign: 'center' },
  prow:    { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', minHeight: 14 },
  plbl:    { width: 72, padding: '2 5', fontSize: 6, color: '#6b7280', fontFamily: 'NotoSC',
             borderRightWidth: 0.5, borderRightColor: '#f0f0f0' },
  pval:    { flex: 1, padding: '2 5', fontSize: 7 },
  signRow: { flexDirection: 'row', marginTop: 14, gap: 20 },
  signCol: { flex: 1 },
  signLn:  { borderBottomWidth: 0.5, borderBottomColor: '#374151', marginTop: 16, marginBottom: 2 },
  signHt:  { fontSize: 6, color: '#9ca3af' },
  // annex 2
  sumRow:  { flexDirection: 'row', gap: 4, marginBottom: 6 },
  sumCell: { flex: 1, borderWidth: 0.5, borderColor: BD, padding: '3 4', borderRadius: 2 },
  sumLbl:  { fontSize: 5.5, color: '#6b7280', marginBottom: 1, fontFamily: 'NotoSC' },
  sumVal:  { fontFamily: 'Roboto', fontWeight: 700, fontSize: 7 },
  tbl:     { borderWidth: 0.5, borderColor: BD },
  thd:     { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 0.5, borderBottomColor: BD },
  trow:    { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  trowA:   { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', backgroundColor: '#fafafa' },
  th:      { padding: '2.5 3', fontFamily: 'NotoSC', fontWeight: 700, fontSize: 6, textAlign: 'center',
             borderRightWidth: 0.5, borderRightColor: BD },
  thL:     { padding: '2.5 3', fontFamily: 'NotoSC', fontWeight: 700, fontSize: 6, textAlign: 'center' },
  td:      { padding: '2 3', fontSize: 6.5, textAlign: 'center', borderRightWidth: 0.5, borderRightColor: '#f0f0f0' },
  tdL:     { padding: '2 3', fontSize: 6.5, textAlign: 'center' },
  note:    { fontSize: 5.5, color: '#6b7280', marginTop: 5, lineHeight: 1.5, fontFamily: 'NotoSC' },
})

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
function usd(v) { const x = Number(v); return x > 0 ? x.toLocaleString('ru-RU') : '0' }

function calcSchedule(total, down, months, startDate) {
  const remCents = Math.round((total - down) * 100)
  const moCents  = Math.floor(remCents / months)
  const lastCents = remCents - moCents * (months - 1)
  let runCents = remCents
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(startDate)
    d.setMonth(d.getMonth() + i + 1)
    const amt = i === months - 1 ? lastCents : moCents
    runCents -= amt
    return { num: i + 1, date: fmtD(d), amount: amt / 100, remaining: runCents / 100 }
  })
}

function ZhRow({ zh, uz, bold }) {
  return (
    <View style={s.block}>
      <Text style={bold ? s.zhB : s.zh}>{zh}</Text>
      <Text style={bold ? [s.uzB, { marginTop: 0.5 }] : [s.uz, { marginTop: 0.5 }]}>{uz}</Text>
    </View>
  )
}
function U({ children }) { return <Text style={{ textDecoration: 'underline' }}>{children}</Text> }

export function ShartnomaPDF({ apartment, floor, blockId, bolimNum, form, contractDate, bookingId, contractNumber }) {
  const aptNum  = (apartment.address ?? '').split('-').pop()
  const total   = n(form.umumiy) || (n(form.narx_m2) > 0 && apartment.size > 0 ? Math.round(n(form.narx_m2) * apartment.size) : 0)
  const boshl   = n(form.boshlangich)
  const oylar   = parseInt(form.oylar) || 12
  const narxM2  = n(form.narx_m2)
  const qolgan  = Math.max(0, total - boshl)
  const cd      = contractDate instanceof Date ? contractDate : new Date()
  const investorName = `${form.ism || ''} ${form.familiya || ''}`.trim()
  const cdStr   = fmtUZ(cd)
  const schedule = calcSchedule(total, boshl, oylar, cd)
  const lastDate = schedule.length > 0 ? schedule[schedule.length - 1].date : fmtD(cd)
  const endDateObj = schedule.length > 0 ? (() => { const p = schedule[schedule.length-1].date.split('.'); return new Date(+p[2],+p[1]-1,+p[0]) })() : cd
  const endStr  = fmtUZ(endDateObj)
  const molylik = schedule.length > 0 ? schedule[0].amount : 0
  const contractNum = contractNumber || `#${bookingId}`

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* TITLE */}
        <Text style={s.title}>关于共同参与投资及商贸中心项目建设的合同</Text>
        <Text style={s.titleUz}>Investitsiya va savdo markazini qurish bo'yicha hamkorlik shartnomasi</Text>
        <Text style={[s.zh, { textAlign: 'center', marginBottom: 1 }]}>
          合同号 {contractNum}  ·  {fmtD(cd)}  ·  费尔干纳市
        </Text>
        <Text style={[s.uz, { textAlign: 'center', marginBottom: 9, color: '#6b7280' }]}>
          Shartnoma № {contractNum}  ·  {cdStr}  ·  Farg'ona shahri
        </Text>

        {/* PARTIES */}
        <View style={[s.block, { marginBottom: 7 }]}>
          <Text style={s.zh}>
            «HENG TAI» MCHJ XK（下称"建设方"），依据章程开展活动，由 ZHANG XIAOLI 代表，作为一方；{'\n'}
            自然人：{investorName}，护照号/身份证号：{form.passport || '__________'}（下称"投资方"），作为另一方；{'\n'}
            双方就以下内容签订本合同：
          </Text>
          <Text style={[s.uz, { marginTop: 1.5 }]}>
            «HENG TAI» MCHJ XK (keyingi o'rinlarda «Quruvchi» deb yuritiladi), Nizom asosida faoliyat yurituvchi ZHANG XIAOLI nomidan, bir tomondan;{'\n'}
            Jismoniy shaxs: <U>{investorName}</U>, Pasport / ID raqami: <U>{form.passport || '__________'}</U> (keyingi o'rinlarda «Investor» deb yuritiladi), ikkinchi tomondan;{'\n'}
            Tomonlar quyidagilar to'g'risida mazkur Shartnomani tuzdilar:
          </Text>
        </View>

        {/* 1 */}
        <Text style={s.secZh}>1. 合同标的 | SHARTNOMA PREDMETI</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>1. SHARTNOMA PREDMETI</Text>

        <ZhRow
          zh="1.1 本合同标的为：双方共同在 Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148号地块 建设的亚欧国际商贸中心项目。"
          uz="1.1 Mazkur Shartnomaning predmeti: Tomonlar birgalikda Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastka da quriladigan «Yevro-Osiyo xalqaro savdo markazi» loyihasidir."
        />
        <ZhRow
          zh="1.2 为实施本投资项目，建设方将在其权限内吸引相关建筑机构；投资方承诺对上述共建项目投入资金并按本合同约定条件与期限取得房屋所有权。"
          uz="1.2 Ushbu investitsiya loyihasini amalga oshirish uchun Quruvchi o'z vakolatlari doirasida tegishli qurilish tashkilotlarini jalb qiladi; Investor yuqoridagi birgalikda qurilayotgan loyihaga pul mablag'larini kiritishni va ushbu Shartnomada belgilangan shartlar va muddatlarda ko'chmas mulkka egalik huquqini olishni o'z zimmasiga oladi."
        />
        <View style={s.block}>
          <Text style={s.zh}>
            1.3 项目房源：Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148号地块建设的亚欧国际商贸中心项目，
            {blockId}-区 {bolimNum}-栋 {floor}-层 {aptNum}-号商铺，面积 {apartment.size} 平方米。
          </Text>
          <Text style={[s.uz, { marginTop: 0.5 }]}>
            1.3 Loyihadagi ko'chmas mulk: Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastkada quriladigan «Yevro-Osiyo xalqaro savdo markazi» loyihasidagi{' '}
            <U>{blockId}-maydon</U>, <U>{bolimNum}-bino</U>, <U>{floor}-qavat</U>, <U>{aptNum}-do'kon</U>, maydoni <U>{apartment.size}</U> kv.m.
          </Text>
        </View>
        <View style={s.block}>
          <Text style={s.zh}>
            1.4 合同总金额：{usd(total)} 美元（含增值税），投资方最终取得该房屋完整所有权。
          </Text>
          <Text style={[s.uz, { marginTop: 0.5 }]}>
            1.4 Shartnomaning umumiy summasi: <U>{usd(total)} AQSH dollari</U> (QQS bilan birga), Investor yakuniy natijada ushbu ko'chmas mulkka to'liq egalik huquqini oladi.
          </Text>
        </View>
        <ZhRow
          zh="1.5 建设方作为投资合同主体与管理人保障投资活动；投资方授予建设方对施工单位的发包方权限。"
          uz="1.5 Quruvchi investitsiya shartnomasining subyekti va boshqaruvchisi sifatida investitsiya faoliyatini ta'minlaydi; Investor Quruvchiga qurilish pudratchilariga nisbatan buyurtmachi vakolatlarini beradi."
        />
        <ZhRow
          zh="1.6 房屋标准：交付投资方并完成产权登记后，房屋施工内容与质量须符合建筑设计单位出具的项目方案。"
          uz="1.6 Ko'chmas mulk standarti: Ko'chmas mulk Investorga topshirilgandan va mulk huquqi ro'yxatdan o'tkazilgandan so'ng, qurilish ishlarining mazmuni va sifati arxitektura loyiha tashkiloti tomonidan ishlab chiqilgan loyiha hujjatlariga mos kelishi shart."
        />
        <ZhRow
          zh="1.7 投资方自取得房屋产权之日起，自行与相关机构签订水电等公共服务合同并承担费用。"
          uz="1.7 Investor ko'chmas mulkka egalik huquqini olgan kundan boshlab, mustaqil ravishda tegishli tashkilotlar bilan suv, elektr energiyasi va boshqa kommunal xizmatlar uchun shartnomalar tuzadi va xarajatlarni o'z zimmasiga oladi."
        />
        <ZhRow
          zh="1.8 房屋内部完工标准（毛坯）：安装铝合金玻璃门；外墙真石漆；内部隔墙完成（可直接装修）；地面基层（找平层）完成；强弱电线入户。"
          uz="1.8 Ko'chmas mulkning ichki qurilish standarti (qora holatda): alyuminiy shisha eshik o'rnatilgan; tashqi devorlarda tosh bo'yoq; ichki qismlar devor bilan ajratilgan (to'g'ridan-to'g'ri ta'mirlash mumkin); zamin asosi (shpalyovka) tayyor; kuchli va zaif elektr simlari xonaga kiritilgan."
        />
        <ZhRow
          zh="1.9 建设方负责编制、完善、审批全部设计预算及文件，并取得所有必需许可；以自身名义签订合同、组织施工、完成竣工验收，并向投资方办理对应份额房屋的产权证明，承担本合同全部义务。"
          uz="1.9 Quruvchi barcha loyiha-smeta hujjatlarini ishlab chiqish, takomillashtirish, tasdiqlash va barcha zarur ruxsatnomalarni olish majburiyatini oladi; o'z nomidan shartnomalar tuzadi, qurilishni tashkil etadi, qurilishni tugatish va topshirishda ishtirok etadi va Investorga tegishli ulushdagi ko'chmas mulkka egalik huquqini rasmiylashtiradi, ushbu Shartnoma bo'yicha barcha majburiyatlarni o'z zimmasiga oladi."
        />

        {/* 2 */}
        <Text style={s.secZh}>2. 双方权利与义务 | TARAFLARNING HUQUQ VA MAJBURIYATLARI</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>2. TARAFLARNING HUQUQ VA MAJBURIYATLARI</Text>
        <ZhRow zh="2.1 投资方义务与权利" uz="2.1 Investorning majburiyatlari va huquqlari" bold />
        <View style={s.block}>
          <Text style={s.zh}>
            2.1.1 投资方应按建设方提供的银行账户，支付首期款：{usd(boshl)} 美元，投资总额在合同有效期内保持不变，期限：{fmtD(cd)} — {lastDate}。
          </Text>
          <Text style={[s.uz, { marginTop: 0.5 }]}>
            2.1.1 Investor Quruvchi tomonidan taqdim etilgan bank hisob raqamiga birinchi to'lovni <U>{usd(boshl)} AQSH dollari</U> miqdorida to'laydi, investitsiyaning umumiy miqdori shartnoma amal qilish muddati davomida o'zgarmaydi, muddat: <U>{cdStr}</U> — <U>{endStr}</U>.
          </Text>
        </View>
        <ZhRow
          zh="2.1.2 项目资金来源为购房人出资，投资方须按付款计划表（附件二）按期支付，可通过银行卡或银行转账支付。"
          uz="2.1.2 Loyiha moliyalashtirish manbai xaridorlarning mablag'lari hisoblanadi, Investor to'lov jadvali (2-ilova) bo'yicha o'z vaqtida to'lovlarni amalga oshirishi shart, to'lovlar bank kartasi yoki bank o'tkazmasi orqali amalga oshirilishi mumkin."
        />
        <ZhRow
          zh="2.1.3 投资方支付的投资款以现金收款收据或银行转账凭证为准。"
          uz="2.1.3 Investor tomonidan to'langan investitsiya mablag'lari naqd pul kvitansiyasi yoki bank o'tkazmasi hujjati bilan tasdiqlanadi."
        />
        <ZhRow zh="2.2 建设方义务与权利" uz="2.2 Quruvchining majburiyatlari va huquqlari" bold />
        <ZhRow
          zh="2.2.1 建设方须按乌兹别克斯坦现行建筑规范、设计预算文件，在约定地块完成房屋建设。"
          uz="2.2.1 Quruvchi O'zbekiston Respublikasining amaldagi qurilish normalari, loyiha-smeta hujjatlariga muvofiq, kelishilgan uchastkada ko'chmas mulk qurilishini yakunlashi shart."
        />
        <ZhRow
          zh="2.2.2 建设方应在合同签订后     年内完成房屋建设，并向投资方提供办理房屋买卖合同公证、不动产登记所需全套文件；投资方付清全部款项后，正式办理公证与产权登记；若投资方在房屋交付时未付清全部款项，则房屋产权登记在建设方名下，投资方拥有该房屋的使用权和经营权，未经建设方许可严禁将使用权和经营权转让给第三方；投资方付清全部款项后，建设方配合投资方办理公证与产权登记，相关费用由投资方自行承担。"
          uz="2.2.2 Quruvchi shartnoma tuzilgan kundan boshlab _____ yil ichida ko'chmas mulk qurilishini yakunlashi va Investorga ko'chmas mulk oldi-sotdi shartnomasini notarial tasdiqlash va ko'chmas mulk huquqini ro'yxatdan o'tkazish uchun zarur bo'lgan barcha hujjatlarni taqdim etishi shart; Investor barcha to'lovlarni to'liq to'lagandan so'ng, notarial tasdiqlash va mulk huquqini ro'yxatdan o'tkazish rasmiylashtiriladi; agar Investor ko'chmas mulkni topshirish paytida barcha to'lovlarni to'lamagan bo'lsa, ko'chmas mulkka egalik huquqi Quruvchi nomiga ro'yxatdan o'tkaziladi, Investor ushbu ko'chmas mulkdan foydalanish va uni boshqarish huquqiga ega bo'ladi, Quruvchining ruxsatisiz foydalanish va boshqarish huquqini uchinchi shaxslarga berish qat'iyan man etiladi; Investor barcha to'lovlarni to'liq to'lagandan so'ng, Quruvchi Investorga notarial tasdiqlash va mulk huquqini ro'yxatdan o'tkazishda yordam beradi, bunda yuzaga keladigan barcha xarajatlar Investor tomonidan o'z zimmasiga olinadi."
        />
        <ZhRow
          zh="2.2.3 房屋完成国家登记后60个银行工作日内，为投资方办理合同约定房屋的产权登记；相关费用由投资方承担；因投资方资金不足导致登记延误，建设方不承担责任。"
          uz="2.2.3 Ko'chmas mulk davlat ro'yxatidan o'tkazilgandan so'ng 60 bank ish kuni ichida Investorga shartnomada belgilangan ko'chmas mulkka egalik huquqini ro'yxatdan o'tkazadi; tegishli xarajatlar Investor tomonidan qoplanadi; Investorning mablag'lari yetishmasligi tufayli ro'yxatdan o'tkazish kechiktirilgan taqdirda, Quruvchi javobgar bo'lmaydi."
        />
        <ZhRow
          zh="2.2.4 建设方保证房屋建设符合地方政府及建筑主管部门全部法定要求。"
          uz="2.2.4 Quruvchi ko'chmas mulk qurilishi mahalliy hokimiyat va qurilish idoralarining barcha qonuniy talablariga mos kelishini kafolatlaydi."
        />
        <ZhRow
          zh="2.2.5 经与投资方协商，建设方可调整竣工日期，并书面通知投资方。"
          uz="2.2.5 Quruvchi Investor bilan kelishilgan holda qurilish tugatish muddatini o'zgartirishi va bu haqda Investorga yozma ravishda xabar berishi mumkin."
        />
        <ZhRow
          zh="2.2.6 若测绘面积小于1.3条约定面积，建设方应在交付房屋后60个银行工作日内向投资方退还多收房款；若面积超出，投资方应在30个日历日内按合同单价补差价。"
          uz="2.2.6 Agar o'lchov maydoni 1.3-bandda belgilangan maydondan kichik bo'lsa, Quruvchi ko'chmas mulkni topshirgandan so'ng 60 bank ish kuni ichida Investorga ortiqcha to'langan pulni qaytaradi; agar maydon katta bo'lsa, Investor 30 kalendar kun ichida shartnomadagi birlik narxi bo'yicha farqni to'laydi."
        />
        <ZhRow
          zh="2.2.7 本项目公共区域、停车场、建筑楼顶屋面、外墙立面及其他配套设施设备的经营权归属于建设方。项目投入使用后，由建设方自行或其委托的专业运营公司统一经营管理，相关收益由建设方享有。投资方对此无异议，并承诺不干涉建设方或其委托方的正常经营活动。"
          uz="2.2.7 Mazkur loyihaning umumiy foydalanishdagi hududlari, avtoturargohlar, binoning tom yuzasi, tashqi devorlari hamda boshqa qo'shimcha inshootlar va jihozlarning tadbirkorlik faoliyatini yuritish huquqi Quruvchiga tegishlidir. Loyiha foydalanishga topshirilgandan so'ng, Quruvchi tomonidan yoki u vakolat bergan professional ekspluatatsiya kompaniyasi tomonidan yagona boshqaruv amalga oshiriladi, tegishli daromadlar Quruvchi tomonidan o'zlashtiriladi. Investor bunga e'tiroz bildirmaydi va Quruvchi yoki uning vakolat bergan shaxsining normal tadbirkorlik faoliyatiga aralashmaslikka majbur ekanligini tasdiqlaydi."
        />

        {/* 3 */}
        <Text style={s.secZh}>3. 房屋质量保证 | KO'CHMAS MULK SIFATI KAFOLATI</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>3. KO'CHMAS MULK SIFATI KAFOLATI</Text>
        <ZhRow
          zh="3.1 建设方对房屋建设质量负责，保证：严格按设计预算施工；遵守乌兹别克斯坦建筑规范标准；按期交付房屋；房屋符合规划与设计要求。"
          uz="3.1 Quruvchi ko'chmas mulk qurilish sifati uchun javobgar bo'lib, quyidagilarni kafolatlaydi: loyiha smetasiga qat'iy rioya qilgan holda qurilish; O'zbekiston qurilish normalari va standartlariga rioya qilish; ko'chmas mulkni belgilangan muddatda topshirish; ko'chmas mulkning rejalashtirish va loyiha talablariga mos kelishi."
        />
        <ZhRow
          zh="3.2 若房屋存在质量缺陷，投资方应在收房后6个月内书面提出异议，建设方负责维修。"
          uz="3.2 Agar ko'chmas mulkda sifat nuqsonlari mavjud bo'lsa, Investor ko'chmas mulkni qabul qilgan kundan boshlab 6 oy ichida yozma ravishda e'tiroz bildirishi shart, Quruvchi nuqsonlarni tuzatish uchun javobgardir."
        />

        {/* 4 */}
        <Text style={s.secZh}>4. 违约责任 | TARAFLARNING JAVOBGARLIGI</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>4. TARAFLARNING JAVOBGARLIGI</Text>
        <ZhRow zh="4.1 投资方逾期付款的责任" uz="4.1 Investorning to'lovlarini kechiktirish uchun javobgarligi" bold />
        <ZhRow
          zh="4.1.1 每个自然年度内，投资方享有一次逾期付款的豁免权限，豁免期限最长不超过60个日历日。投资方应在豁免期限届满前一次性补足全部逾期款项。"
          uz="4.1.1 Har bir kalendar yil davomida Investor bir marta to'lovni kechiktirish uchun imtiyozli davrga ega, bu muddat eng ko'pi bilan 60 kalendar kunni tashkil etadi. Investor imtiyozli davr tugagunga qadar barcha muddati o'tgan to'lovlarni bir marta to'liq to'lashi shart."
        />
        <ZhRow
          zh="4.1.2 若投资方逾期付款超过60个日历日，建设方有权提前10个日历日向投资方发出书面解除通知，单方解除本合同。"
          uz="4.1.2 Agar Investor to'lovni 60 kalendar kundan ortiq muddatga kechiktirsa, Quruvchi 10 kalendar kun oldin Investorga yozma bekor qilish to'g'risida xabar yuborib, ushbu Shartnomani bir tomonlama bekor qilish huquqiga ega."
        />
        <ZhRow
          zh="4.1.3 合同解除后，建设方应在重新就本合同项下商铺与新的投资方签订正式投资协议之日起180个银行工作日内，向原投资方退还其已支付的全部款项，但建设方有权扣除以下费用：（1）合同解除前已发生的建设成本；（2）中介佣金，不超过合同总金额的5%；（3）银行手续费及其他有书面凭证的合理支出。上述各项扣除金额合计不得超过原投资方已付总金额的10%。"
          uz="4.1.3 Shartnoma bekor qilingandan so'ng, Quruvchi yangi investor bilan rasmiy investitsiya shartnomasi tuzilgan kundan boshlab 180 bank ish kuni ichida avvalgi Investorga uning to'lagan barcha mablag'larini qaytaradi, biroq quyidagilarni ushlab qolish huquqiga ega: (1) qurilish xarajatlari (loyihalash, geologik qidiruv, davlat yig'imlari, materiallar, ishchi kuchi); (2) vositachilik komissiyasi — shartnoma umumiy summasining 5% dan oshmasligi; (3) bank xizmatlari va boshqa hujjatlashtirilgan asosli xarajatlar. Barcha ushlab qolingan xarajatlar yig'indisi avvalgi Investor to'lagan umumiy summaning 10% dan oshmasligi kerak."
        />
        <ZhRow zh="4.2 投资方义务" uz="4.2 Investorning majburiyatlari:" bold />
        <ZhRow
          zh="4.2.1–4.2.11 按期足额支付房款；地址、电话变更后3日内书面通知建设方；收到交房书面通知后7日内验收签署交接单；自行承担物业费、水电费、维修费等运营费用；未取得产权及建设方书面同意前不得擅自装修；不得擅自改变房屋结构、工程系统、设备管线；未付清全部合同款项前不得以任何形式将本合同权利转让给第三方，违者建设方有权立即解除合同，已收款项不予退还；自行承担产权登记全部费用；收房后自行承担房产税、公共服务费；未经建设方同意不得私自接驳水电燃气；不得占用、破坏或擅自处分项目公共区域。"
          uz="4.2.1–4.2.11 O'z vaqtida va to'liq hajmda to'lovlarni amalga oshirish; manzil va telefon o'zgartirilgandan so'ng 3 kun ichida yozma xabardor qilish; ko'chmas mulkni topshirish xabarnomasi olgandan so'ng 7 kun ichida qabul qilish va topshirish dalolatnomasini imzolash; kommunal xarajatlarni o'z zimmasiga olish; mulk huquqi va Quruvchi yozma roziligini olmaguncha o'zgartirish ishlarini olib bormaslik; ko'chmas mulk tuzilishini va muhandislik tizimlarini o'zgartirmaslik; barcha to'lovlar to'liq to'lanmaguncha ushbu Shartnoma bo'yicha huquqlarini uchinchi shaxslarga bermaslik (buzilsa — darhol bekor qilish, to'langan mablag'lar qaytarilmaydi); mulk huquqini ro'yxatdan o'tkazish xarajatlarini o'z zimmasiga olish; mol-mulk solig'i va kommunal xizmatlar uchun to'lovlarni o'z zimmasiga olish; Quruvchi roziligisiz suv, elektr va gaz tarmoqlariga ulanmaslik; umumiy hududlarni egallamaslik va Quruvchi boshqaruviga to'sqinlik qilmaslik."
        />
        <ZhRow
          zh="4.3 任何一方不履行或不当履行义务，按乌兹别克斯坦法律承担责任。"
          uz="4.3 Har qanday tomon majburiyatlarni bajarmasa yoki lozim darajada bajarmasa, O'zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo'ladi."
        />
        <ZhRow
          zh="4.4 投资方暂停付款须基于有资质的独立鉴定机构出具的书面结论，证明房屋存在重大结构安全缺陷。否则，投资方不得单方暂停付款。"
          uz="4.4 Investor to'lovlarni to'xtatish uchun malakali mustaqil ekspert tashkiloti tomonidan berilgan yozma xulosaga asoslanishi kerak, unda ko'chmas mulkda jiddiy konstruktiv xavfsizlik nuqsonlari mavjudligi isbotlanishi lozim. Aks holda, Investor to'lovlarni bir tomonlama to'xtata olmaydi."
        />
        <ZhRow
          zh="4.5 除上述情况外，双方对未履行或未适当履行本合同项下的义务的责任，按照乌兹别克斯坦《民法典》、《乌兹别克斯坦合同法》和其他相关法律法规的规定确定。"
          uz="4.5 Yuqoridagi holatlar bundan mustasno, tomonlarning ushbu Shartnoma bo'yicha majburiyatlarni bajarmaganlik yoki lozim darajada bajarmaganlik uchun javobgarligi O'zbekiston Respublikasining Fuqarolik Kodeksi, Shartnomalar to'g'risidagi qonuni va boshqa tegishli qonun hujjatlariga muvofiq belgilanadi."
        />

        {/* 5 */}
        <Text style={s.secZh}>5. 不可抗力 | FORS-MAJOR</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>5. FORS-MAJOR</Text>
        <ZhRow
          zh="因战争、自然灾害、疫情、政府行为等不可抗力导致无法履约，双方免责，义务暂停；可提前10日书面通知终止合同并据实结算。"
          uz="Urush, tabiiy ofatlar, epidemiya, hukumat harakatlari kabi fors-major holatlari tufayli shartnomani bajarish imkoni bo'lmasa, tomonlar javobgar bo'lmaydi, majburiyatlar to'xtatiladi; 10 kun oldin yozma xabarnoma yuborib, shartnomani bekor qilish va haqiqiy xarajatlar asosida hisob-kitob qilish mumkin."
        />

        {/* 6 */}
        <Text style={s.secZh}>6. 争议解决 | NIZOLARNI HAL QILISH</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>6. NIZOLARNI HAL QILISH</Text>
        <ZhRow zh="6.1 所有争议优先通过协商解决。" uz="6.1 Barcha nizolar birinchi navbatda muzokaralar yo'li bilan hal qilinadi." />
        <ZhRow zh="6.2 协商不成，提交费尔干纳市有管辖权法院审理。" uz="6.2 Muzokaralar natija bermasa, ish Farg'ona shahrining vakolatli sudiga ko'rib chiqish uchun topshiriladi." />

        {/* 7 */}
        <Text style={s.secZh}>最终条款 | YAKUNLOVCHI QOIDALAR</Text>
        <Text style={[s.secUz, { marginBottom: 3 }]}>7. YAKUNLOVCHI QOIDALAR</Text>
        <ZhRow
          zh="7.1 本合同可经双方书面协议解除；单方解除按合同约定条件执行。"
          uz="7.1 Ushbu Shartnoma tomonlarning yozma kelishuvi bilan bekor qilinishi mumkin; bir tomonlama bekor qilish shartnomada belgilangan shartlarga muvofiq amalga oshiriladi."
        />
        <ZhRow
          zh="7.2 对本合同条款的任何变更，包括变更合同主体（债权转让、债务转移等），均需双方协商一致，并以书面形式签署补充协议。"
          uz="7.2 Ushbu Shartnoma shartlariga har qanday o'zgartirish, shu jumladan shartnoma tomonini o'zgartirish (talab huquqini topshirish, qarzni o'tkazish va boshqalar) tomonlarning kelishuvi asosida yozma shaklda qo'shimcha bitim imzolanishi bilan amalga oshiriladi."
        />
        <ZhRow
          zh="7.3 双方确认签署合同时不存在欺诈、胁迫、误解，已充分知悉全部条款。"
          uz="7.3 Tomonlar shartnomani imzolashda aldash, majburlash, noto'g'ri tushunish mavjud emasligini va barcha shartlarni to'liq bilishlarini tasdiqlaydilar."
        />
        <ZhRow
          zh="7.4 本合同一式两份，双方各执一份，具有同等法律效力。"
          uz="7.4 Ushbu Shartnoma ikki nusxada tuzilgan bo'lib, har bir tomonda bittadan nusxa saqlanadi va ikkala nusxa ham teng yuridik kuchga ega."
        />

        {/* PARTY TABLE */}
        <View style={s.ptbl}>
          <View style={s.pcol}>
            <Text style={s.phd}>建设方 | Quruvchi</Text>
            {[
              ['名称 | Nomi', 'HENG TAI MCHJ XK'],
              ['地址 | Manzil', 'Farg\'ona viloyati, Farg\'ona tumani'],
              ['销售地址 | Savdo manzili', ''],
              ['税号 | STIR', '312256591'],
              ['MFO', '00440'],
              ['账户 | H/r (USD)', '20208840907268122001'],
              ['账户 | H/r (so\'m)', '20208000807268122001'],
              ['银行 | Bank', 'TOSHKENT SH., "UZSANOATKURILISHBANKI" ATB'],
              ['电话 | Telefon', ''],
            ].map(([l,v]) => (
              <View key={l} style={s.prow}>
                <Text style={s.plbl}>{l}:</Text>
                <Text style={s.pval}>{v}</Text>
              </View>
            ))}
            <View style={[s.prow, { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#e5e7eb' }]}>
              <Text style={s.plbl}>签名 | Imzo:</Text>
              <Text style={[s.pval, { borderBottomWidth: 0.5, borderBottomColor: '#374151' }]}> </Text>
            </View>
          </View>
          <View style={s.pcolR}>
            <Text style={s.phd}>投资方 | Investor</Text>
            {[
              ['姓名 | F.I.O.', investorName],
              ['地址 | Manzil', form.manzil || ''],
              ['护照/ID | Pasport/ID', form.passport || ''],
              ['签发地 | Berilgan joy', form.passport_place || ''],
              ['电话 | Telefon', form.telefon || ''],
            ].map(([l,v]) => (
              <View key={l} style={s.prow}>
                <Text style={s.plbl}>{l}:</Text>
                <Text style={s.pval}>{v}</Text>
              </View>
            ))}
            <View style={[s.prow, { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#e5e7eb' }]}>
              <Text style={s.plbl}>签名 | Imzo:</Text>
              <Text style={[s.pval, { borderBottomWidth: 0.5, borderBottomColor: '#374151' }]}> </Text>
            </View>
          </View>
        </View>

        {/* ── ANNEX 1 ── */}
        <View break>
          <Text style={[s.zh, { textAlign: 'center', fontWeight: 700, fontFamily: 'NotoSC', fontSize: 9 }]}>附件一：投资确认书</Text>
          <Text style={[s.uzB, { textAlign: 'center', fontSize: 9, marginBottom: 2 }]}>1-ILOVA: INVESTITSIYA TASDIQNOMASI</Text>
          <Text style={[s.zh, { textAlign: 'center', marginBottom: 8 }]}>合同号 {contractNum}  ·  {fmtD(cd)}</Text>

          <View style={s.block}>
            <Text style={s.zh}>
              本人 {investorName} 确认如下：{'\n'}
              依据{fmtD(cd)}第{contractNum}号《投资协议》，费尔干纳地区费尔干纳区 Cheksho'ra MFY 的 148号地块上建设的"亚欧国际商贸中心"项目中的{' '}
              {blockId}-区 {bolimNum}-栋 {floor}-层 {aptNum}-号商铺，面积 {apartment.size} 平方米，已由本人认购，本人将按协议约定支付全部投资款。
            </Text>
            <Text style={[s.uz, { marginTop: 2 }]}>
              Men, <U>{investorName}</U>, quyidagilarni tasdiqlayman:{'\n'}
              {cdStr}-{contractNum}-sonli "Investitsiya shartnomasi"ga asosan, Farg'ona viloyati, Farg'ona tumani, Cheksho'ra MFY, 148-uchastkada qurilayotgan «Yevro-Osiyo xalqaro savdo markazi» loyihasidagi{' '}
              <U>{blockId}-maydon</U>, <U>{bolimNum}-bino</U>, <U>{floor}-qavat</U>, <U>{aptNum}-do'kon</U>, maydoni <U>{apartment.size}</U> kv.m, men tomonimdan sotib olingan va men ushbu Shartnomaga muvofiq barcha investitsiya to'lovlarini to'liq to'lash majburiyatini o'z zimmasiga olaman.
            </Text>
          </View>

          <View style={s.block}>
            <Text style={s.zh}>
              本人已完全知悉并同意本合同全部条款，承诺严格按照附件二约定的付款计划，于每月按期足额付款，绝不违约。
            </Text>
            <Text style={[s.uz, { marginTop: 1 }]}>
              Men ushbu Shartnomaning barcha shartlarini to'liq bilaman va roziman. 2-ilovada belgilangan to'lov jadvaliga qat'iy rioya qilgan holda, har oyda o'z vaqtida va to'liq hajmda to'lovlarni amalga oshirishni, hech qachon shartnomani buzmaslikni va'da qilaman.
            </Text>
          </View>

          <View style={s.block}>
            <Text style={s.zh}>
              若本人逾期付款超过60个日历日，本人同意建设方按本合同第4.1条约定单方解除合同。合同解除后，建设方有权在重新就本合同项下商铺与新的投资方签订正式投资协议之日起180个银行工作日内，向本人退还已支付的全部款项，但建设方有权扣除以下费用：（1）合同解除前已发生的建设成本；（2）中介佣金，不超过合同总金额的5%；（3）银行手续费及其他有书面凭证的合理支出。上述各项扣除金额合计不超过本人已付总金额的10%。
            </Text>
            <Text style={[s.uz, { marginTop: 1 }]}>
              Agar to'lovim 60 kalendar kundan ortiq muddatga kechiktirilsa, Quruvchining ushbu Shartnomaning 4.1-bandiga muvofiq shartnomani bir tomonlama bekor qilishiga roziman. Shartnoma bekor qilingandan so'ng, Quruvchi yangi investor bilan rasmiy investitsiya shartnomasi tuzilgan kundan boshlab 180 bank ish kuni ichida menga to'lagan barcha mablag'larimni qaytaradi, biroq quyidagilarni ushlab qolish huquqiga ega: (1) qurilish xarajatlari; (2) vositachilik komissiyasi — umumiy summaning 5% dan oshmasligi; (3) bank xizmatlari xarajatlari. Ushlab qolingan xarajatlar yig'indisi men to'lagan umumiy summaning 10% dan oshmasligi kerak.
            </Text>
          </View>

          <View style={s.signRow}>
            <View style={s.signCol}>
              <Text style={[s.zh, { fontWeight: 700, fontFamily: 'NotoSC' }]}>姓名 | F.I.O.:</Text>
              <View style={s.signLn} /><Text style={s.signHt}>{investorName}</Text>
            </View>
            <View style={s.signCol}>
              <Text style={[s.zh, { fontWeight: 700, fontFamily: 'NotoSC' }]}>签名 | Imzo:</Text>
              <View style={s.signLn} /><Text style={s.signHt}> </Text>
            </View>
          </View>
        </View>

        {/* ── ANNEX 2 ── */}
        <View break>
          <Text style={[s.zh, { textAlign: 'center', fontWeight: 700, fontFamily: 'NotoSC', fontSize: 9 }]}>
            附件二：投资及建房付款计划表
          </Text>
          <Text style={[s.uzB, { textAlign: 'center', fontSize: 9, marginBottom: 2 }]}>
            2-ILOVA: INVESTITSIYA VA QURILISH TO'LOVLARI JADVALI
          </Text>
          <Text style={[s.zh, { textAlign: 'center', marginBottom: 6 }]}>合同号 {contractNum}  ·  {fmtD(cd)}</Text>

          <View style={s.sumRow}>
            {[
              ['合同总额\nShartnomaning jami summasi', `${usd(total)} USD`],
              ['单价\nBirlik narxi', narxM2 > 0 ? `${usd(narxM2)} USD/m²` : '—'],
              ['首期款\nBoshlangʻich toʻlov', `${usd(boshl)} USD`],
              ['分期金额\nBoʻlib toʻlash summasi', `${usd(qolgan)} USD`],
              ['分期期限\nBoʻlib toʻlash muddati', `${fmtD(cd)} — ${lastDate}`],
              ['共期 / Umumiy davr', `${oylar} ta`],
              ['每月付款\nOylik toʻlov', `${usd(molylik)} USD`],
            ].map(([l,v]) => (
              <View key={l} style={s.sumCell}>
                <Text style={s.sumLbl}>{l}</Text>
                <Text style={s.sumVal}>{v}</Text>
              </View>
            ))}
          </View>

          <View style={s.tbl}>
            <View style={s.thd}>
              <Text style={[s.th, { width: 22 }]}>№</Text>
              <Text style={[s.th, { width: 72 }]}>分期付款时间{'\n'}Toʻlov vaqti</Text>
              <Text style={[s.th, { flex: 1 }]}>分期金额{'\n'}Toʻlov summasi (USD)</Text>
              <Text style={[s.thL, { flex: 1 }]}>剩余款项{'\n'}Qolgan summa (USD)</Text>
            </View>
            {schedule.map((row, i) => (
              <View key={row.num} style={i % 2 === 0 ? s.trow : s.trowA}>
                <Text style={[s.td, { width: 22 }]}>{row.num}</Text>
                <Text style={[s.td, { width: 72 }]}>{row.date}</Text>
                <Text style={[s.td, { flex: 1 }]}>{usd(row.amount)}</Text>
                <Text style={[s.tdL, { flex: 1 }]}>{usd(row.remaining)}</Text>
              </View>
            ))}
          </View>

          <Text style={s.note}>若交款时，客户采用苏姆支付，按交款当天汇率折成苏姆后支付。</Text>
          <Text style={[s.note, { fontFamily: 'Roboto' }]}>Agar mijoz to'lovni so'mda amalga oshirsa, to'lov kuni amaldagi valyuta kursi bo'yicha so'mga aylantirilib to'lanadi.</Text>
          <Text style={s.note}>银行 Bank: TOSHKENT SH., "UZSANOATKURILISHBANKI" ATB BOS OFISI  ·  纳税人 STIR: 312256591  ·  MFO: 00440</Text>
          <Text style={s.note}>账号 H/r (USD): 20208840907268122001  ·  账号 H/r (so'm): 20208000807268122001</Text>
        </View>
      </Page>
    </Document>
  )
}
