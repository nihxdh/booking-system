const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check credentials against environment variables
    if (username === process.env.ADMIN_USERNAME && 
        password === process.env.ADMIN_PASSWORD) {
        
        // Create JWT token
        const token = jwt.sign(
          { 
            username: username,
            isAdmin: true 
          },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          message: 'Login successful',
          token: token
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get admin profile
router.get('/profile', auth, (req, res) => {
  try {
    res.json({
      username: process.env.ADMIN_USERNAME,
      email: process.env.ADMIN_EMAIL
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 