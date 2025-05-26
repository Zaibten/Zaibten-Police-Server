// index.js
require('dotenv').config(); // Load .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Load environment variables
const PORT = process.env.PORT || 3000;
const MongoURL = process.env.MongoURL;

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(MongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Define PoliceStation schema
const policeStationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  incharge: { type: String, required: true },
  contact: { type: String, required: true },
  location: { type: String, required: true },
  jailCapacity: { type: Number },
  cctvCameras: { type: Number },
  firsRegistered: { type: Number },
  latitude: { type: String },
  longitude: { type: String },
  weapons: [String],
  vehicles: [String]
}, { timestamps: true });

const PoliceStation = mongoose.model('PoliceStation', policeStationSchema);

// Routes
app.get('/', (req, res) => {
  res.send('🚓 Police Station API is live!');
});

// POST: Add police station
app.post('/api/police-station', async (req, res) => {
  try {
    const station = new PoliceStation(req.body);
    const saved = await station.save();
    res.status(201).json({ success: true, message: "Station added successfully", data: saved });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "Failed to add station", error: err.message });
  }
});

// GET: Get all police stations
app.get('/api/getpolice-stations', async (req, res) => {
  try {
    const stations = await PoliceStation.find().sort({ createdAt: -1 }); // latest first
    res.json({ success: true, data: stations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to get stations", error: err.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
