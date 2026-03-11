import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// --- NEW: Chart Imports ---
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const BASE_URL = "http://localhost:5000/api";

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('tripUser')) || null);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authData, setAuthData] = useState({ username: '', password: '' });
  
  const [trip, setTrip] = useState(null);
  const [showStats, setShowStats] = useState(false); // NEW: State for stats view
  const [history, setHistory] = useState([]);
  const [currentDay, setCurrentDay] = useState(1);
  const [totalDays, setTotalDays] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [formData, setFormData] = useState({ tripName: '', totalBudget: '', startDate: '', endDate: '', travelers: [] });
  const [expense, setExpense] = useState({ 
    category: '', customCategory: '', amount: '', fuelPrice: 0, paidBy: '', 
    hotelName: '', menuItems: [''], tip: 0, travelType: 'Rent', vehicleType: 'Car', 
    startPoint: '', endPoint: '', shopName: '', shopAddress: '', shoppingItems: [''], checkIn: '', checkOut: ''
  });

  // --- THEME LOGIC ---
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => { if (user) fetchHistory(); }, [user]);

  useEffect(() => {
    if (trip) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const diff = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1 || 1;
      setTotalDays(diff);
    }
  }, [trip]);

  // --- NEW: Chart Data Logic ---
  const getChartData = () => {
    if (!trip || !trip.expenses) return [];
    const categoryTotals = trip.expenses.reduce((acc, ex) => {
      const name = ex.category === 'Other' ? (ex.customCategory || 'Other') : ex.category;
      const value = Number(ex.amount) + (Number(ex.tip) || 0);
      acc[name] = (acc[name] || 0) + value;
      return acc;
    }, {});

    return Object.keys(categoryTotals).map(cat => ({
      name: cat,
      value: categoryTotals[cat]
    }));
  };

  const COLORS = ['#556b2f', '#8fbc8f', '#bc4749', '#4a4e69', '#f4a261', '#2a9d8f'];

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/trips/${user.userId}`);
      setHistory(res.data);
    } catch (err) { console.error("Fetch Error", err); }
  };

  const handleAuth = async () => {
    const path = isSignUp ? 'signup' : 'signin';
    try {
      const res = await axios.post(`${BASE_URL}/${path}`, authData);
      if (isSignUp) { alert("Success! Sign In."); setIsSignUp(false); }
      else { setUser(res.data); localStorage.setItem('tripUser', JSON.stringify(res.data)); }
    } catch (err) { alert("Auth Failed"); }
  };

  const handleListChange = (type, i, val) => {
    const newList = [...(expense[type] ?? [])];
    newList[i] = val;
    setExpense({ ...expense, [type]: newList });
  };

  const addExpense = async () => {
    if (!expense.category || !expense.paidBy) return alert("Select Category & Payer");
    let finalAmt = Number(expense.amount) || 0;
    
    if (expense.category === 'Travel' && ['Car', 'Bike'].includes(expense.vehicleType)) {
        finalAmt += Number(expense.fuelPrice) || 0;
    }

    const data = new FormData();
    data.append('data', JSON.stringify({ ...expense, amount: finalAmt, dayNumber: currentDay }));
    if (selectedFile) data.append('bill', selectedFile);

    const url = editingId ? `${BASE_URL}/trips/${trip._id}/update-expense/${editingId}` : `${BASE_URL}/trips/${trip._id}/expense`;
    
    try {
      const res = await axios.put(url, data);
      setTrip(res.data);
      setEditingId(null);
      resetExpenseForm();
      fetchHistory();
    } catch (err) { alert("Failed to save expense"); }
  };

  const resetExpenseForm = () => {
    setExpense({ 
      category: '', customCategory: '', amount: '', fuelPrice: 0, paidBy: '', 
      hotelName: '', menuItems: [''], tip: 0, travelType: 'Rent', vehicleType: 'Car', 
      startPoint: '', endPoint: '', shopName: '', shopAddress: '', shoppingItems: [''], checkIn: '', checkOut: ''
    });
    setSelectedFile(null);
  };

  const downloadPDF = (t) => {
    const doc = new jsPDF();
    const totalSpent = t.expenses.reduce((s, ex) => s + (Number(ex.amount) + (Number(ex.tip)||0)), 0);
    const share = totalSpent / (t.travelers.length || 1);

    doc.setFontSize(22); doc.setTextColor(85, 107, 47);
    doc.text(`TRIP REPORT: ${t.tripName.toUpperCase()}`, 14, 20);
    
    let y = 35;
    for (let i = 1; i <= totalDays; i++) {
      const dayEx = t.expenses.filter(ex => ex.dayNumber === i);
      if (dayEx.length > 0) {
        doc.setFontSize(14); doc.setTextColor(0); doc.text(`DAY ${i}`, 14, y);
        const rows = dayEx.map(ex => [ex.category, ex.paidBy, `RS ${ex.amount + (ex.tip||0)}`]);
        autoTable(doc, { head: [['Category', 'Payer', 'Total']], body: rows, startY: y + 2 });
        y = doc.lastAutoTable.finalY + 12;
      }
    }

    const finalY = y + 10;
    doc.setFontSize(14); doc.text("FINANCIAL SUMMARY", 14, finalY);
    doc.setFontSize(10);
    doc.text(`Initial Budget: RS ${t.totalBudget}`, 14, finalY + 8);
    doc.text(`Total Spent: RS ${totalSpent.toFixed(2)}`, 14, finalY + 14);
    doc.text(`Balance Remaining: RS ${t.remainingBudget.toFixed(2)}`, 14, finalY + 20);

    const settY = finalY + 30;
    doc.text("GROUP SETTLEMENT", 14, settY);
    const settlementRows = t.travelers.map(name => {
      const paid = t.expenses.filter(ex => ex.paidBy === name).reduce((s, ex) => s + (Number(ex.amount) + (Number(ex.tip)||0)), 0);
      const diff = paid - share;
      return [name, `RS ${paid.toFixed(2)}`, diff >= 0 ? `Gets back RS ${diff.toFixed(2)}` : `Owes RS ${Math.abs(diff).toFixed(2)}` ];
    });
    autoTable(doc, { head: [['Traveler', 'Paid', 'Status']], body: settlementRows, startY: settY + 5, headStyles: {fillColor:[85, 107, 47]} });

    doc.save(`${t.tripName}_Report.pdf`);
  };

  if (!user) {
    return (
      <div className="container auth-box">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h1>{isSignUp ? "Register" : "Sign In"}</h1>
            <button className="theme-btn" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
        </div>
        <input placeholder="Username" onChange={e => setAuthData({...authData, username: e.target.value})} />
        <input type="password" placeholder="Password" onChange={e => setAuthData({...authData, password: e.target.value})} />
        <button className="btn-primary" onClick={handleAuth}>{isSignUp ? "Sign Up" : "Sign In"}</button>
        <p onClick={() => setIsSignUp(!isSignUp)} style={{cursor:'pointer', color:'var(--primary-olive)', marginTop:'15px'}}>{isSignUp ? "Login here" : "Create Account"}</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1>Smart Trip Tracker</h1>
        <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
            <button className="theme-btn" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
            <button className="btn-logout" onClick={() => {setUser(null); localStorage.removeItem('tripUser');}}>Logout</button>
        </div>
      </div>

      {!trip ? (
        <div className="fade-in">
          <div className="input-group">
            <h3>Plan New Trip</h3>
            <input placeholder="Trip Name" onChange={e => setFormData({...formData, tripName: e.target.value})} />
            <input type="number" placeholder="Total Budget" onChange={e => setFormData({...formData, totalBudget: e.target.value})} />
            <div className="datetime-row"><label>Start:</label><input type="date" onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
            <div className="datetime-row"><label>End:</label><input type="date" onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
            <input type="number" placeholder="Number of Travelers" onChange={e => setFormData({...formData, travelers: Array(parseInt(e.target.value)||0).fill("")})} />
            {formData.travelers.map((_, i) => (
              <input key={i} placeholder={`Traveler ${i+1} Name`} onChange={e => {
                  const newT = [...formData.travelers]; newT[i] = e.target.value; setFormData({...formData, travelers: newT});
              }} />
            ))}
            <button className="btn-primary" onClick={() => axios.post(`${BASE_URL}/trips`, {...formData, userId: user.userId}).then(res => setTrip(res.data))}>Start Trip</button>
          </div>
          <div className="history-grid">
            {history.map(t => (
              <div key={t._id} className="history-card" onClick={() => {setTrip(t); setCurrentDay(1); setShowStats(false);}}>
                <b>{t.tripName}</b><br/>₹{t.remainingBudget} Bal
                <button className="delete-icon" onClick={(e) => { e.stopPropagation(); axios.delete(`${BASE_URL}/trips/${t._id}`).then(fetchHistory); }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fade-in">
          <div className="balance-card">
            <h2>{trip.tripName} - Day {currentDay} of {totalDays}</h2>
            <div className="balance-amount">₹{trip.remainingBudget} Left</div>
          </div>

          {!trip.isFinished ? (
            <div className="input-group">
                <h3>{editingId ? "📝 Edit Expense" : "➕ Add Expense"}</h3>
                <select value={expense.category} onChange={e => setExpense({...expense, category: e.target.value})}>
                    <option value="">Select Category</option>
                    <option value="Food">Food 🍔</option><option value="Stay">Stay 🏨</option><option value="Travel">Travel 🚗</option><option value="Shopping">Shopping 🛍️</option><option value="Other">Other ✨</option>
                </select>
                <select value={expense.paidBy} onChange={e => setExpense({...expense, paidBy: e.target.value})}>
                    <option value="">Who Paid?</option>
                    {trip.travelers.map((name, i) => <option key={i} value={name}>{name}</option>)}
                </select>

                {/* --- CATEGORY SPECIFIC FORMS --- */}
                {expense.category === 'Food' && (
                  <div className="sub-form">
                    <input placeholder="Hotel Name" value={expense.hotelName} onChange={e => setExpense({...expense, hotelName: e.target.value})} />
                    {expense.menuItems.map((it, i) => (
                      <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                        <input value={it} placeholder="Item" onChange={e => handleListChange('menuItems', i, e.target.value)} />
                        {i === expense.menuItems.length - 1 && <button onClick={() => setExpense({...expense, menuItems: [...expense.menuItems, '']})} className="plus-btn-small">+</button>}
                      </div>
                    ))}
                    <input type="number" placeholder="Tip (₹)" value={expense.tip} onChange={e => setExpense({...expense, tip: e.target.value})} />
                  </div>
                )}

                {expense.category === 'Stay' && (
                  <div className="sub-form">
                    <input placeholder="Hotel Name" value={expense.hotelName} onChange={e => setExpense({...expense, hotelName: e.target.value})} />
                    <div className="datetime-row"><label>Check-in:</label><input type="datetime-local" value={expense.checkIn} onChange={e => setExpense({...expense, checkIn: e.target.value})} /></div>
                    <div className="datetime-row"><label>Check-out:</label><input type="datetime-local" value={expense.checkOut} onChange={e => setExpense({...expense, checkOut: e.target.value})} /></div>
                  </div>
                )}

                {expense.category === 'Travel' && (
                  <div className="sub-form">
                    <select value={expense.vehicleType} onChange={e => setExpense({...expense, vehicleType: e.target.value})}>
                        <option value="Car">Car</option><option value="Bike">Bike</option><option value="Bus">Bus</option><option value="Auto">Auto</option><option value="Train">Train</option><option value="Lorry">Lorry</option>
                    </select>
                    <div className="radio-group">
                      <label><input type="radio" checked={expense.travelType === 'Rent'} onChange={() => setExpense({...expense, travelType: 'Rent'})} /> Rent</label>
                      <label><input type="radio" checked={expense.travelType === 'Own'} onChange={() => setExpense({...expense, travelType: 'Own', amount: 0})} /> Own</label>
                    </div>
                    {expense.travelType === 'Rent' && <input type="number" placeholder="Rent Cost" value={expense.amount} onChange={e => setExpense({...expense, amount: e.target.value})} />}
                    {['Car', 'Bike'].includes(expense.vehicleType) && <input type="number" placeholder="Fuel Cost" value={expense.fuelPrice} onChange={e => setExpense({...expense, fuelPrice: e.target.value})} />}
                    <input placeholder="From Location" value={expense.startPoint} onChange={e => setExpense({...expense, startPoint: e.target.value})} />
                    <input placeholder="To Location" value={expense.endPoint} onChange={e => setExpense({...expense, endPoint: e.target.value})} />
                  </div>
                )}

                {expense.category === 'Shopping' && (
                  <div className="sub-form">
                    <input placeholder="Store Name" value={expense.shopName} onChange={e => setExpense({...expense, shopName: e.target.value})} />
                    <input placeholder="Store Address" value={expense.shopAddress} onChange={e => setExpense({...expense, shopAddress: e.target.value})} />
                    {expense.shoppingItems.map((it, i) => (
                      <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                        <input value={it} placeholder="Item" onChange={e => handleListChange('shoppingItems', i, e.target.value)} />
                        {i === expense.shoppingItems.length - 1 && <button onClick={() => setExpense({...expense, shoppingItems: [...expense.shoppingItems, '']})} className="plus-btn-small">+</button>}
                      </div>
                    ))}
                  </div>
                )}

                {expense.category === 'Other' && <input placeholder="Category Name" value={expense.customCategory} onChange={e => setExpense({...expense, customCategory: e.target.value})} />}

                {expense.category !== 'Travel' && expense.category !== '' && <input type="number" placeholder="Amount (₹)" value={expense.amount} onChange={e => setExpense({...expense, amount: e.target.value})} />}

                <button className="btn-primary" onClick={addExpense}>{editingId ? "Update Entry" : `Save Day ${currentDay} Entry`}</button>

                <div className="live-list">
                    {trip.expenses.filter(ex => ex.dayNumber === currentDay).map(ex => (
                        <div key={ex._id} className="expense-item">
                            <div style={{flex:1}}>
                                <b>{ex.category === 'Other' ? ex.customCategory : ex.category}</b>
                                <div style={{fontSize:'12px', color:'var(--text-sub)'}}>By: {ex.paidBy}</div>
                            </div>
                            <div className="item-actions">
                                <span>₹{ex.amount + (ex.tip||0)}</span>
                                <button onClick={() => {setEditingId(ex._id); setExpense({...ex}); window.scrollTo(0,0);}} className="edit-btn">Edit</button>
                                <button onClick={() => axios.delete(`${BASE_URL}/trips/remove-expense/${trip._id}/${ex._id}`).then(res => setTrip(res.data))} className="delete-btn">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="day-nav">
                    {currentDay > 1 && <button className="btn-back" onClick={() => setCurrentDay(currentDay - 1)}>← Day {currentDay-1}</button>}
                    {currentDay < totalDays ? (
                        <button className="btn-primary" onClick={() => setCurrentDay(currentDay + 1)}>Go to Day {currentDay + 1} →</button>
                    ) : (
                        <button className="btn-primary" style={{background:'black'}} onClick={() => axios.patch(`${BASE_URL}/trips/${trip._id}/finish`).then(res => setTrip(res.data))}>Finish Trip ✅</button>
                    )}
                </div>
            </div>
          ) : (
            <div style={{textAlign:'center', marginTop:'50px'}}>
                <h1>🎉 Journey Complete!</h1>
                
                {/* --- NEW: Stats Section --- */}
                <div style={{display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap'}}>
                  <button className="btn-download-main" onClick={() => downloadPDF(trip)}>📥 Download Bill</button>
                  <button className="btn-primary" style={{width:'auto', padding:'10px 20px', backgroundColor:'#8fbc8f'}} onClick={() => setShowStats(!showStats)}>
                    {showStats ? "📊 Hide Stats" : "📊 View Stats"}
                  </button>
                </div>

                {showStats && (
                  <div className="history-card" style={{marginTop:'30px', padding:'20px', height:'400px'}}>
                    <h3>Spending Breakdown</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getChartData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {getChartData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{backgroundColor:'var(--card-bg)', border:'none', borderRadius:'10px'}} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                
                <br/><button className="btn-back" onClick={() => {setTrip(null); setCurrentDay(1); setShowStats(false);}}>Return to Dashboard</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;