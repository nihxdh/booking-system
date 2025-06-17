const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  busName: {
    type: String,
    required: true,
    trim: true
  },
  busNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  pickup: {
    location: {
      type: String,
      required: true,
      trim: true
    },
    time: {
      type: String,
      required: true,
      trim: true
    }
  },
  dropoff: {
    location: {
      type: String,
      required: true,
      trim: true
    },
    time: {
      type: String,
      required: true,
      trim: true
    }
  },
  totalSeats: {
    type: Number,
    required: false,
    min: 1
  },
  availableSeats: {
    type: Number,
    required: false,
    min: 0
  }
}, {
  timestamps: true
});

const Bus = mongoose.model('Bus', busSchema);

module.exports = Bus; 