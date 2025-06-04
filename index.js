// index.js
require("dotenv").config(); // Load .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const bcrypt = require("bcrypt");
const { type } = require("os");

// Load environment variables
const PORT = process.env.PORT || 443;
const MongoURL = process.env.MongoURL;

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(MongoURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Multer setup for image upload ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// --- MongoDB Schema with image field ---
const policeStationSchema = new mongoose.Schema(
  {
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
    district: { type: String, required: true },
  },
  { timestamps: true }
);

const PoliceStation = mongoose.model("PoliceStation", policeStationSchema);

// --- POST endpoint with image upload ---
app.post("/api/police-station", upload.single("image"), async (req, res) => {
  try {
    const { name, contact, location, latitude, longitude } = req.body;

    const existingStation = await PoliceStation.findOne({
      $or: [
        { name: name.trim() },
        { contact: contact.trim() },
        { location: location.trim() },
        { latitude },
        { longitude },
      ],
    });

    if (existingStation) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate entry detected: A police station record with matching name, contact number, location, latitude, or longitude already exists in the system.",
      });
    }

    let imageBase64 = null;
    if (req.file) {
      const imageBuffer = fs.readFileSync(req.file.path);
      imageBase64 = imageBuffer.toString("base64");
      fs.unlinkSync(req.file.path); // Clean up uploaded file
    }

    const station = new PoliceStation({
      ...req.body,
      weapons: JSON.parse(req.body.weapons || "[]"),
      vehicles: JSON.parse(req.body.vehicles || "[]"),
      image: imageBase64,
    });

    const saved = await station.save();
    res
      .status(201)
      .json({
        success: true,
        message: "Station added successfully",
        data: saved,
      });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({
        success: false,
        message: "Failed to add station",
        error: err.message,
      });
  }
});

// Routes
app.get("/", (req, res) => {
  res.send("🚓 Police Station API is live!");
});

// POST: Add police station
app.post("/api/police-station", async (req, res) => {
  try {
    const station = new PoliceStation(req.body);
    const saved = await station.save();
    res
      .status(201)
      .json({
        success: true,
        message: "Station added successfully",
        data: saved,
      });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({
        success: false,
        message: "Failed to add station",
        error: err.message,
      });
  }
});

// GET: Get all police stations
app.get("/api/getpolice-stations", async (req, res) => {
  try {
    const stations = await PoliceStation.find().sort({ createdAt: -1 }); // latest first
    res.json({ success: true, data: stations });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to get stations",
        error: err.message,
      });
  }
});

// Update station by ID
app.put("/api/stations/:id", async (req, res) => {
  try {
    const station = await PoliceStation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!station) return res.status(404).json({ error: "Station not found" });
    res.json(station);
  } catch (err) {
    console.error("❌ Error updating station:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE: Delete police station by ID
app.delete("/api/stations/:id", async (req, res) => {
  try {
    const deletedStation = await PoliceStation.findByIdAndDelete(req.params.id);
    if (!deletedStation) {
      return res
        .status(404)
        .json({ success: false, message: "Station not found" });
    }
    res.json({
      success: true,
      message: "Station deleted successfully",
      data: deletedStation,
    });
  } catch (err) {
    console.error("❌ Error deleting station:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Define Constable schema
const constableSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);

const Constable = mongoose.model("Constable", constableSchema);

// POST: Add new constable
app.post("/api/constables", upload.single("image"), async (req, res) => {
  try {
    const {
      fullName,
      rank,
      badgeNumber,
      dob,
      gender,
      contactNumber,
      email,
      address,
      policeStation,
      joiningDate,
      status,
      qualification,
      weapons,
      vehicles,
      remarks,
    } = req.body;

    // Duplicate checks
    const existing = await Constable.findOne({
      $or: [{ badgeNumber }, { contactNumber }, { email }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate Badge Number, Contact Number, or Email already exists",
      });
    }

    if (new Date(joiningDate) <= new Date(dob)) {
      return res.status(400).json({
        success: false,
        message: "Joining Date must be after Date of Birth",
      });
    }

    let imageBase64 = null;
    if (req.file) {
      const imageBuffer = fs.readFileSync(req.file.path);
      imageBase64 = imageBuffer.toString("base64");
      fs.unlinkSync(req.file.path); // remove temp file
    }

    const constable = new Constable({
      fullName,
      rank,
      badgeNumber,
      dob,
      gender,
      contactNumber,
      email,
      address,
      policeStation,
      joiningDate,
      status,
      qualification,
      weapons: JSON.parse(weapons || "[]"),
      vehicles: JSON.parse(vehicles || "[]"),
      remarks,
      image: imageBase64,
    });

    const saved = await constable.save();

    res.status(201).json({
      success: true,
      message: "Constable added successfully",
      data: saved,
    });
  } catch (err) {
    console.error("❌ Error adding constable:", err);
    res.status(400).json({
      success: false,
      message: "Failed to add constable",
      error: err.message,
    });
  }
});

// GET: Get all constables
app.get("/api/constables", async (req, res) => {
  try {
    const constables = await Constable.find().sort({ createdAt: -1 });
    res.json({ success: true, data: constables });
  } catch (err) {
    console.error("❌ Error getting constables:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to get constables",
        error: err.message,
      });
  }
});

// API to get police stations names in dropdown
app.get("/api/police-stationsfordropdown", async (req, res) => {
  try {
    const stations = await PoliceStation.find();
    res.json(stations);
  } catch (error) {
    console.error("Error fetching police stations:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/constablesdata", async (req, res) => {
  try {
    const constables = await Constable.find();
    res.json(constables);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching constables");
  }
});

// PUT /api/constables/:id  -- Update constable by ID
app.put("/api/updateconstables/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const updatedConstable = await Constable.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updatedConstable) {
      return res.status(404).json({ message: "Constable not found" });
    }
    res.json(updatedConstable);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// delete constable api
app.delete("/api/deleteconstables/:id", async (req, res) => {
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
    const constable = await Constable.findOne({
      badgeNumber: req.params.badgeNumber,
    });
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
  dutyDate: Date, // Used for both single and per-day record in multiple
  fromDate: Date, // Optional
  toDate: Date, // Optional
  batchNumber: String,
  remarks: String,
  dutyCategory: {
  type: String,
  enum: [
    "Patrol",
    "Security",
    "VIP Escort",
    "VIP Security",
    "Investigation",
    "Checkpoint",
    "Court Duty",
    "Traffic Control",
    "Other"
  ],
  default: "Other"
},

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
      dutyCategory,
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
        dutyCategory,
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
          message:
            "Policeman already assigned to another location on this day and shift",
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
        dutyCategory,
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
app.get("/api/duties", async (req, res) => {
  try {
    const duties = await Duty.find();
    res.json(duties);
  } catch (error) {
    res.status(500).json({ message: "Error fetching duties", error });
  }
});

// 🔹 PUT update duty by ID
app.put("/api/duties/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updatedDuty = await Duty.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedDuty) return res.status(404).json({ error: "Duty not found" });
    res.json(updatedDuty);
  } catch (error) {
    res.status(500).json({ error: "Failed to update duty" });
  }
});

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


// Mongoose schema & model
const policeUserSchema = new mongoose.Schema({
  batchNo: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed password
  status: { type: String, required: true, default: "active" } // default value set here
});

const PoliceUserLogin = mongoose.model("PoliceUserLogin", policeUserSchema);

// Routes

// Add new police user
app.post("/api/police-users", async (req, res) => {
  try {
    const { batchNo, password } = req.body;
    if (!batchNo || !password) {
      return res.status(400).json({ error: "BatchNo and password are required" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save to DB - status will default to 'active' automatically
    const newUser = new PoliceUserLogin({ batchNo, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Police user added successfully" });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate batchNo error
      return res.status(409).json({ error: "BatchNo already exists" });
    }
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all police users (including passwords)
app.get("/api/police-users", async (req, res) => {
  try {
    const users = await PoliceUserLogin.find({}); // include all fields, including password
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch('/api/police-users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['Active', 'Disabled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const user = await PoliceUserLogin.findByIdAndUpdate(id, { status }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete police user by ID
app.delete("/api/police-users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await PoliceUserLogin.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// API to get active police duties (customize filter if needed)
app.get('/api/duties', async (req, res) => {
  try {
    const duties = await Duty.find({
      status: { $in: ['On Patrol', 'Traffic Control', 'Responding to Incident'] }, // Example filter
      xCoord: { $ne: null },
      yCoord: { $ne: null }
    })

    const formatted = duties.map((duty) => ({
      lat: duty.xCoord,
      lng: duty.yCoord,
      name: duty.name,
      status: duty.status,
      lastUpdated: 'Just now' // You can add logic to make this dynamic
    }))

    res.json(formatted)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server Error' })
  }
})






// Utility: get month-year string from date
const getMonthYear = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

// =========== API endpoints ===========

// 1. Bar chart: PoliceStations per district
app.get('/charts/policeStationsPerDistrict', async (req, res) => {
  try {
    const agg = await PoliceStation.aggregate([
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const data = agg.map(d => ({ country: d._id, value: d.count }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Pie chart: Constables by gender
app.get('/charts/constablesByGender', async (req, res) => {
  try {
    const agg = await Constable.aggregate([
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]);
    const data = agg.map(d => ({ id: d._id, label: d._id, value: d.count }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Line chart: Duties count per month (by dutyDate)
app.get('/charts/dutiesCountPerMonth', async (req, res) => {
  try {
    const duties = await Duty.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$dutyDate" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    // Nivo line expects array of { id, data: [{ x, y }] }
    const data = [{
      id: 'Duties',
      data: duties.map(d => ({ x: d._id, y: d.count })),
    }];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Radar chart: Number of constables per rank and status (two series: status)
app.get('/charts/constablesByRankAndStatus', async (req, res) => {
  try {
    // Get distinct statuses and ranks
    const statuses = await Constable.distinct('status');
    const ranks = await Constable.distinct('rank');

    // Aggregate counts by rank and status
    const agg = await Constable.aggregate([
      { $group: { _id: { rank: '$rank', status: '$status' }, count: { $sum: 1 } } }
    ]);

    // Prepare data in format: [{ taste: rank, status1: val, status2: val, ...}]
    const data = ranks.map(rank => {
      let obj = { taste: rank };
      statuses.forEach(status => {
        const found = agg.find(a => a._id.rank === rank && a._id.status === status);
        obj[status] = found ? found.count : 0;
      });
      return obj;
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Heatmap: Duties count by dutyCategory per month
app.get('/charts/dutiesHeatmap', async (req, res) => {
  try {
    const categories = await Duty.distinct('dutyCategory');
    const months = await Duty.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$dutyDate" } },
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const monthLabels = months.map(m => m._id);

    // Get count for each category x month
    let heatmapData = [];
    for (const cat of categories) {
      let dataPerMonth = [];
      for (const month of monthLabels) {
        const count = await Duty.countDocuments({
          dutyCategory: cat,
          dutyDate: {
            $gte: new Date(month + '-01'),
            $lt: new Date((new Date(month + '-01').getMonth() + 1 === 12 ? (parseInt(month.slice(0,4))+1)+'-01-01' : month.slice(0,4) + '-' + (String(new Date(month + '-01').getMonth() + 2).padStart(2,'0')) + '-01'))
          }
        });
        dataPerMonth.push({ x: month, y: count });
      }
      heatmapData.push({ id: cat, data: dataPerMonth });
    }
    res.json(heatmapData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Calendar heatmap: Duties per day for last 30 days
app.get('/charts/dutiesCalendarHeatmap', async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);

    // Aggregate duties per day between startDate and endDate
    const duties = await Duty.aggregate([
      {
        $match: {
          dutyDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$dutyDate" } },
          count: { $sum: 1 }
        }
      }
    ]);

    // Fill missing days with 0 count
    let dateMap = {};
    duties.forEach(d => dateMap[d._id] = d.count);
    let results = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      results.push({ day: dayStr, value: dateMap[dayStr] || 0 });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Chord chart: Weapons usage count among constables
app.get('/charts/weaponsUsageChord', async (req, res) => {
  try {
    // Get all weapons arrays from constables
    const allConstables = await Constable.find({}, { weapons: 1, _id: 0 });
    let weaponsSet = new Set();
    let matrix = [];
    let weaponsList = [];

    // Flatten weapons arrays and count co-occurrences (simplified)
    allConstables.forEach(c => c.weapons.forEach(w => weaponsSet.add(w)));
    weaponsList = Array.from(weaponsSet);

    // Create co-occurrence matrix (simplified: diagonal = count of each weapon)
    let counts = {};
    weaponsList.forEach(w => counts[w] = 0);
    allConstables.forEach(c => {
      const uniqueWeapons = [...new Set(c.weapons)];
      uniqueWeapons.forEach(w => counts[w]++);
    });

    // Matrix with counts on diagonal, zeros elsewhere (you can improve)
    matrix = weaponsList.map(w => weaponsList.map(w2 => (w === w2 ? counts[w] : 0)));

    res.json({ keys: weaponsList, matrix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Funnel chart: Number of police stations by jailCapacity ranges
app.get('/charts/jailCapacityFunnel', async (req, res) => {
  try {
    const buckets = [
      { label: '0-10', min: 0, max: 10 },
      { label: '11-20', min: 11, max: 20 },
      { label: '21-50', min: 21, max: 50 },
      { label: '51-100', min: 51, max: 100 },
      { label: '100+', min: 101, max: Number.MAX_SAFE_INTEGER },
    ];
    let data = [];
    for (const bucket of buckets) {
      const count = await PoliceStation.countDocuments({
        jailCapacity: { $gte: bucket.min, $lte: bucket.max }
      });
      data.push({ id: bucket.label, value: count });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Stream chart: Number of constables joining per month by status (last 12 months)
app.get('/charts/constablesJoiningStream', async (req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0,7));
    }

    const statuses = await Constable.distinct('status');
    const agg = await Constable.aggregate([
      {
        $match: {
          joiningDate: { 
            $gte: new Date(months[0] + '-01'),
            $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0)
          }
        }
      },
      {
        $group: {
          _id: { month: { $dateToString: { format: "%Y-%m", date: { $toDate: "$joiningDate" } } }, status: "$status" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Structure data: [{ id: status, data: [{ x: month, y: count }] }]
    let result = statuses.map(status => {
      return {
        id: status,
        data: months.map(month => {
          const found = agg.find(a => a._id.month === month && a._id.status === status);
          return { x: month, y: found ? found.count : 0 };
        })
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Area bump: Duties count per dutyCategory over years
app.get('/charts/dutiesAreaBump', async (req, res) => {
  try {
    const years = await Duty.aggregate([
      {
        $group: {
          _id: { $year: "$dutyDate" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const yearLabels = years.map(y => y._id.toString());

    const categories = await Duty.distinct('dutyCategory');

    const agg = await Duty.aggregate([
      {
        $group: {
          _id: { year: { $year: "$dutyDate" }, dutyCategory: "$dutyCategory" },
          count: { $sum: 1 }
        }
      }
    ]);

    let data = categories.map(category => {
      return {
        id: category,
        data: yearLabels.map(year => {
          const found = agg.find(a => a._id.year.toString() === year && a._id.dutyCategory === category);
          return { x: year, y: found ? found.count : 0 };
        })
      };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Count constables per police station for circle packing
app.get('/charts/constablesCirclePacking', async (req, res) => {
  try {
    const groupedData = await Constable.aggregate([
      {
        $group: {
          _id: '$policeStation',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    const formatted = {
      name: 'root',
      children: groupedData.map(g => ({
        name: g._id,
        value: g.count
      }))
    }

    res.json(formatted)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Express Route
app.get('/charts/constablesFunnel', async (req, res) => {
  try {
    const totalConstables = await Constable.countDocuments();
    const activeConstables = await Constable.countDocuments({ status: 'Active' });

    const today = new Date();
    const lastMonth = new Date(today.setDate(today.getDate() - 30));
    const joinedRecently = await Constable.countDocuments({
      joiningDate: { $gte: lastMonth.toISOString().split('T')[0] }
    });

    res.json([
      { id: 'Total Constables', value: totalConstables },
      { id: 'Active Constables', value: activeConstables },
      { id: 'Joined Recently', value: joinedRecently }
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/charts/constableDutyFlow', async (req, res) => {
  try {
    const agg = await Duty.aggregate([
      {
        $group: {
          _id: { policeStation: "$policeStation", dutyCategory: "$dutyCategory" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get unique nodes
    const nodeSet = new Set();
    agg.forEach(item => {
      nodeSet.add(item._id.policeStation);
      nodeSet.add(item._id.dutyCategory);
    });

    const nodes = [...nodeSet].map(id => ({ id }));

    const links = agg.map(item => ({
      source: item._id.policeStation,
      target: item._id.dutyCategory,
      value: item.count
    }));

    res.json({ nodes, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/treemap-data', async (req, res) => {
  try {
    const data = await Constable.aggregate([
      {
        $group: {
          _id: "$rank",
          count: { $sum: 1 }
        }
      }
    ]);

    const treemapData = {
      name: 'root',
      children: data.map(rankGroup => ({
        name: rankGroup._id || 'Unknown',
        value: rankGroup.count
      }))
    };

    res.json(treemapData);
  } catch (err) {
    console.error("Error generating TreeMap data:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/waffle-data', async (req, res) => {
  try {
    const result = await Constable.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          id: '$_id',
          label: '$_id',
          value: '$count',
          _id: 0
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    console.error('Error fetching waffle data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// login api
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const admin = process.env.ADMIN;
  const adminPassword = process.env.PASSWORD;

  if (email === process.env.ADMIN && password === process.env.PASSWORD) {
    res.status(200).json({ message: 'Login successful', email });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
