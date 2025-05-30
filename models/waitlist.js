const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  useCase: {
    type: String,
    required: true,
  },
  kitType: {
    type: String,
    required: true,
    enum: ['AI SDR', 'AI BDR', 'AI SEO', 'AI Coder'],
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Waitlist', waitlistSchema);