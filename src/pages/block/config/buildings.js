export const BLOCK_VIEW_BOX = {
  A: '0 0 1539 672',
  B: '0 0 1480 704',
  C: '0 0 1472 720',
}

export const BLOCK_BUILDINGS = {
  A: [
    // top-left tall = 11
    { id: 'A', label: "11-bo'lim", delay: '0.0s', textX: 239, textY: 147, points: '238,64 318,67 321,93 247,231 159,229 154,198' },
    // top-middle = 10
    { id: 'B', label: "10-bo'lim", delay: '0.6s', textX: 596, textY: 110, points: '414,70 794,84 794,113 782,152 397,135 394,107' },
    // left L-shape = 3
    { id: 'C', label: "3-bo'lim",  delay: '1.2s', textX: 240, textY: 361, points: '125,248 213,251 216,285 176,350 196,370 488,384 493,424 471,469 142,452 60,387 60,356' },
    // middle-left upper row = 7
    { id: 'D', label: "7-bo'lim",  delay: '1.8s', textX: 559, textY: 205, points: '366,164 765,178 765,206 754,248 352,231 349,203' },
    // middle-left lower row = 5
    { id: 'E', label: "5-bo'lim",  delay: '2.4s', textX: 519, textY: 312, points: '321,263 737,280 726,328 723,359 304,339 301,305' },
    // top-right = 9
    { id: 'F', label: "9-bo'lim",  delay: '3.0s', textX: 1054, textY: 130, points: '864,90 1250,101 1250,141 1247,169 856,152 856,124' },
    // middle-right upper = 6
    { id: 'G', label: "6-bo'lim",  delay: '3.6s', textX: 1040, textY: 228, points: '842,183 1247,198 1247,240 1244,268 830,254 830,223' },
    // right tall = 8
    { id: 'H', label: "8-bo'lim",  delay: '4.2s', textX: 1404, textY: 194, points: '1354,107 1442,107 1453,248 1453,280 1360,277 1360,246' },
    // bottom-right L = 1
    { id: 'I', label: "1-bo'lim",  delay: '4.8s', textX: 1280, textY: 426, points: '1363,299 1468,302 1482,413 1476,486 1346,546 997,537 997,464 1003,404 1306,418 1366,390' },
    // middle-right lower row = 4
    { id: 'J', label: "4-bo'lim",  delay: '5.4s', textX: 1027, textY: 334, points: '819,285 1247,302 1244,348 1244,379 805,359 805,328' },
    // bottom-center = 2
    { id: 'K', label: "2-bo'lim",  delay: '6.0s', textX: 741, textY: 437, points: '550,387 947,404 947,438 938,486 533,469 530,438' },
  ],
  B: [
    // top-left narrow = 9
    { id: 'A', label: "9-bo'lim",  delay: '0.0s', textX: 317,  textY: 198, points: '325,134 393,132 398,162 314,265 240,262 232,232' },
    // left L-shape = 3
    { id: 'B', label: "3-bo'lim",  delay: '0.6s', textX: 294,  textY: 382, points: '188,268 287,268 289,301 246,355 270,371 464,374 464,407 450,442 439,505 205,502 123,437 101,355' },
    // middle-left top row = 13
    { id: 'C', label: "13-bo'lim", delay: '1.2s', textX: 598,  textY: 165, points: '455,137 758,140 755,173 744,192 439,186 434,162' },
    // middle-left row 2 = 11
    { id: 'D', label: "11-bo'lim", delay: '1.8s', textX: 577,  textY: 202, points: '409,208 423,189 741,194 736,216' },
    // middle-left row 3 = 8
    { id: 'E', label: "8-bo'lim",  delay: '2.4s', textX: 550,  textY: 255, points: '368,262 382,241 728,246 720,271' },
    // middle-left row 4 = 5
    { id: 'F', label: "5-bo'lim",  delay: '3.0s', textX: 514,  textY: 334, points: '338,298 706,303 703,336 703,371 319,363 316,330' },
    // top-right row = 12
    { id: 'G', label: "12-bo'lim", delay: '3.6s', textX: 1019, textY: 172, points: '818,192 815,167 820,140 1166,148 1174,175 1169,181 1169,200' },
    // middle-right row 2 = 10
    { id: 'H', label: "10-bo'lim", delay: '4.2s', textX: 1001, textY: 210, points: '818,216 818,197 1183,202 1185,224' },
    // right tall = 6
    { id: 'I', label: "6-bo'lim",  delay: '4.8s', textX: 1310, textY: 241, points: '1229,178 1232,151 1311,151 1379,287 1371,292 1368,311 1278,317' },
    // bottom-right L = 1
    { id: 'J', label: "1-bo'lim",  delay: '5.4s', textX: 1241, textY: 412, points: '1294,314 1400,314 1436,388 1422,469 1321,532 984,524 986,439 986,385 1264,390 1313,366' },
    // bottom-center = 2
    { id: 'K', label: "2-bo'lim",  delay: '6.0s', textX: 714,  textY: 443, points: '521,374 927,385 921,442 916,518 504,510 494,429' },
    // middle-right row 3 = 7
    { id: 'L', label: "7-bo'lim",  delay: '6.6s', textX: 1004, textY: 263, points: '804,271 807,246 1199,254 1204,279' },
    // middle-right row 4 = 4
    { id: 'M', label: "4-bo'lim",  delay: '7.2s', textX: 1008, textY: 344, points: '799,306 1218,314 1229,350 1221,382 793,371 790,339' },
  ],
  C: [
    // top-left tall narrow = 9
    { id: 'A', label: "9-bo'lim",  delay: '0.0s', textX: 162,  textY: 239, points: '144,87 231,87 196,268 196,279 190,279 193,303 106,303 103,279 98,268' },
    // left L-shape = 3
    { id: 'B', label: "3-bo'lim",  delay: '0.6s', textX: 258,  textY: 419, points: '82,306 193,303 182,368 236,404 529,404 526,463 523,536 185,539 68,471 60,393' },
    // middle-left top row = 13
    { id: 'C', label: "13-bo'lim", delay: '1.2s', textX: 526,  textY: 130, points: '299,92 699,92 699,130 697,141 697,165 296,160 293,130' },
    // middle-right top row = 12
    { id: 'D', label: "12-bo'lim", delay: '1.8s', textX: 1001, textY: 131, points: '1136,163 1138,141 1144,138 1144,130 1130,92 770,92 773,130 775,165' },
    // right tall narrow = 6
    { id: 'E', label: "6-bo'lim",  delay: '2.4s', textX: 1299, textY: 204, points: '1206,133 1209,100 1301,98 1360,241 1363,252 1352,252 1347,279 1257,279' },
    // middle-left row 2 = 11
    { id: 'F', label: "11-bo'lim", delay: '3.0s', textX: 496,  textY: 187, points: '290,200 296,171 697,173 702,203' },
    // middle-left row 3 = 8
    { id: 'G', label: "8-bo'lim",  delay: '3.6s', textX: 492,  textY: 255, points: '282,238 277,268 708,271 702,241' },
    // middle-right row 2 = 10
    { id: 'H', label: "10-bo'lim", delay: '4.2s', textX: 974,  textY: 188, points: '783,171 1157,173 1165,203 789,203' },
    // middle-right row 3 = 7
    { id: 'I', label: "7-bo'lim",  delay: '4.8s', textX: 989,  textY: 257, points: '794,241 800,271 1187,274 1176,241' },
    // right L-shape = 1
    { id: 'J', label: "1-bo'lim",  delay: '5.4s', textX: 1260, textY: 408, points: '1282,287 1390,287 1434,393 1423,471 1322,542 1065,542 1054,442 1057,406 1263,406 1295,382 1279,325' },
    // middle-left row 4 = 5
    { id: 'K', label: "5-bo'lim",  delay: '6.0s', textX: 490,  textY: 350, points: '708,312 271,309 266,349 269,385 710,390 713,355' },
    // bottom center = 2
    { id: 'L', label: "2-bo'lim",  delay: '6.6s', textX: 823,  textY: 471, points: '580,404 997,406 1008,466 1006,474 1000,542 586,539 583,463' },
    // middle-right row 4 = 4
    { id: 'M', label: "4-bo'lim",  delay: '7.2s', textX: 1004, textY: 354, points: '802,312 1195,312 1211,352 1209,363 1206,363 1203,390 805,387 802,352' },
  ],
}
