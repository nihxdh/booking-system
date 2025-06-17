const express = require('express');
const router = express.Router();
const Bus = require('../models/Bus');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Bus Registration (no auth required)
router.post('/register', async (req, res) => {
  try {
    const { 
      busName, 
      busNumber, 
      password,
      pickup,
      dropoff,
      totalSeats
    } = req.body;

    // Check if bus already exists
    const existingBus = await Bus.findOne({ busNumber });
    if (existingBus) {
      return res.status(400).json({ error: 'Bus number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new bus
    const bus = new Bus({
      busName,
      busNumber,
      password: hashedPassword,
      pickup,
      dropoff,
      totalSeats,
      availableSeats: totalSeats
    });

    await bus.save();

    // Generate token
    const token = jwt.sign(
      { busId: bus._id, busNumber: bus.busNumber },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Bus registered successfully',
      token,
      bus: {
        busName: bus.busName,
        busNumber: bus.busNumber,
        pickup: bus.pickup,
        dropoff: bus.dropoff,
        totalSeats: bus.totalSeats,
        availableSeats: bus.availableSeats
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bus Login (no auth required)
router.post('/login', async (req, res) => {
  try {
    const { busNumber, password } = req.body;

    // Check for missing fields
    if (!busNumber || !password) {
      return res.status(400).json({ error: 'Bus number and password are required.' });
    }

    // Find bus by bus number
    const bus = await Bus.findOne({ busNumber });
    if (!bus) {
      return res.status(401).json({ error: 'Invalid bus number or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, bus.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid bus number or password' });
    }

    // Generate token
    const token = jwt.sign(
      { busId: bus._id, busNumber: bus.busNumber },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      bus: {
        busName: bus.busName,
        busNumber: bus.busNumber,
        pickup: bus.pickup,
        dropoff: bus.dropoff,
        totalSeats: bus.totalSeats,
        availableSeats: bus.availableSeats
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all buses
router.get('/', async (req, res) => {
  try {
    const { pickup, dropoff } = req.query;
    let query = {};

    if (pickup) {
      query['pickup.location'] = new RegExp(pickup, 'i');
    }
    if (dropoff) {
      query['dropoff.location'] = new RegExp(dropoff, 'i');
    }

    const buses = await Bus.find(query)
      .select('-password')
      .sort({ 'pickup.time': 1 });

    if (buses.length === 0) {
      return res.json({
        message: 'No buses found matching the criteria',
        buses: []
      });
    }

    res.json(buses);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch buses',
      details: error.message 
    });
  }
});

// Book seats on a bus
router.post('/:id/book', async (req, res) => {
  try {
    const { seats } = req.body; // number of seats to book
    if (!seats || seats < 1) {
      return res.status(400).json({ error: 'Please specify a valid number of seats to book.' });
    }
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    if (bus.availableSeats < seats) {
      return res.status(400).json({ error: 'Not enough available seats.' });
    }
    bus.availableSeats -= seats;
    await bus.save();
    res.json({
      message: `Successfully booked ${seats} seat(s).`,
      availableSeats: bus.availableSeats
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get bus profile (authenticated bus only)
router.get('/profile', auth, async (req, res) => {
  try {
    // Check if the request is from a bus
    if (!req.bus) {
      return res.status(403).json({ error: 'Access denied. Bus authentication required.' });
    }

    const bus = await Bus.findById(req.bus.busId).select('-password');
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    res.json({
      _id: bus._id,
      busName: bus.busName,
      busNumber: bus.busNumber,
      pickup: bus.pickup,
      dropoff: bus.dropoff,
      totalSeats: bus.totalSeats,
      availableSeats: bus.availableSeats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bus by ID
router.get('/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id).select('-password');
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json(bus);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update bus (admin or bus owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }

    // Check if user is admin or bus owner
    if (!req.admin?.isAdmin && (!req.bus || req.bus.busId !== bus._id.toString())) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = req.body;
    const allowedUpdates = [
      'busName',
      'pickup',
      'dropoff',
      'totalSeats',
      'availableSeats'
    ];

    // Validate that all updates are allowed
    const isValidOperation = Object.keys(updates).every(update => 
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ 
        error: 'Invalid updates!',
        allowedUpdates: allowedUpdates
      });
    }

    // Validate required fields
    if (updates.busName && typeof updates.busName !== 'string') {
      return res.status(400).json({ error: 'Bus name must be a string' });
    }

    if (updates.pickup) {
      if (!updates.pickup.location || !updates.pickup.time) {
        return res.status(400).json({ error: 'Pickup location and time are required' });
      }
    }

    if (updates.dropoff) {
      if (!updates.dropoff.location || !updates.dropoff.time) {
        return res.status(400).json({ error: 'Dropoff location and time are required' });
      }
    }

    // Validate numeric fields
    if (updates.totalSeats !== undefined) {
      const totalSeats = parseInt(updates.totalSeats);
      if (isNaN(totalSeats) || totalSeats < 0) {
        return res.status(400).json({ error: 'Total seats must be a positive number' });
      }
      if (totalSeats < bus.availableSeats) {
        return res.status(400).json({ error: 'Cannot set total seats less than available seats' });
      }
    }

    if (updates.availableSeats !== undefined) {
      const availableSeats = parseInt(updates.availableSeats);
      if (isNaN(availableSeats) || availableSeats < 0) {
        return res.status(400).json({ error: 'Available seats must be a positive number' });
      }
      if (availableSeats > bus.totalSeats) {
        return res.status(400).json({ error: 'Available seats cannot exceed total seats' });
      }
    }

    // Update the bus
    Object.assign(bus, updates);
    // If totalSeats is updated and availableSeats is not provided, set availableSeats = totalSeats
    if (updates.totalSeats !== undefined && updates.availableSeats === undefined) {
      bus.availableSeats = updates.totalSeats;
    }
    await bus.save();

    res.json({
      message: 'Bus updated successfully',
      bus: {
        _id: bus._id,
        busName: bus.busName,
        busNumber: bus.busNumber,
        pickup: bus.pickup,
        dropoff: bus.dropoff,
        totalSeats: bus.totalSeats,
        availableSeats: bus.availableSeats
      }
    });
  } catch (error) {
    console.error('Error updating bus:', error);
    res.status(400).json({ 
      error: 'Failed to update bus',
      details: error.message 
    });
  }
});

// Delete bus (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!req.admin || !req.admin.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    res.json({ message: 'Bus deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get available seats for a bus
// router.get('/:id/seats', async (req, res) => {
//   try {
//     const bus = await Bus.findById(req.params.id)
//       .select('seats');
    
//     if (!bus) {
//       return res.status(404).json({ error: 'Bus not found' });
//     }

//     const availableSeats = bus.seats.bookedSeats.filter(seat => !seat.isBooked);
    
//     res.json({
//       totalSeats: bus.seats.total,
//       availableSeats: bus.seats.available,
//       seats: availableSeats
//     });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// Search buses by route
// router.get('/search/route', async (req, res) => {
//   try {
//     const { pickup, dropoff, date } = req.query;

//     if (!pickup || !dropoff) {
//       return res.status(400).json({ 
//         error: 'Pickup and dropoff locations are required' 
//       });
//     }

//     const buses = await Bus.find({
//       'route.pickup.location': new RegExp(pickup, 'i'),
//       'route.dropoff.location': new RegExp(dropoff, 'i'),
//       status: 'active'
//     }).select('-seats.bookedSeats.bookingId');

//     res.json(buses);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// Debug route: List all buses (for development only)
router.get('/debug/all', async (req, res) => {
  try {
    const buses = await Bus.find({});
    res.json(buses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 