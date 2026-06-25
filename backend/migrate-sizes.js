import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, '../db.sqlite')

console.log('DB path:', dbPath)

const db = new DatabaseSync(dbPath)

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// PDF dan olingan B blok 2-qavat barcha dokonlar (469 ta)
const CORRECTIONS = [
  // B-1 bolim
  { id: 'B-1-201', size: 22.28 }, { id: 'B-1-202', size: 14.76 }, { id: 'B-1-203', size: 15.77 },
  { id: 'B-1-204', size: 23.83 }, { id: 'B-1-205', size: 13.8 },  { id: 'B-1-206', size: 14.06 },
  { id: 'B-1-207', size: 17.92 }, { id: 'B-1-208', size: 30.57 }, { id: 'B-1-209', size: 21.81 },
  { id: 'B-1-210', size: 14.52 }, { id: 'B-1-211', size: 14.81 }, { id: 'B-1-212', size: 14.82 },
  { id: 'B-1-213', size: 14.53 }, { id: 'B-1-214', size: 21.81 }, { id: 'B-1-215', size: 31.23 },
  { id: 'B-1-216', size: 13.87 }, { id: 'B-1-217', size: 14.72 }, { id: 'B-1-218', size: 14.81 },
  { id: 'B-1-219', size: 14.81 }, { id: 'B-1-220', size: 14.81 }, { id: 'B-1-221', size: 14.81 },
  { id: 'B-1-222', size: 14.81 }, { id: 'B-1-223', size: 14.81 }, { id: 'B-1-224', size: 14.81 },
  { id: 'B-1-225', size: 13.87 }, { id: 'B-1-226', size: 24.13 }, { id: 'B-1-227', size: 15.88 },
  { id: 'B-1-228', size: 14.88 }, { id: 'B-1-229', size: 22.39 }, { id: 'B-1-230', size: 15.4 },
  { id: 'B-1-231', size: 16.78 }, { id: 'B-1-232', size: 9.06 },  { id: 'B-1-233', size: 17.89 },
  { id: 'B-1-234', size: 25.68 }, { id: 'B-1-236', size: 15.95 }, { id: 'B-1-237', size: 15.41 },
  { id: 'B-1-238', size: 15.41 }, { id: 'B-1-239', size: 15.41 }, { id: 'B-1-240', size: 15.41 },
  { id: 'B-1-241', size: 15.41 }, { id: 'B-1-242', size: 15.41 }, { id: 'B-1-243', size: 16.07 },
  // B-2 bolim
  { id: 'B-2-201', size: 21.88 }, { id: 'B-2-202', size: 23.39 }, { id: 'B-2-203', size: 13.66 },
  { id: 'B-2-204', size: 14.81 }, { id: 'B-2-205', size: 14.81 }, { id: 'B-2-206', size: 14.81 },
  { id: 'B-2-207', size: 14.81 }, { id: 'B-2-208', size: 14.81 }, { id: 'B-2-209', size: 14.81 },
  { id: 'B-2-210', size: 14.81 }, { id: 'B-2-211', size: 14.81 }, { id: 'B-2-212', size: 14.81 },
  { id: 'B-2-213', size: 14.81 }, { id: 'B-2-214', size: 14.81 }, { id: 'B-2-215', size: 14.81 },
  { id: 'B-2-216', size: 13.66 }, { id: 'B-2-217', size: 23.18 }, { id: 'B-2-218', size: 18.92 },
  { id: 'B-2-219', size: 15.38 }, { id: 'B-2-220', size: 16.43 }, { id: 'B-2-221', size: 15.98 },
  { id: 'B-2-222', size: 15.41 }, { id: 'B-2-223', size: 15.41 }, { id: 'B-2-224', size: 15.41 },
  { id: 'B-2-225', size: 15.41 }, { id: 'B-2-226', size: 15.41 }, { id: 'B-2-227', size: 15.41 },
  { id: 'B-2-228', size: 15.41 }, { id: 'B-2-229', size: 15.41 }, { id: 'B-2-230', size: 15.41 },
  { id: 'B-2-231', size: 15.41 }, { id: 'B-2-232', size: 15.98 }, { id: 'B-2-233', size: 16.42 },
  { id: 'B-2-234', size: 15.36 },
  // B-3 bolim
  { id: 'B-3-201', size: 21.77 }, { id: 'B-3-202', size: 15.27 }, { id: 'B-3-203', size: 16.32 },
  { id: 'B-3-204', size: 23.28 }, { id: 'B-3-205', size: 13.71 }, { id: 'B-3-206', size: 14.81 },
  { id: 'B-3-207', size: 14.81 }, { id: 'B-3-208', size: 14.81 }, { id: 'B-3-209', size: 14.72 },
  { id: 'B-3-210', size: 13.83 }, { id: 'B-3-211', size: 31.01 }, { id: 'B-3-212', size: 21.81 },
  { id: 'B-3-213', size: 14.53 }, { id: 'B-3-214', size: 14.81 }, { id: 'B-3-215', size: 14.81 },
  { id: 'B-3-216', size: 14.52 }, { id: 'B-3-217', size: 21.82 }, { id: 'B-3-218', size: 33.08 },
  { id: 'B-3-219', size: 13.84 }, { id: 'B-3-220', size: 14.71 }, { id: 'B-3-221', size: 14.81 },
  { id: 'B-3-222', size: 14.81 }, { id: 'B-3-223', size: 14.81 }, { id: 'B-3-224', size: 13.66 },
  { id: 'B-3-225', size: 22.67 }, { id: 'B-3-226', size: 15.01 }, { id: 'B-3-227', size: 15.51 },
  { id: 'B-3-228', size: 23.44 }, { id: 'B-3-229', size: 15.98 }, { id: 'B-3-230', size: 15.41 },
  { id: 'B-3-231', size: 15.41 }, { id: 'B-3-232', size: 15.4 },  { id: 'B-3-233', size: 14.79 },
  { id: 'B-3-234', size: 25.18 }, { id: 'B-3-235', size: 19.88 }, { id: 'B-3-236', size: 9.41 },
  { id: 'B-3-238', size: 15.81 }, { id: 'B-3-239', size: 15.41 }, { id: 'B-3-240', size: 15.41 },
  { id: 'B-3-241', size: 15.98 },
  // B-4 bolim
  { id: 'B-4-201', size: 10.65 }, { id: 'B-4-202', size: 15.2 },  { id: 'B-4-203', size: 14.97 },
  { id: 'B-4-204', size: 14.97 }, { id: 'B-4-205', size: 14.97 }, { id: 'B-4-206', size: 14.97 },
  { id: 'B-4-207', size: 14.97 }, { id: 'B-4-208', size: 13.94 }, { id: 'B-4-209', size: 13.94 },
  { id: 'B-4-210', size: 14.77 }, { id: 'B-4-211', size: 14.8 },  { id: 'B-4-212', size: 14.97 },
  { id: 'B-4-213', size: 14.97 }, { id: 'B-4-214', size: 14.97 }, { id: 'B-4-215', size: 14.97 },
  { id: 'B-4-216', size: 14.97 }, { id: 'B-4-217', size: 14.97 }, { id: 'B-4-218', size: 14.95 },
  { id: 'B-4-219', size: 11.92 }, { id: 'B-4-220', size: 14.49 }, { id: 'B-4-221', size: 15.2 },
  { id: 'B-4-222', size: 14.97 }, { id: 'B-4-223', size: 14.97 }, { id: 'B-4-224', size: 14.97 },
  { id: 'B-4-225', size: 14.97 }, { id: 'B-4-226', size: 14.97 }, { id: 'B-4-227', size: 13.94 },
  { id: 'B-4-228', size: 13.94 }, { id: 'B-4-229', size: 14.97 }, { id: 'B-4-230', size: 13.59 },
  { id: 'B-4-231', size: 13.59 }, { id: 'B-4-232', size: 14.97 }, { id: 'B-4-233', size: 14.97 },
  { id: 'B-4-234', size: 14.97 }, { id: 'B-4-235', size: 14.97 }, { id: 'B-4-236', size: 14.97 },
  { id: 'B-4-237', size: 14.97 }, { id: 'B-4-238', size: 14.95 }, { id: 'B-4-239', size: 14.75 },
  // B-5 bolim
  { id: 'B-5-201', size: 11.92 }, { id: 'B-5-202', size: 14.95 }, { id: 'B-5-203', size: 14.97 },
  { id: 'B-5-204', size: 14.97 }, { id: 'B-5-205', size: 14.97 }, { id: 'B-5-206', size: 14.97 },
  { id: 'B-5-207', size: 14.97 }, { id: 'B-5-208', size: 14.97 }, { id: 'B-5-209', size: 14.8 },
  { id: 'B-5-210', size: 14.77 }, { id: 'B-5-211', size: 14.97 }, { id: 'B-5-212', size: 14.97 },
  { id: 'B-5-213', size: 14.97 }, { id: 'B-5-214', size: 14.97 }, { id: 'B-5-215', size: 14.97 },
  { id: 'B-5-216', size: 15.2 },  { id: 'B-5-217', size: 10.65 }, { id: 'B-5-218', size: 14.75 },
  { id: 'B-5-219', size: 14.95 }, { id: 'B-5-220', size: 14.97 }, { id: 'B-5-221', size: 14.97 },
  { id: 'B-5-222', size: 14.97 }, { id: 'B-5-223', size: 14.97 }, { id: 'B-5-224', size: 14.97 },
  { id: 'B-5-225', size: 14.97 }, { id: 'B-5-226', size: 13.59 }, { id: 'B-5-227', size: 13.59 },
  { id: 'B-5-228', size: 14.97 }, { id: 'B-5-229', size: 14.97 }, { id: 'B-5-230', size: 14.97 },
  { id: 'B-5-231', size: 14.97 }, { id: 'B-5-232', size: 14.97 }, { id: 'B-5-233', size: 14.97 },
  { id: 'B-5-234', size: 15.2 },  { id: 'B-5-235', size: 14.49 },
  // B-6 bolim
  { id: 'B-6-201', size: 16.63 }, { id: 'B-6-202', size: 16.86 }, { id: 'B-6-203', size: 15.26 },
  { id: 'B-6-204', size: 15.26 }, { id: 'B-6-205', size: 15.26 }, { id: 'B-6-206', size: 15.26 },
  { id: 'B-6-207', size: 15.26 }, { id: 'B-6-208', size: 15.26 }, { id: 'B-6-209', size: 15.26 },
  { id: 'B-6-210', size: 14.21 }, { id: 'B-6-211', size: 14.21 }, { id: 'B-6-212', size: 15.25 },
  { id: 'B-6-213', size: 14.28 }, { id: 'B-6-214', size: 14.09 }, { id: 'B-6-215', size: 14.02 },
  { id: 'B-6-216', size: 15.26 }, { id: 'B-6-217', size: 15.26 }, { id: 'B-6-218', size: 16.54 },
  { id: 'B-6-219', size: 13.95 }, { id: 'B-6-220', size: 16.86 }, { id: 'B-6-221', size: 15.26 },
  { id: 'B-6-222', size: 15.26 }, { id: 'B-6-223', size: 15.26 }, { id: 'B-6-224', size: 15.26 },
  { id: 'B-6-225', size: 15.26 }, { id: 'B-6-226', size: 15.26 }, { id: 'B-6-227', size: 15.26 },
  { id: 'B-6-228', size: 14.21 }, { id: 'B-6-229', size: 14.21 }, { id: 'B-6-230', size: 15.05 },
  { id: 'B-6-231', size: 14.91 }, { id: 'B-6-232', size: 15.26 }, { id: 'B-6-233', size: 15.26 },
  { id: 'B-6-234', size: 15.26 }, { id: 'B-6-235', size: 15.26 }, { id: 'B-6-236', size: 17.62 },
  // B-7 bolim
  { id: 'B-7-201', size: 14.49 }, { id: 'B-7-202', size: 15.2 },  { id: 'B-7-203', size: 14.97 },
  { id: 'B-7-204', size: 14.97 }, { id: 'B-7-205', size: 14.97 }, { id: 'B-7-206', size: 14.97 },
  { id: 'B-7-207', size: 14.97 }, { id: 'B-7-208', size: 13.94 }, { id: 'B-7-209', size: 13.94 },
  { id: 'B-7-210', size: 14.77 }, { id: 'B-7-211', size: 14.8 },  { id: 'B-7-212', size: 14.97 },
  { id: 'B-7-213', size: 14.97 }, { id: 'B-7-214', size: 14.97 }, { id: 'B-7-215', size: 14.97 },
  { id: 'B-7-216', size: 14.97 }, { id: 'B-7-217', size: 14.97 }, { id: 'B-7-218', size: 14.95 },
  { id: 'B-7-219', size: 11.92 }, { id: 'B-7-220', size: 14.49 }, { id: 'B-7-221', size: 15.2 },
  { id: 'B-7-222', size: 14.97 }, { id: 'B-7-223', size: 14.97 }, { id: 'B-7-224', size: 14.97 },
  { id: 'B-7-225', size: 14.97 }, { id: 'B-7-226', size: 14.97 }, { id: 'B-7-227', size: 13.94 },
  { id: 'B-7-228', size: 12.65 }, { id: 'B-7-229', size: 13.59 }, { id: 'B-7-230', size: 13.59 },
  { id: 'B-7-231', size: 14.97 }, { id: 'B-7-232', size: 14.97 }, { id: 'B-7-233', size: 14.97 },
  { id: 'B-7-234', size: 14.97 }, { id: 'B-7-235', size: 14.97 }, { id: 'B-7-236', size: 14.97 },
  { id: 'B-7-237', size: 14.95 }, { id: 'B-7-238', size: 14.75 },
  // B-8 bolim
  { id: 'B-8-201', size: 11.92 }, { id: 'B-8-202', size: 14.95 }, { id: 'B-8-203', size: 14.97 },
  { id: 'B-8-204', size: 14.97 }, { id: 'B-8-205', size: 14.97 }, { id: 'B-8-206', size: 14.97 },
  { id: 'B-8-207', size: 14.97 }, { id: 'B-8-208', size: 14.97 }, { id: 'B-8-209', size: 14.8 },
  { id: 'B-8-210', size: 14.77 }, { id: 'B-8-211', size: 14.97 }, { id: 'B-8-212', size: 14.97 },
  { id: 'B-8-213', size: 14.97 }, { id: 'B-8-214', size: 14.97 }, { id: 'B-8-215', size: 14.97 },
  { id: 'B-8-216', size: 15.2 },  { id: 'B-8-217', size: 14.49 }, { id: 'B-8-218', size: 14.75 },
  { id: 'B-8-219', size: 14.95 }, { id: 'B-8-220', size: 14.97 }, { id: 'B-8-221', size: 14.97 },
  { id: 'B-8-222', size: 14.97 }, { id: 'B-8-223', size: 14.97 }, { id: 'B-8-224', size: 14.97 },
  { id: 'B-8-225', size: 14.97 }, { id: 'B-8-226', size: 13.59 }, { id: 'B-8-227', size: 13.59 },
  { id: 'B-8-228', size: 14.97 }, { id: 'B-8-229', size: 14.97 }, { id: 'B-8-230', size: 14.97 },
  { id: 'B-8-231', size: 14.97 }, { id: 'B-8-232', size: 14.97 }, { id: 'B-8-233', size: 15.2 },
  { id: 'B-8-234', size: 14.49 },
  // B-9 bolim
  { id: 'B-9-201', size: 12.27 }, { id: 'B-9-202', size: 15.25 }, { id: 'B-9-203', size: 15.26 },
  { id: 'B-9-204', size: 15.26 }, { id: 'B-9-205', size: 15.26 }, { id: 'B-9-206', size: 15.26 },
  { id: 'B-9-207', size: 15.26 }, { id: 'B-9-208', size: 15.26 }, { id: 'B-9-209', size: 15.26 },
  { id: 'B-9-210', size: 15.26 }, { id: 'B-9-211', size: 14.28 }, { id: 'B-9-212', size: 14.28 },
  { id: 'B-9-213', size: 15.26 }, { id: 'B-9-214', size: 15.26 }, { id: 'B-9-215', size: 17.62 },
  { id: 'B-9-216', size: 15.03 }, { id: 'B-9-217', size: 15.25 }, { id: 'B-9-218', size: 15.26 },
  { id: 'B-9-219', size: 15.26 }, { id: 'B-9-220', size: 15.26 }, { id: 'B-9-221', size: 15.26 },
  { id: 'B-9-222', size: 15.26 }, { id: 'B-9-223', size: 15.26 }, { id: 'B-9-224', size: 15.26 },
  { id: 'B-9-225', size: 15.05 }, { id: 'B-9-226', size: 14.91 }, { id: 'B-9-227', size: 15.26 },
  { id: 'B-9-228', size: 15.26 }, { id: 'B-9-229', size: 16.54 },
  // B-10 bolim
  { id: 'B-10-201', size: 10.65 }, { id: 'B-10-202', size: 15.2 },  { id: 'B-10-203', size: 14.97 },
  { id: 'B-10-204', size: 14.97 }, { id: 'B-10-205', size: 14.97 }, { id: 'B-10-206', size: 14.97 },
  { id: 'B-10-207', size: 14.97 }, { id: 'B-10-208', size: 13.94 }, { id: 'B-10-209', size: 13.94 },
  { id: 'B-10-210', size: 14.77 }, { id: 'B-10-211', size: 13.59 }, { id: 'B-10-212', size: 13.59 },
  { id: 'B-10-213', size: 14.97 }, { id: 'B-10-214', size: 14.97 }, { id: 'B-10-215', size: 14.97 },
  { id: 'B-10-216', size: 14.97 }, { id: 'B-10-217', size: 14.97 }, { id: 'B-10-218', size: 14.97 },
  { id: 'B-10-219', size: 14.95 }, { id: 'B-10-220', size: 11.92 }, { id: 'B-10-221', size: 14.49 },
  { id: 'B-10-222', size: 15.2 },  { id: 'B-10-223', size: 14.97 }, { id: 'B-10-224', size: 14.97 },
  { id: 'B-10-225', size: 14.97 }, { id: 'B-10-226', size: 14.97 }, { id: 'B-10-227', size: 14.97 },
  { id: 'B-10-228', size: 13.94 }, { id: 'B-10-229', size: 13.94 }, { id: 'B-10-230', size: 14.97 },
  { id: 'B-10-231', size: 14.8 },  { id: 'B-10-232', size: 14.97 }, { id: 'B-10-233', size: 14.97 },
  { id: 'B-10-234', size: 14.97 }, { id: 'B-10-235', size: 14.97 }, { id: 'B-10-236', size: 14.97 },
  { id: 'B-10-237', size: 14.97 }, { id: 'B-10-238', size: 14.95 }, { id: 'B-10-239', size: 14.75 },
  // B-11 bolim
  { id: 'B-11-201', size: 11.92 }, { id: 'B-11-202', size: 14.95 }, { id: 'B-11-203', size: 14.97 },
  { id: 'B-11-204', size: 14.97 }, { id: 'B-11-205', size: 14.97 }, { id: 'B-11-206', size: 14.97 },
  { id: 'B-11-207', size: 14.97 }, { id: 'B-11-208', size: 14.97 }, { id: 'B-11-209', size: 13.59 },
  { id: 'B-11-210', size: 13.59 }, { id: 'B-11-211', size: 14.77 }, { id: 'B-11-212', size: 14.97 },
  { id: 'B-11-213', size: 14.97 }, { id: 'B-11-214', size: 14.97 }, { id: 'B-11-215', size: 14.97 },
  { id: 'B-11-216', size: 14.97 }, { id: 'B-11-217', size: 15.2 },  { id: 'B-11-218', size: 10.65 },
  { id: 'B-11-219', size: 14.75 }, { id: 'B-11-220', size: 14.95 }, { id: 'B-11-221', size: 14.97 },
  { id: 'B-11-222', size: 14.97 }, { id: 'B-11-223', size: 14.97 }, { id: 'B-11-224', size: 14.97 },
  { id: 'B-11-225', size: 14.97 }, { id: 'B-11-226', size: 14.97 }, { id: 'B-11-227', size: 14.8 },
  { id: 'B-11-228', size: 14.97 }, { id: 'B-11-229', size: 14.97 }, { id: 'B-11-230', size: 14.97 },
  { id: 'B-11-231', size: 14.97 }, { id: 'B-11-232', size: 14.97 }, { id: 'B-11-233', size: 14.97 },
  { id: 'B-11-234', size: 15.2 },  { id: 'B-11-235', size: 14.49 },
  // B-12 bolim
  { id: 'B-12-201', size: 15.03 }, { id: 'B-12-202', size: 15.24 }, { id: 'B-12-203', size: 15.26 },
  { id: 'B-12-204', size: 15.26 }, { id: 'B-12-205', size: 15.26 }, { id: 'B-12-206', size: 15.26 },
  { id: 'B-12-207', size: 15.26 }, { id: 'B-12-208', size: 14.21 }, { id: 'B-12-209', size: 13.91 },
  { id: 'B-12-210', size: 15.35 }, { id: 'B-12-211', size: 15.55 }, { id: 'B-12-212', size: 15.15 },
  { id: 'B-12-213', size: 15.15 }, { id: 'B-12-214', size: 15.26 }, { id: 'B-12-215', size: 15.26 },
  { id: 'B-12-216', size: 15.26 }, { id: 'B-12-217', size: 15.26 }, { id: 'B-12-218', size: 15.24 },
  { id: 'B-12-219', size: 12.2 },  { id: 'B-12-220', size: 15.03 }, { id: 'B-12-221', size: 15.24 },
  { id: 'B-12-222', size: 15.26 }, { id: 'B-12-223', size: 15.26 }, { id: 'B-12-224', size: 15.26 },
  { id: 'B-12-225', size: 15.26 }, { id: 'B-12-226', size: 15.26 }, { id: 'B-12-227', size: 14.21 },
  { id: 'B-12-228', size: 12.95 }, { id: 'B-12-229', size: 14.4 },  { id: 'B-12-230', size: 13.92 },
  { id: 'B-12-231', size: 15.26 }, { id: 'B-12-232', size: 15.26 }, { id: 'B-12-233', size: 15.26 },
  { id: 'B-12-234', size: 15.26 }, { id: 'B-12-235', size: 15.24 }, { id: 'B-12-236', size: 15.03 },
  // B-13 bolim
  { id: 'B-13-201', size: 12.2 },  { id: 'B-13-202', size: 15.24 }, { id: 'B-13-203', size: 15.26 },
  { id: 'B-13-204', size: 15.26 }, { id: 'B-13-205', size: 15.26 }, { id: 'B-13-206', size: 15.26 },
  { id: 'B-13-207', size: 15.26 }, { id: 'B-13-208', size: 15.26 }, { id: 'B-13-209', size: 15.55 },
  { id: 'B-13-210', size: 15.35 }, { id: 'B-13-211', size: 15.05 }, { id: 'B-13-212', size: 15.26 },
  { id: 'B-13-213', size: 15.26 }, { id: 'B-13-214', size: 15.26 }, { id: 'B-13-215', size: 15.26 },
  { id: 'B-13-216', size: 15.35 }, { id: 'B-13-217', size: 15.15 }, { id: 'B-13-218', size: 15.03 },
  { id: 'B-13-219', size: 15.24 }, { id: 'B-13-220', size: 15.26 }, { id: 'B-13-221', size: 15.26 },
  { id: 'B-13-222', size: 15.26 }, { id: 'B-13-223', size: 15.26 }, { id: 'B-13-224', size: 14.02 },
  { id: 'B-13-225', size: 14.4 },  { id: 'B-13-226', size: 13.88 }, { id: 'B-13-227', size: 15.26 },
  { id: 'B-13-228', size: 15.26 }, { id: 'B-13-229', size: 15.26 }, { id: 'B-13-230', size: 15.26 },
  { id: 'B-13-231', size: 15.35 }, { id: 'B-13-232', size: 15.15 },
]

const update = db.prepare('UPDATE apartments SET size = ? WHERE id = ?')

let updated = 0
let notFound = 0

db.exec('BEGIN')
try {
  for (const { id, size } of CORRECTIONS) {
    const result = update.run(size, id)
    if (result.changes > 0) {
      updated++
    } else {
      console.log(`--- ${id}: topilmadi`)
      notFound++
    }
  }
  db.exec('COMMIT')
  console.log(`\nNatija: ${updated} ta yangilandi, ${notFound} ta topilmadi.`)
  console.log('B blok 2-qavat barcha dokonlar PDF qiymatlari bilan yangilandi.')
} catch (e) {
  db.exec('ROLLBACK')
  console.error('Xato:', e.message)
  process.exit(1)
}
