const express = require('express');
const router = express.Router();
const Waitlist = require('../models/waitlist');

router.post('/join-waitlist', async (req, res) => {
  const { email, useCase, kitType } = req.body;

  if (!email || !useCase || !kitType) {
    return res.status(400).json({ message: 'Email, use case, and kit type are required' });
  }

  if (!['AI SDR', 'AI BDR', 'AI SEO', 'AI Coder'].includes(kitType)) {
    return res.status(400).json({ message: 'Invalid kit type' });
  }

  try {
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already on waitlist' });
    }

    const newEntry = new Waitlist({ email, useCase, kitType });
    await newEntry.save();

    res.status(200).json({ message: 'Successfully added to waitlist' });
  } catch (err) {
    console.error('Waitlist error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;