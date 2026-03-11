const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = 5000;

// Multer Storage for Bill Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Connection Error:", err));

// --- MODELS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tripName: String,
  totalBudget: Number,
  remainingBudget: Number,
  startDate: String,
  endDate: String,
  numTravelers: { type: Number, default: 0 },
  travelers: { type: [String], default: [] },
  isFinished: { type: Boolean, default: false },
  expenses: [{
    dayNumber: Number,
    category: String,
    customCategory: String,
    amount: Number,
    fuelPrice: { type: Number, default: 0 },
    paidBy: String,
    billImage: String,
    hotelName: String,
    menuItems: [String],
    tip: { type: Number, default: 0 },
    checkIn: String,
    checkOut: String,
    travelType: String,
    vehicleType: String,
    startPoint: String,
    endPoint: String,
    shopName: String,
    shopAddress: String,
    shoppingItems: [String],
    date: { type: Date, default: Date.now }
  }]
});
const Trip = mongoose.model('Trip', tripSchema);

// --- AUTH ROUTES ---
app.post('/api/signup', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.json({ message: "User Created", userId: newUser._id });
  } catch (err) { res.status(400).json({ error: "Username already exists" }); }
});

app.post('/api/signin', async (req, res) => {
  const user = await User.findOne({ username: req.body.username, password: req.body.password });
  if (user) res.json({ userId: user._id, username: user.username });
  else res.status(401).json({ error: "Invalid Credentials" });
});

// --- TRIP ROUTES ---
app.get('/api/trips/:userId', async (req, res) => {
  const trips = await Trip.find({ userId: req.params.userId }).sort({ _id: -1 });
  res.json(trips);
});

app.post('/api/trips', async (req, res) => {
  const newTrip = new Trip({ ...req.body, remainingBudget: req.body.totalBudget });
  await newTrip.save();
  res.json(newTrip);
});

app.patch('/api/trips/:id/finish', async (req, res) => {
  const trip = await Trip.findByIdAndUpdate(req.params.id, { isFinished: true }, { new: true });
  res.json(trip);
});

app.delete('/api/trips/:id', async (req, res) => {
  await Trip.findByIdAndDelete(req.params.id);
  res.json({ message: "Trip Deleted" });
});

// --- EXPENSE ROUTES ---

// 1. ADD NEW EXPENSE
app.put('/api/trips/:tripId/expense', upload.single('bill'), async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    const bodyData = JSON.parse(req.body.data);
    
    // Total cost = amount + tip (fuelPrice is already included in 'amount' from frontend logic)
    const totalCost = Number(bodyData.amount) + (Number(bodyData.tip) || 0);
    
    trip.expenses.push({ ...bodyData, billImage: req.file ? req.file.filename : null });
    trip.remainingBudget -= totalCost;
    
    await trip.save();
    res.json(trip);
  } catch (err) { res.status(500).json({ error: "Failed to add expense" }); }
});

// 2. UPDATE EXISTING EXPENSE (CRITICAL FOR EDIT FEATURE)
app.put('/api/trips/:tripId/update-expense/:expenseId', upload.single('bill'), async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    const trip = await Trip.findById(tripId);
    const bodyData = JSON.parse(req.body.data);
    
    const oldEx = trip.expenses.id(expenseId);
    if (!oldEx) return res.status(404).json({ error: "Expense not found" });

    // Step 1: Refund the old cost to budget
    const oldCost = Number(oldEx.amount) + (Number(oldEx.tip) || 0);
    trip.remainingBudget += oldCost;

    // Step 2: Update with new data
    Object.assign(oldEx, bodyData);
    if (req.file) oldEx.billImage = req.file.filename;

    // Step 3: Deduct the new cost
    const newCost = Number(bodyData.amount) + (Number(bodyData.tip) || 0);
    trip.remainingBudget -= newCost;

    await trip.save();
    res.json(trip);
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

// 3. REMOVE EXPENSE
app.delete('/api/trips/remove-expense/:tripId/:expenseId', async (req, res) => {
  try {
    const { tripId, expenseId } = req.params;
    const trip = await Trip.findById(tripId);
    const ex = trip.expenses.id(expenseId);
    
    if (ex) {
      const refundAmt = (Number(ex.amount) + (Number(ex.tip) || 0));
      trip.remainingBudget += refundAmt;
      trip.expenses.pull(expenseId);
      await trip.save();
    }
    res.json(trip);
  } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));