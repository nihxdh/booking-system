const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Create user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber, dateOfBirth } = req.body;

    // Validate required fields
    if (!username || !email || !password || !phoneNumber || !dateOfBirth) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }, { phoneNumber }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username, email, or phone number already exists' 
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      phoneNumber,
      dateOfBirth
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        isAdmin: false
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get authenticated user's profile (no auth required)
router.get('/profile', async (req, res) => {
  try {
    // For demo: get userId from query param (insecure, but as requested)
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required.' });
    }
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if the authenticated user is an admin
    if (!req.admin || !req.admin.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const updates = req.body;
    const allowedUpdates = ['username', 'email', 'phoneNumber', 'password', 'dateOfBirth'];
    const isValidOperation = Object.keys(updates).every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates!' });
    }

    // Check for unique fields if they're being updated
    if (updates.username || updates.email || updates.phoneNumber) {
      const existingUser = await User.findOne({
        $or: [
          { username: updates.username },
          { email: updates.email },
          { phoneNumber: updates.phoneNumber }
        ],
        _id: { $ne: req.params.id }
      });

      if (existingUser) {
        return res.status(400).json({ 
          error: 'Username, email, or phone number already exists' 
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if the authenticated user is an admin
    if (!req.admin || !req.admin.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload or update profile photo
router.post('/profile-photo/:id', auth, upload.single('profilePhoto'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Only allow user to update their own photo or admin
    if (!req.admin?.isAdmin && req.user?.userId !== user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    user.profilePhoto = `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ message: 'Profile photo updated', profilePhoto: user.profilePhoto });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 