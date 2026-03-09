const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Connection Error:", err));

const tripSchema = new mongoose.Schema({
  tripName: String,
  totalBudget: Number,
  remainingBudget: Number,
  startDate: String,
  endDate: String,
  numTravelers: { type: Number, default: 0 },
  travelers: { type: [String], default: [] },
  expenses: [{
    category: String,
    amount: Number,
    hotelName: String,
    menuItems: { type: [String], default: [] },
    tip: { type: Number, default: 0 },
    checkIn: String,
    checkOut: String,
    travelType: String,
    vehicleType: String,
    startPoint: String,
    endPoint: String,
    vehicleNumber: String,
    shopName: String,
    shopAddress: String,
    shoppingItems: { type: [String], default: [] },
    date: { type: Date, default: Date.now }
  }]
});

const Trip = mongoose.model('Trip', tripSchema);

app.get('/api/trips', async (req, res) => {
  const trips = await Trip.find().sort({ _id: -1 });
  res.json(trips);
});

app.post('/api/trips', async (req, res) => {
  const newTrip = new Trip({ ...req.body, remainingBudget: req.body.totalBudget });
  await newTrip.save();
  res.json(newTrip);
});

app.put('/api/trips/:id/expense', async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  const bill = Number(req.body.amount) || 0;
  const tip = Number(req.body.tip) || 0;
  trip.expenses.push(req.body);
  trip.remainingBudget -= (bill + tip);
  await trip.save();
  res.json(trip);
});

app.put('/api/trips/:tripId/update-expense/:expenseId', async (req, res) => {
  const { tripId, expenseId } = req.params;
  const trip = await Trip.findById(tripId);
  const oldEx = trip.expenses.id(expenseId);
  trip.remainingBudget += (Number(oldEx.amount) + (Number(oldEx.tip) || 0));
  Object.assign(oldEx, req.body);
  trip.remainingBudget -= (Number(req.body.amount) + (Number(req.body.tip) || 0));
  await trip.save();
  res.json(trip);
});

app.delete('/api/trips/:id', async (req, res) => {
  await Trip.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

app.delete('/api/trips/remove-expense/:tripId/:expenseId', async (req, res) => {
  const { tripId, expenseId } = req.params;
  const trip = await Trip.findById(tripId);
  const ex = trip.expenses.id(expenseId);
  if (ex) {
    trip.remainingBudget += (Number(ex.amount) + (Number(ex.tip) || 0));
    trip.expenses.pull(expenseId);
    await trip.save();
  }
  res.json(trip);
});

app.listen(PORT, () => console.log(`🚀 Server on Port ${PORT}`));