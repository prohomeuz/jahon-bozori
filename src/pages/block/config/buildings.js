export const BLOCK_VIEW_BOX = {
  A: '0 0 1597 672',
  B: '0 0 1527 704',
  C: '0 0 1502 688',
}

export const BLOCK_BUILDINGS = {
  A: [
    // Rasm bo'yicha: top-left tall = 11
    { id: 'A', label: "11-bo'lim", delay: '0.0s', textX: 200, textY: 105, points: '223,20 310,29 217,191 128,178' },
    // top-middle = 10
    { id: 'B', label: "10-bo'lim", delay: '0.6s', textX: 620, textY: 92,  points: '423,42 399,87 818,142 838,95' },
    // left L-shape = 3
    { id: 'C', label: "3-bo'lim",  delay: '1.2s', textX: 210, textY: 360, points: '92,231 181,242 126,340 157,373 452,413 425,462 99,420 26,346' },
    // middle-left upper row = 4
    { id: 'D', label: "7-bo'lim",  delay: '1.8s', textX: 562, textY: 204, points: '359,155 787,207 765,253 337,200' },
    // middle-left lower row = 5
    { id: 'E', label: "5-bo'lim",  delay: '2.4s', textX: 503, textY: 316, points: '299,266 272,309 707,366 732,320' },
    // top-right = 9
    { id: 'F', label: "9-bo'lim",  delay: '3.0s', textX: 1131, textY: 154, points: '927,104 1356,155 1336,207 905,149' },
    // middle-right = 6
    { id: 'G', label: "6-bo'lim",  delay: '3.6s', textX: 1082, textY: 267, points: '874,215 852,262 1291,320 1311,271' },
    // right tall = 8
    { id: 'H', label: "8-bo'lim",  delay: '4.2s', textX: 1489, textY: 260, points: '1476,171 1562,180 1505,349 1411,338' },
    // bottom-right L = 1
    { id: 'I', label: "1-bo'lim",  delay: '4.8s', textX: 1240, textY: 500, points: '1387,395 1507,411 1458,535 1307,588 958,544 985,475 1287,515 1347,493' },
    // bottom-right row = 5
    { id: 'J', label: "4-bo'lim",  delay: '5.4s', textX: 1032, textY: 382, points: '823,331 796,377 1245,435 1265,386' },
    // bottom-center = 2
    { id: 'K', label: "2-bo'lim",  delay: '6.0s', textX: 705, textY: 469, points: '516,417 918,469 896,522 490,466' },
  ],
  B: [
    { id: 'A', label: "9-bo'lim",  delay: '0.0s', textX: 170,  textY: 116, points: '154,19 248,32 197,214 93,202' },
    { id: 'B', label: "3-bo'lim",  delay: '0.6s', textX: 210,  textY: 390, points: '61,255 180,272 154,374 203,416 409,444 390,512 133,471 18,384' },
    { id: 'C', label: "13-bo'lim", delay: '1.2s', textX: 530,  textY: 118, points: '339,45 753,91 740,149 322,96' },
    { id: 'D', label: "11-bo'lim", delay: '1.8s', textX: 514,  textY: 191, points: '309,147 727,195 719,234 299,185' },
    { id: 'E', label: "8-bo'lim",  delay: '2.4s', textX: 488,  textY: 276, points: '284,229 710,282 702,321 273,268' },
    { id: 'F', label: "5-bo'lim",  delay: '3.0s', textX: 468,  textY: 369, points: '258,318 245,367 683,423 691,372' },
    { id: 'G', label: "12-bo'lim", delay: '3.6s', textX: 1081, textY: 162, points: '844,106 1318,163 1311,217 831,157' },
    { id: 'H', label: "10-bo'lim", delay: '4.2s', textX: 1063, textY: 262, points: '1305,268 1301,308 821,246 831,206' },
    { id: 'I', label: "6-bo'lim",  delay: '4.8s', textX: 1444, textY: 300, points: '1405,172 1509,185 1492,427 1379,410' },
    { id: 'J', label: "1-bo'lim",  delay: '5.4s', textX: 1240, textY: 534, points: '1381,459 1500,469 1496,575 1347,628 978,584 989,518 1309,561 1369,531' },
    { id: 'K', label: "2-bo'lim",  delay: '6.0s', textX: 694,  textY: 515, points: '473,450 921,505 914,580 458,520' },
    { id: 'L', label: "7-bo'lim",  delay: '6.6s', textX: 1051, textY: 366, points: '812,293 1290,355 1290,397 802,333' },
    { id: 'M', label: "4-bo'lim",  delay: '7.2s', textX: 1035, textY: 407, points: '793,384 787,429 1277,493 1286,448' },
  ],
  C: [
    { id: 'A', label: "9-bo'lim",  delay: '0.0s', textX: 145,  textY: 240, points: '56,155 145,142 218,326 116,338' },
    { id: 'B', label: "3-bo'lim",  delay: '0.6s', textX: 350,  textY: 435, points: '127,372 227,363 252,418 317,436 594,409 615,464 287,499 145,455' },
    { id: 'C', label: "13-bo'lim", delay: '1.2s', textX: 438,  textY: 108, points: '225,138 628,90 651,127 241,178' },
    { id: 'D', label: "12-bo'lim", delay: '1.8s', points: '707,81 1068,40 1098,73 728,119',   textX: 902,  textY: 57 },
    { id: 'E', label: "6-bo'lim",  delay: '2.4s', points: '1150,31 1231,19 1342,155 1250,171', textX: 1243, textY: 95 },
    { id: 'F', label: "11-bo'lim", delay: '3.0s', points: '258,217 670,169 684,196 269,246',   textX: 470,  textY: 183 },
    { id: 'G', label: "8-bo'lim",  delay: '3.6s', points: '283,284 296,320 726,265 703,236',   textX: 505,  textY: 277 },
    { id: 'H', label: "7-bo'lim",  delay: '4.2s', points: '795,223 1171,178 1192,207 812,255', textX: 993,  textY: 216 },
    { id: 'I', label: "4-bo'lim",  delay: '4.8s', points: '835,290 851,326 1242,282 1219,246', textX: 1037, textY: 286 },
    { id: 'J', label: "1-bo'lim",  delay: '5.4s', points: '1281,211 1386,200 1467,299 1384,372 1144,401 1106,347 1292,324 1336,292', textX: 1315, textY: 300 },
    { id: 'K', label: "5-bo'lim",  delay: '6.0s', points: '315,351 325,393 764,338 745,303',   textX: 537,  textY: 347 },
    { id: 'L', label: "2-bo'lim",  delay: '6.6s', points: '653,399 678,451 1083,407 1052,351', textX: 866,  textY: 402 },
    { id: 'M', label: "10-bo'lim", delay: '7.2s', points: '757,157 772,186 1144,140 1127,115', textX: 950,  textY: 150 },
  ],
}
