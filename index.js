// index.js
require('dotenv').config(); // Load .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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

// --- Multer setup for image upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- MongoDB Schema with image field ---
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
  vehicles: [String],
  image: { type: String }, // base64 image
}, { timestamps: true });

const PoliceStation = mongoose.model('PoliceStation', policeStationSchema);

// --- POST endpoint with image upload ---
app.post('/api/police-station', upload.single('image'), async (req, res) => {
  try {
    const { name, contact, location, latitude, longitude } = req.body;

    const existingStation = await PoliceStation.findOne({
      $or: [
        { name: name.trim() },
        { contact: contact.trim() },
        { location: location.trim() },
        { latitude },
        { longitude }
      ]
    });

    if (existingStation) {
      return res.status(409).json({
        success: false,
        message: "Duplicate entry detected: A police station record with matching name, contact number, location, latitude, or longitude already exists in the system."
      });
    }

    let imageBase64 = null;
    if (req.file) {
      const imageBuffer = fs.readFileSync(req.file.path);
      imageBase64 = imageBuffer.toString('base64');
      fs.unlinkSync(req.file.path); // Clean up uploaded file
    }

    const station = new PoliceStation({
      ...req.body,
      weapons: JSON.parse(req.body.weapons || '[]'),
      vehicles: JSON.parse(req.body.vehicles || '[]'),
      image: imageBase64,
    });

    const saved = await station.save();
    res.status(201).json({ success: true, message: "Station added successfully", data: saved });

  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "Failed to add station", error: err.message });
  }
});



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

// Update station by ID
app.put('/api/stations/:id', async (req, res) => {
  try {
    const station = await PoliceStation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (err) {
    console.error('❌ Error updating station:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE: Delete police station by ID
app.delete('/api/stations/:id', async (req, res) => {
  try {
    const deletedStation = await PoliceStation.findByIdAndDelete(req.params.id);
    if (!deletedStation) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    res.json({ success: true, message: 'Station deleted successfully', data: deletedStation });
  } catch (err) {
    console.error('❌ Error deleting station:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});



// Define Constable schema
const constableSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  rank: { type: String, required: true },
  badgeNumber: { type: String, required: true },
  dob: { type: String, required: true },
  gender: { type: String, required: true },
  contactNumber: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  policeStation: { type: String, required: true },
  joiningDate: { type: String, required: true },
  status: { type: String, required: true },
  qualification: { type: String },
  weapons: [String],
  vehicles: [String],
  remarks: { type: String },
  image: { type: String }, // base64 string for the constable image
}, { timestamps: true });


const Constable = mongoose.model('Constable', constableSchema);

// POST: Add new constable
app.post('/api/constables', upload.single('image'), async (req, res) => {
  try {
    const {
      fullName, rank, badgeNumber, dob, gender,
      contactNumber, email, address, policeStation,
      joiningDate, status, qualification, weapons, vehicles, remarks
    } = req.body;

    // Duplicate checks
    const existing = await Constable.findOne({
      $or: [{ badgeNumber }, { contactNumber }, { email }]
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate Badge Number, Contact Number, or Email already exists'
      });
    }

    if (new Date(joiningDate) <= new Date(dob)) {
      return res.status(400).json({
        success: false,
        message: 'Joining Date must be after Date of Birth'
      });
    }

    let imageBase64 = null;
    if (req.file) {
      const imageBuffer = fs.readFileSync(req.file.path);
      imageBase64 = imageBuffer.toString('base64');
      fs.unlinkSync(req.file.path); // remove temp file
    }

    const constable = new Constable({
      fullName, rank, badgeNumber, dob, gender,
      contactNumber, email, address, policeStation,
      joiningDate, status, qualification,
      weapons: JSON.parse(weapons || '[]'),
      vehicles: JSON.parse(vehicles || '[]'),
      remarks,
      image: imageBase64
    });

    const saved = await constable.save();

    res.status(201).json({
      success: true,
      message: "Constable added successfully",
      data: saved
    });
  } catch (err) {
    console.error("❌ Error adding constable:", err);
    res.status(400).json({
      success: false,
      message: "Failed to add constable",
      error: err.message
    });
  }
});


// GET: Get all constables
app.get('/api/constables', async (req, res) => {
  try {
    const constables = await Constable.find().sort({ createdAt: -1 });
    res.json({ success: true, data: constables });
  } catch (err) {
    console.error("❌ Error getting constables:", err);
    res.status(500).json({ success: false, message: "Failed to get constables", error: err.message });
  }
});

// API to get police stations names in dropdown
app.get('/api/police-stationsfordropdown', async (req, res) => {
  try {
    const stations = await PoliceStation.find();
    res.json(stations);
  } catch (error) {
    console.error('Error fetching police stations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/constablesdata', async (req, res) => {
  try {
    const constables = await Constable.find();
    res.json(constables);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching constables');
  }
});

// PUT /api/constables/:id  -- Update constable by ID
app.put('/api/updateconstables/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const updatedConstable = await Constable.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updatedConstable) {
      return res.status(404).json({ message: 'Constable not found' });
    }
    res.json(updatedConstable);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// delete constable api
app.delete('/api/deleteconstables/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Constable.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Constable not found" });
    }
    res.json({ message: "Constable deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// fetch police man with batch number
app.get("/api/constable/:badgeNumber", async (req, res) => {
  try {
    const constable = await Constable.findOne({ badgeNumber: req.params.badgeNumber });
    if (!constable) return res.status(404).json({ error: "Not found" });
    res.json(constable);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// duty schema in mongo db
const dutySchema = new mongoose.Schema({
  badgeNumber: String,
  name: String,
  rank: String,
  status: String,
  contact: String,
  policeStation: String,
  location: String,
  xCoord: Number,
  yCoord: Number,
  shift: String,
  dutyType: { type: String, enum: ["single", "multiple"], default: "single" },
  dutyDate: Date,  // Used for both single and per-day record in multiple
  fromDate: Date,  // Optional
  toDate: Date,    // Optional
  batchNumber: String,
  remarks: String,
});


const Duty = mongoose.model("Duty", dutySchema);

// API to assign duty
app.post("/api/assign-duty", async (req, res) => {
  try {
    const {
      badgeNumber,
      name,
      rank,
      status,
      contact,
      policeStation,
      location,
      xCoord,
      yCoord,
      shift,
      dutyType,
      dutyDate,
      fromDate,
      toDate,
      batchNumber,
      remarks,
    } = req.body;

    if (status.toLowerCase() !== "active") {
      return res.status(400).json({ message: "Status is not active" });
    }

    if (dutyType === "multiple") {
      const start = new Date(fromDate);
      const end = new Date(toDate);

      const conflict = await Duty.findOne({
        badgeNumber,
        dutyDate: { $gte: start, $lte: end },
        batchNumber,
        shift,
      });

      if (conflict) {
        return res.status(400).json({
          message: `Conflict: policeman already assigned between ${fromDate} and ${toDate}`,
        });
      }

      // ✅ Insert only one record for the full range
      const duty = new Duty({
        badgeNumber,
        name,
        rank,
        status,
        contact,
        policeStation,
        location,
        xCoord,
        yCoord,
        shift,
        dutyType,
        dutyDate: fromDate, // optional or set to null
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        batchNumber,
        remarks,
      });

      await duty.save();
    } else {
      const date = new Date(dutyDate);

      const conflict = await Duty.findOne({
        badgeNumber,
        dutyDate: date,
        batchNumber,
        shift,
      });

      if (conflict) {
        return res.status(400).json({
          message: "Policeman already assigned to another location on this day and shift",
        });
      }

      const newDuty = new Duty({
        badgeNumber,
        name,
        rank,
        status,
        contact,
        policeStation,
        location,
        xCoord,
        yCoord,
        shift,
        dutyType,
        dutyDate: date,
        batchNumber,
        remarks,
      });

      await newDuty.save();
    }

    res.json({ message: "Duty assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// API to get all duties
app.get('/api/duties', async (req, res) => {
  try {
    const duties = await Duty.find();
    res.json(duties);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching duties', error });
  }
});

// 🔹 PUT update duty by ID
app.put('/api/duties/:id', async (req, res) => {
  const { id } = req.params
  try {
    const updatedDuty = await Duty.findByIdAndUpdate(id, req.body, { new: true })
    if (!updatedDuty) return res.status(404).json({ error: 'Duty not found' })
    res.json(updatedDuty)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update duty' })
  }
})

// API to delete a duty by id
app.delete("/api/duties/:id", async (req, res) => {
  try {
    const deletedDuty = await Duty.findByIdAndDelete(req.params.id);
    if (!deletedDuty) {
      return res.status(404).json({ message: "Duty not found" });
    }
    res.json({ message: "Duty deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
