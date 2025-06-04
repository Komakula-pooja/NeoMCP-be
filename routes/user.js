const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/user')
require('dotenv').config();
const router = express.Router();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) console.error('SMTP Error:', error);
  else console.log('SMTP Ready');
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new User({
        email,
        password: hashedPassword,
      });
      await user.save();
    } else {
      if (!user.password) {
        return res.status(401).json({ error: 'Account linked with Google. Use Google login.' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await transporter.sendMail({
      from: '"NeoMCP AI" <poojithakomakula21@gmail.com>',
      to: email,
      subject: 'Welcome to NeoMCP AI',
      html: `
        <h3>Hello ${user.name || 'User'},</h3>
        <p>You logged into NeoMCP AI.</p>
        <p>Thank you for using our platform!</p>
        <p>Looking forward to your journey and contact us for help.</p>
        <p>Regards,<br>NeoMCP AI Team</p>
      `,
    });

    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.post('/google-login', async (req, res) => {
  const { email, name, googleId } = req.body;
  try {
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = googleId;
        user.name = user.name || name;
        await user.save();
      } else {
        user = new User({ email, name, googleId });
        await user.save();
      }
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await transporter.sendMail({
      from: '"NeoMCP AI" <poojithakomakula21@gmail.com>',
      to: email,
      subject: 'Welcome to NeoMCP AI',
      html: `
        <h3>Hello ${name || 'User'},</h3>
        <p>You logged into NeoMCP AI.</p>
        <p>Thank you for using our platform!</p>
        <p>Looking forward to your journey and contact us for help.</p>
        <p>Regards,<br>NeoMCP AI Team</p>
      `,
    });

    res.json({ token });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;