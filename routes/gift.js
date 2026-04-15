const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Songkran 2026 dates and matching env var keys
const DAYS = [
  { day: 1, date: '2026-04-15', envKey: 'CODE_DAY1' },
  { day: 2, date: '2026-04-16', envKey: 'CODE_DAY2' },
  { day: 3, date: '2026-04-17', envKey: 'CODE_DAY3' },
];

// Helper: get today's date string 'YYYY-MM-DD' in Bangkok timezone (UTC+7)
function getTodayBangkok() {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // returns YYYY-MM-DD
}

// GET /api/gift/today  (protected)
// Returns which code is active today (just the day number, not the actual code)
router.get('/today', authMiddleware, (req, res) => {
  const today = getTodayBangkok();

  const activeDay = DAYS.find((d) => d.date === today);

  if (!activeDay) {
    return res.json({ activeDay: null, message: 'No gift code available today' });
  }

  res.json({ activeDay: activeDay.day, date: activeDay.date });
});

// GET /api/gift/status  (protected)
// Returns unlock status of all 3 days for the current user
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const today = getTodayBangkok();
    const user = await User.findById(req.user.id);

    const status = DAYS.map((d) => ({
      day: d.day,
      date: d.date,
      isUnlocked: today >= d.date,
      isRedeemed: user.redeemedCodes.includes(process.env[d.envKey]),
    }));

    res.json({ status, allDone: user.redeemedCodes.length >= 3 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/gift/redeem  (protected)
// Body: { day: 1|2|3, code: 'SUBMITTED_CODE' }
router.post('/redeem', authMiddleware, async (req, res) => {
  const { day, code } = req.body;

  if (!day || !code) {
    return res.status(400).json({ message: 'day and code are required' });
  }

  const dayConfig = DAYS.find((d) => d.day === day);
  if (!dayConfig) {
    return res.status(400).json({ message: 'Invalid day' });
  }

  // 1. Date check — server-side lock
  const today = getTodayBangkok();
  if (today < dayConfig.date) {
    return res.status(403).json({
      message: `Day ${day} code is not available yet. Unlocks on ${dayConfig.date}.`,
    });
  }

  // 2. Code match
  const correctCode = process.env[dayConfig.envKey];
  if (!correctCode) {
    return res.status(500).json({ message: 'Gift code not configured on server' });
  }
  if (code.trim().toUpperCase() !== correctCode.toUpperCase()) {
    return res.status(400).json({ message: 'Incorrect code, try again!' });
  }

  try {
    const user = await User.findById(req.user.id);

    // 3. Duplicate check
    if (user.redeemedCodes.includes(correctCode)) {
      return res.status(409).json({ message: 'You have already redeemed this code' });
    }

    // All checks passed — save
    user.redeemedCodes.push(correctCode);
    await user.save();

    const allDone = user.redeemedCodes.length >= 3;

    res.json({
      message: `Day ${day} code redeemed!`,
      redeemedCodes: user.redeemedCodes,
      allDone, // frontend listens for this to show QR reveal
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
