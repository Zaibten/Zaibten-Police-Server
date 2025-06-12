// index.js
require("dotenv").config(); // Load .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { type } = require("os");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");
const moment = require('moment');
const nodemailer = require('nodemailer');

const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});



// Store cloudinary storage in 'const upload'
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "pms_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    public_id: (req, file) => Date.now() + "-" + file.originalname,
  },
});

const upload = multer({ storage }); // ✅ SAVED IN VARIABLE

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

    // Check for duplicates
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
          "Duplicate entry detected: A police station record with matching name, contact number, location, latitude, or longitude already exists.",
      });
    }

    // Debug: log req.file to check upload result
    console.log("Uploaded file info:", req.file);

    // Extract image URL from Cloudinary upload
    let imageUrl = null;
    if (req.file && req.file.path) {
      imageUrl = req.file.path; // This should be the URL
    } else {
      console.warn("No image file uploaded or missing path");
    }

    const station = new PoliceStation({
      ...req.body,
      weapons: JSON.parse(req.body.weapons || "[]"),
      vehicles: JSON.parse(req.body.vehicles || "[]"),
      image: imageUrl,
    });

    const saved = await station.save();

    res.status(201).json({
      success: true,
      message: "Station added successfully",
      data: saved,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
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
    res.status(201).json({
      success: true,
      message: "Station added successfully",
      data: saved,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
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
    res.status(500).json({
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

    // Duplicate check
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

    // The uploaded image URL from Cloudinary
    let imageUrl = null;
    if (req.file && req.file.path) {
      imageUrl = req.file.path; // Cloudinary URL of uploaded image
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
      image: imageUrl,
    });

    const saved = await constable.save();

    res.status(201).json({
      success: true,
      message: "Constable added successfully",
      data: saved,
    });
  } catch (err) {
    console.error("❌ Error adding constable:", err);
    res.status(500).json({
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
    res.status(500).json({
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
  livexCoord: Number,
  liveyCoord: Number,
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
      "Other",
    ],
    default: "Other",
  },
  
  totalpresent: String,
  totalabsent:String,
});

const Duty = mongoose.model("Duty", dutySchema);

// API to assign duty
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);



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
        dutyDate: fromDate,
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

    // ✅ Send SMS
const message = `Dear ${name}, your duty assignment at ${location} for the ${shift} shift has been confirmed. Kindly ensure timely reporting.`;

    vonage.sms.send(
      {
        to: `92${contact.slice(-10)}`, // assumes Pakistani number like 03363506933
        from: "PoliceDept",
        text: message,
      },
      (err, responseData) => {
        if (err) {
          console.error("SMS Error:", err);
        } else {
          console.log("SMS sent:", responseData);
        }
      }
    );

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
  status: { type: String, required: true, default: "active" }, // default value set here
});

const PoliceUserLogin = mongoose.model("PoliceUserLogin", policeUserSchema);

// Routes

// Add new police user
app.post("/api/police-users", async (req, res) => {
  try {
    const { batchNo, password } = req.body;
    if (!batchNo || !password) {
      return res
        .status(400)
        .json({ error: "BatchNo and password are required" });
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

app.patch("/api/police-users/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["Active", "Disabled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const user = await PoliceUserLogin.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
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
app.get("/api/duties", async (req, res) => {
  try {
    const duties = await Duty.find({
      status: {
        $in: ["On Patrol", "Traffic Control", "Responding to Incident"],
      }, // Example filter
      xCoord: { $ne: null },
      yCoord: { $ne: null },
    });

    const formatted = duties.map((duty) => ({
      lat: duty.xCoord,
      lng: duty.yCoord,
      name: duty.name,
      status: duty.status,
      lastUpdated: "Just now", // You can add logic to make this dynamic
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Utility: get month-year string from date
const getMonthYear = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
};

// =========== API endpoints ===========

// 1. Bar chart: PoliceStations per district
app.get("/charts/policeStationsPerDistrict", async (req, res) => {
  try {
    const agg = await PoliceStation.aggregate([
      { $group: { _id: "$district", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const data = agg.map((d) => ({ country: d._id, value: d.count }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Pie chart: Constables by gender
app.get("/charts/constablesByGender", async (req, res) => {
  try {
    const agg = await Constable.aggregate([
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]);
    const data = agg.map((d) => ({ id: d._id, label: d._id, value: d.count }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Line chart: Duties count per month (by dutyDate)
app.get("/charts/dutiesCountPerMonth", async (req, res) => {
  try {
    const duties = await Duty.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$dutyDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    // Nivo line expects array of { id, data: [{ x, y }] }
    const data = [
      {
        id: "Duties",
        data: duties.map((d) => ({ x: d._id, y: d.count })),
      },
    ];
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Radar chart: Number of constables per rank and status (two series: status)
app.get("/charts/constablesByRankAndStatus", async (req, res) => {
  try {
    // Get distinct statuses and ranks
    const statuses = await Constable.distinct("status");
    const ranks = await Constable.distinct("rank");

    // Aggregate counts by rank and status
    const agg = await Constable.aggregate([
      {
        $group: {
          _id: { rank: "$rank", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Prepare data in format: [{ taste: rank, status1: val, status2: val, ...}]
    const data = ranks.map((rank) => {
      let obj = { taste: rank };
      statuses.forEach((status) => {
        const found = agg.find(
          (a) => a._id.rank === rank && a._id.status === status
        );
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
app.get("/charts/dutiesHeatmap", async (req, res) => {
  try {
    const categories = await Duty.distinct("dutyCategory");
    const months = await Duty.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$dutyDate" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const monthLabels = months.map((m) => m._id);

    // Get count for each category x month
    let heatmapData = [];
    for (const cat of categories) {
      let dataPerMonth = [];
      for (const month of monthLabels) {
        const count = await Duty.countDocuments({
          dutyCategory: cat,
          dutyDate: {
            $gte: new Date(month + "-01"),
            $lt: new Date(
              new Date(month + "-01").getMonth() + 1 === 12
                ? parseInt(month.slice(0, 4)) + 1 + "-01-01"
                : month.slice(0, 4) +
                  "-" +
                  String(new Date(month + "-01").getMonth() + 2).padStart(
                    2,
                    "0"
                  ) +
                  "-01"
            ),
          },
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
app.get("/charts/dutiesCalendarHeatmap", async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);

    // Aggregate duties per day between startDate and endDate
    const duties = await Duty.aggregate([
      {
        $match: {
          dutyDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$dutyDate" } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Fill missing days with 0 count
    let dateMap = {};
    duties.forEach((d) => (dateMap[d._id] = d.count));
    let results = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dayStr = d.toISOString().split("T")[0];
      results.push({ day: dayStr, value: dateMap[dayStr] || 0 });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Chord chart: Weapons usage count among constables
app.get("/charts/weaponsUsageChord", async (req, res) => {
  try {
    // Get all weapons arrays from constables
    const allConstables = await Constable.find({}, { weapons: 1, _id: 0 });
    let weaponsSet = new Set();
    let matrix = [];
    let weaponsList = [];

    // Flatten weapons arrays and count co-occurrences (simplified)
    allConstables.forEach((c) => c.weapons.forEach((w) => weaponsSet.add(w)));
    weaponsList = Array.from(weaponsSet);

    // Create co-occurrence matrix (simplified: diagonal = count of each weapon)
    let counts = {};
    weaponsList.forEach((w) => (counts[w] = 0));
    allConstables.forEach((c) => {
      const uniqueWeapons = [...new Set(c.weapons)];
      uniqueWeapons.forEach((w) => counts[w]++);
    });

    // Matrix with counts on diagonal, zeros elsewhere (you can improve)
    matrix = weaponsList.map((w) =>
      weaponsList.map((w2) => (w === w2 ? counts[w] : 0))
    );

    res.json({ keys: weaponsList, matrix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Funnel chart: Number of police stations by jailCapacity ranges
app.get("/charts/jailCapacityFunnel", async (req, res) => {
  try {
    const buckets = [
      { label: "0-10", min: 0, max: 10 },
      { label: "11-20", min: 11, max: 20 },
      { label: "21-50", min: 21, max: 50 },
      { label: "51-100", min: 51, max: 100 },
      { label: "100+", min: 101, max: Number.MAX_SAFE_INTEGER },
    ];
    let data = [];
    for (const bucket of buckets) {
      const count = await PoliceStation.countDocuments({
        jailCapacity: { $gte: bucket.min, $lte: bucket.max },
      });
      data.push({ id: bucket.label, value: count });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Stream chart: Number of constables joining per month by status (last 12 months)
app.get("/charts/constablesJoiningStream", async (req, res) => {
  try {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }

    const statuses = await Constable.distinct("status");
    const agg = await Constable.aggregate([
      {
        $match: {
          joiningDate: {
            $gte: new Date(months[0] + "-01"),
            $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          },
        },
      },
      {
        $group: {
          _id: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: { $toDate: "$joiningDate" },
              },
            },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Structure data: [{ id: status, data: [{ x: month, y: count }] }]
    let result = statuses.map((status) => {
      return {
        id: status,
        data: months.map((month) => {
          const found = agg.find(
            (a) => a._id.month === month && a._id.status === status
          );
          return { x: month, y: found ? found.count : 0 };
        }),
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Area bump: Duties count per dutyCategory over years
app.get("/charts/dutiesAreaBump", async (req, res) => {
  try {
    const years = await Duty.aggregate([
      {
        $group: {
          _id: { $year: "$dutyDate" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const yearLabels = years.map((y) => y._id.toString());

    const categories = await Duty.distinct("dutyCategory");

    const agg = await Duty.aggregate([
      {
        $group: {
          _id: { year: { $year: "$dutyDate" }, dutyCategory: "$dutyCategory" },
          count: { $sum: 1 },
        },
      },
    ]);

    let data = categories.map((category) => {
      return {
        id: category,
        data: yearLabels.map((year) => {
          const found = agg.find(
            (a) =>
              a._id.year.toString() === year && a._id.dutyCategory === category
          );
          return { x: year, y: found ? found.count : 0 };
        }),
      };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Count constables per police station for circle packing
app.get("/charts/constablesCirclePacking", async (req, res) => {
  try {
    const groupedData = await Constable.aggregate([
      {
        $group: {
          _id: "$policeStation",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    const formatted = {
      name: "root",
      children: groupedData.map((g) => ({
        name: g._id,
        value: g.count,
      })),
    };

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Express Route
app.get("/charts/constablesFunnel", async (req, res) => {
  try {
    const totalConstables = await Constable.countDocuments();
    const activeConstables = await Constable.countDocuments({
      status: "Active",
    });

    const today = new Date();
    const lastMonth = new Date(today.setDate(today.getDate() - 30));
    const joinedRecently = await Constable.countDocuments({
      joiningDate: { $gte: lastMonth.toISOString().split("T")[0] },
    });

    res.json([
      { id: "Total Constables", value: totalConstables },
      { id: "Active Constables", value: activeConstables },
      { id: "Joined Recently", value: joinedRecently },
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/charts/constableDutyFlow", async (req, res) => {
  try {
    const agg = await Duty.aggregate([
      {
        $group: {
          _id: {
            policeStation: "$policeStation",
            dutyCategory: "$dutyCategory",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get unique nodes
    const nodeSet = new Set();
    agg.forEach((item) => {
      nodeSet.add(item._id.policeStation);
      nodeSet.add(item._id.dutyCategory);
    });

    const nodes = [...nodeSet].map((id) => ({ id }));

    const links = agg.map((item) => ({
      source: item._id.policeStation,
      target: item._id.dutyCategory,
      value: item.count,
    }));

    res.json({ nodes, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/treemap-data", async (req, res) => {
  try {
    const data = await Constable.aggregate([
      {
        $group: {
          _id: "$rank",
          count: { $sum: 1 },
        },
      },
    ]);

    const treemapData = {
      name: "root",
      children: data.map((rankGroup) => ({
        name: rankGroup._id || "Unknown",
        value: rankGroup.count,
      })),
    };

    res.json(treemapData);
  } catch (err) {
    console.error("Error generating TreeMap data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/waffle-data", async (req, res) => {
  try {
    const result = await Constable.aggregate([
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          id: "$_id",
          label: "$_id",
          value: "$count",
          _id: 0,
        },
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("Error fetching waffle data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// login api
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const admin = process.env.ADMIN;
  const adminPassword = process.env.PASSWORD;

  if (email === process.env.ADMIN && password === process.env.PASSWORD) {
    res.status(200).json({ message: "Login successful", email });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
});


// 🟦 Login API
app.post('/moblogin', async (req, res) => {
  const { batchNo, password } = req.body;

  try {
    const user = await PoliceUserLogin.findOne({ batchNo });

    if (!user) {
      return res.status(404).json({ message: "User not found", status: "notfound" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "User is not active", status: user.status });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password", status: "invalid" });
    }

    return res.status(200).json({ message: "Login successful", user, status: user.status });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", status: "error" });
  }
});

// API: Get Dashboard Data by Batch Number
app.get("/api/dashboard/:batchNo", async (req, res) => {
  try {
    const batchNo = req.params.batchNo;
    const today = new Date().toISOString().slice(0, 10); // "2025-06-06"

    const duties = await Duty.find({ badgeNumber: batchNo });
    const constable = await Constable.findOne({ badgeNumber: batchNo });

    const activeDuties = duties.filter(d => d.status === "Active").length;
    const hasCoordinates = duties.some(d => d.xCoord && d.yCoord);

    const latestDuty = duties.sort((a, b) => new Date(b.dutyDate) - new Date(a.dutyDate))[0];

    // Get today's duty based on shift time logic
const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);  // Midnight today

const currentHour = new Date().getHours();

let currentDuty = duties.find(d => {
  if (!d.shift || !d.dutyDate) return false;

  const dutyDate = new Date(d.dutyDate);
  dutyDate.setHours(0, 0, 0, 0);

  // Ignore duties before today
  if (dutyDate < todayDate) return false;

  // Normalize shift string and parse
  const shiftStr = d.shift.toLowerCase().replace(/\s+/g, '');
  const [startStr, endStr] = shiftStr.split("to");
  if (!startStr || !endStr) return false;

  const parseHour = s => {
    const match = s.match(/^(\d+)(am|pm)$/);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const meridian = match[2];
    if (meridian === 'pm' && hour !== 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    return hour;
  };

  const startHour = parseHour(startStr);
  const endHour = parseHour(endStr);
  if (startHour === null || endHour === null) return false;

  if (dutyDate.getTime() === todayDate.getTime()) {
    // For today, check if currentHour is before or inside the shift
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour <= endHour;
    } else {
      // Overnight shift (e.g., 9pm to 6am)
      return currentHour >= startHour || currentHour <= endHour;
    }
  } else {
    // Future duty date, consider it upcoming
    return true;
  }
});



    res.json({
      activeDuties,
      myCoordinates: hasCoordinates ? 1 : 0,
      totalPresent: latestDuty?.totalpresent || "0",
      totalAbsent: latestDuty?.totalabsent || "0",
      name: constable?.fullName || "-",
      batchNo,
      xCoord: currentDuty?.xCoord || null,
      yCoord: currentDuty?.yCoord || null,
      location: currentDuty?.location || "No Active Duty",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Helper function: parse shift string "9am to 11pm" => { start, end }
function parseShift(shiftStr) {
  if (!shiftStr) return null;
  const parts = shiftStr.toLowerCase().trim().split(' to ');
  if (parts.length !== 2) return null;

  const start = moment(parts[0].trim(), ['h:mm a', 'ha']);
  const end = moment(parts[1].trim(), ['h:mm a', 'ha']);

  if (!start.isValid() || !end.isValid()) return null;

  if (end.isBefore(start)) end.add(1, 'day');
  return { start, end };
}

// Haversine formula to calculate distance between two lat/lng points in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// Your POST /api/checkin handler (Express.js example)
app.post('/api/checkin', async (req, res) => {
  try {
    const { badgeNumber, currentX, currentY, currentTime } = req.body;

    const duty = await Duty.findOne({ badgeNumber });

    if (!duty) {
      return res.status(404).json({ message: "Duty record not found" });
    }

    const distance = getDistanceFromLatLonInMeters(
      duty.xCoord, duty.yCoord, currentX, currentY
    );

    if (distance > 500) {
      duty.remarks = "user is outside range";
      duty.status = "off duty";
    } else {
      duty.remarks = "";
      duty.status = "on duty";
    }

    duty.livexCoord = currentX;
    duty.liveyCoord = currentY;
    duty.dutyDate = new Date(currentTime);

    await duty.save();

    return res.json({
      success: distance <= 500,
      message: distance > 500 ? "User outside range" : "User on duty",
      distance,
      remarks: duty.remarks,
      status: duty.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});




app.post('/api/live-location', async (req, res) => {
  try {
    const { badgeNumber, livexCoord, liveyCoord } = req.body;

    if (!badgeNumber || livexCoord == null || liveyCoord == null) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    // Find the active duty for this badgeNumber (similar logic as before)
    const now = moment();
    const todayStart = now.clone().startOf('day').toDate();
    const todayEnd = now.clone().endOf('day').toDate();

    const duty = await Duty.findOne({
      badgeNumber,
      status: 'Active',
      $or: [
        {
          dutyType: 'single',
          dutyDate: { $gte: todayStart, $lte: todayEnd },
        },
        {
          dutyType: { $ne: 'single' },
          fromDate: { $lte: todayEnd },
          toDate: { $gte: todayStart },
        },
      ],
    });

    if (!duty) {
      return res.status(404).json({ message: 'Active duty not found' });
    }

    // Auto-stop logic: check if shift exists and if current time is within shift
    if (!duty.shift || duty.shift.trim() === '') {
      return res.status(400).json({ message: 'No shift assigned, location tracking stopped.' });
    }

    const shift = parseShift(duty.shift);
    if (!shift) {
      return res.status(400).json({ message: 'Invalid shift format, location tracking stopped.' });
    }

    const shiftStart = now.clone().hour(shift.start.hour()).minute(shift.start.minute()).second(0);
    const shiftEnd = now.clone().hour(shift.end.hour()).minute(shift.end.minute()).second(0);
    if (shiftEnd.isBefore(shiftStart)) shiftEnd.add(1, 'day');

    if (!now.isBetween(shiftStart, shiftEnd, null, '[]')) {
      // Outside shift time - stop updating location
      return res.status(400).json({ message: 'Shift is over or not started yet, location tracking stopped.' });
    }

    // Update live location fields only if inside shift time
    duty.livexCoord = livexCoord;
    duty.liveyCoord = liveyCoord;

    await duty.save();

    return res.json({ message: 'Live location updated' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});


// app.post('/api/live-location', async (req, res) => {
//   try {
//     const { badgeNumber, livexCoord, liveyCoord } = req.body;

//     if (!badgeNumber || livexCoord == null || liveyCoord == null) {
//       return res.status(400).json({ message: 'Missing parameters' });
//     }

//     // Find the active duty for this badgeNumber (similar logic as before)
//     const now = moment();
//     const todayStart = now.clone().startOf('day').toDate();
//     const todayEnd = now.clone().endOf('day').toDate();

//     const duty = await Duty.findOne({
//       badgeNumber,
//       status: 'Active',
//       $or: [
//         {
//           dutyType: 'single',
//           dutyDate: { $gte: todayStart, $lte: todayEnd },
//         },
//         {
//           dutyType: { $ne: 'single' },
//           fromDate: { $lte: todayEnd },
//           toDate: { $gte: todayStart },
//         },
//       ],
//     });

//     if (!duty) {
//       return res.status(404).json({ message: 'Active duty not found' });
//     }

//     // Update live location fields
//     duty.livexCoord = livexCoord;
//     duty.liveyCoord = liveyCoord;

//     await duty.save();

//     return res.json({ message: 'Live location updated' });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: 'Server error' });
//   }
// });

app.get('/api/myduties/:badgeNumber', async (req, res) => {
  try {
    const badgeNumber = req.params.badgeNumber;
    console.log('BadgeNumber from request:', badgeNumber);

    if (!badgeNumber) {
      return res.status(400).json({ message: 'Badge number is required' });
    }

    // Try exact match
    const duties = await Duty.find({ badgeNumber: badgeNumber.trim() });

    console.log('Duties found:', duties);

    if (!duties || duties.length === 0) {
      return res.status(404).json({ message: 'No duties found for this badge number' });
    }

    return res.json({ duties });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// API to get constables by batchNo
app.get('/api/constables/:batchNo', async (req, res) => {
  const 
badgeNumber = req.params.batchNo;

  try {
    const constables = await Constable.find({ 
badgeNumber });
    if (!constables || constables.length === 0) {
      return res.status(404).json({ message: 'No constables found for this batch' });
    }
    res.json(constables);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'policedutymanagementsystem@gmail.com',
    pass: 'pzbm emug lyka sxzo'  // Your app password here
  }
});

// Your existing routes here...

app.post('/send-simple-email', async (req, res) => {
  try {
    const { batchNo } = req.body;

    const emailHTML = `
      <div style="font-family: 'Segoe UI', sans-serif; background-color: #f0f4f8; padding: 40px 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <div style="text-align: center; background-color: #1a73e8; padding: 40px 20px;">
            <img 
              src="https://res.cloudinary.com/dvqxt7y7h/image/upload/v1749280294/xbbhof1qz92qj0qv97jz.png" 
              alt="PMS Logo"
              style="width: 90px; height: 90px; border-radius: 50%; background-color: #ffffff; padding: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
            />
            <h1 style="color: #ffffff; font-size: 24px; margin: 20px 0 5px;">PMS Management System</h1>
            <p style="color: #d0e3ff; font-size: 16px; margin: 0;">Password Forget Request</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 25px 40px;">
            <p style="font-size: 16px; color: #444444; margin-bottom: 20px;">
              A user has requested to reset their password using the following batch number:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; font-size: 20px; font-weight: 600; color: #1a73e8; background-color: #e8f0fe; padding: 14px 32px; border-radius: 40px; letter-spacing: 1px;">
                ${batchNo || 'Not Provided'}
              </span>
            </div>

            <p style="font-size: 14px; color: #666666;">
              Please review this request and proceed with the necessary verification and support. This message was generated automatically. If you believe this is a mistake, please disregard this email.
            </p>

            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;"/>

            <p style="font-size: 13px; color: #999999; text-align: center;">
              &copy; ${new Date().getFullYear()} PMS Management System. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: '"PMS Management System" <policedutymanagementsystem@gmail.com>',
      to: 'developer.sarmadali@gmail.com',
      subject: 'Password Forget Request',
      html: emailHTML,
    });

    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
