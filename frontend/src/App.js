import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './App.css';

const BASE_URL = "http://localhost:5000/api/trips";

function App() {
  const [trip, setTrip] = useState(null);
  const [history, setHistory] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({ 
    tripName: '', totalBudget: '', startDate: '', endDate: '', numTravelers: 0, travelers: [] 
  });
  
  const [expense, setExpense] = useState({ 
    category: '', amount: '', hotelName: '', menuItems: [''], tip: '',
    travelType: '', vehicleType: '', startPoint: '', endPoint: '', vehicleNumber: '',
    checkIn: '', checkOut: '', shopName: '', shopAddress: '', shoppingItems: ['']
  });

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(BASE_URL);
      setHistory(res.data);
    } catch (err) { console.error(err); }
  };

  const handleNumTravelersChange = (num) => {
    const count = parseInt(num) || 0;
    setFormData({ ...formData, numTravelers: count, travelers: Array(count).fill("") });
  };

  const handleListChange = (type, i, val) => {
    const newList = [...(expense[type] ?? [])];
    newList[i] = val;
    setExpense({ ...expense, [type]: newList });
  };

  const addExpense = async () => {
    if (!expense.category || !expense.amount) return alert("Fill details");
    const finalData = { ...expense, amount: Number(expense.amount), tip: Number(expense.tip) || 0 };
    try {
      const url = editingId ? `${BASE_URL}/${trip._id}/update-expense/${editingId}` : `${BASE_URL}/${trip._id}/expense`;
      const res = await axios.put(url, finalData);
      setTrip(res.data);
      setEditingId(null);
      resetExpenseForm();
      fetchHistory();
    } catch (err) { alert("Error saving data"); }
  };

  const editItem = (item) => {
    setEditingId(item._id);
    setExpense({ ...item, menuItems: item.menuItems ?? [''], shoppingItems: item.shoppingItems ?? [''] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetExpenseForm = () => setExpense({ 
    category: '', amount: '', hotelName: '', menuItems: [''], tip: '',
    travelType: '', vehicleType: '', startPoint: '', endPoint: '', vehicleNumber: '',
    checkIn: '', checkOut: '', shopName: '', shopAddress: '', shoppingItems: ['']
  });

  // --- IMPROVED DOWNLOAD LOGIC ---
  const downloadPDF = (t) => {
    const doc = new jsPDF();
    const totalSpent = t.totalBudget - t.remainingBudget;

    doc.setFontSize(20); doc.setTextColor(85, 107, 47);
    doc.text(`TRIP REPORT: ${t.tripName.toUpperCase()}`, 14, 20);
    
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Travelers: ${t.travelers.filter(n => n).join(', ')}`, 14, 28);
    doc.text(`Dates: ${t.startDate || 'N/A'} to ${t.endDate || 'N/A'}`, 14, 34);

    const rows = (t.expenses || []).map(ex => {
      let fullDetails = "";
      
      // Merge all specific data into the description column
      if (ex.category === "Food") {
        fullDetails = `Hotel: ${ex.hotelName || 'N/A'}\nItems: ${ex.menuItems?.filter(i => i).join(', ') || 'N/A'}\nTip: RS ${ex.tip}`;
      } else if (ex.category === "Stay") {
        fullDetails = `Hotel: ${ex.hotelName || 'N/A'}\nIn: ${ex.checkIn?.replace('T',' ')}\nOut: ${ex.checkOut?.replace('T',' ')}`;
      } else if (ex.category === "Travel") {
        fullDetails = `Type: ${ex.travelType} (${ex.vehicleType})\nFrom: ${ex.startPoint} To: ${ex.endPoint}\nNo: ${ex.vehicleNumber || 'N/A'}`;
      } else if (ex.category === "Shopping") {
        fullDetails = `Shop: ${ex.shopName || 'N/A'}\nItems: ${ex.shoppingItems?.filter(i => i).join(', ') || 'N/A'}`;
      } else {
        fullDetails = "General Expense";
      }

      return [
        new Date(ex.date).toLocaleDateString(),
        ex.category,
        fullDetails,
        `RS ${Number(ex.amount) + (Number(ex.tip)||0)}`
      ];
    });

    autoTable(doc, { 
        head: [['Date', 'Category', 'Complete Details', 'Total']], 
        body: rows, 
        startY: 40,
        styles: { cellPadding: 3, fontSize: 9 },
        headStyles: { fillColor: [85, 107, 47] }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12); doc.setTextColor(0);
    doc.text(`SUMMARY`, 14, finalY);
    doc.text(`Total Budget: RS ${t.totalBudget}`, 14, finalY + 8);
    doc.setTextColor(188, 71, 73);
    doc.text(`Total Spent: RS ${totalSpent}`, 14, finalY + 16);
    doc.setTextColor(85, 107, 47);
    doc.text(`Amount Left: RS ${t.remainingBudget}`, 14, finalY + 24);

    doc.save(`${t.tripName}_Full_Bill.pdf`);
  };

  return (
    <div className="container">
      <h1>Smart Trip Tracker Pro</h1>

      {!trip ? (
        <div className="fade-in">
          <div className="input-group">
            <h3>New Trip</h3>
            <input type="text" placeholder="Trip Name" onChange={e => setFormData({...formData, tripName: e.target.value})} />
            <input type="number" placeholder="Budget" onChange={e => setFormData({...formData, totalBudget: e.target.value})} />
            <input type="number" placeholder="No. of Travelers" onChange={e => handleNumTravelersChange(e.target.value)} />
            {formData.travelers.map((name, i) => (
              <input key={i} placeholder={`Person ${i+1}`} value={name} onChange={e => {
                  const newT = [...formData.travelers]; newT[i] = e.target.value; setFormData({...formData, travelers: newT});
              }} />
            ))}
            <button className="btn-primary" onClick={() => axios.post(BASE_URL, formData).then(res => {setTrip(res.data); fetchHistory();})}>Start</button>
          </div>
          <div className="history-section">
            <h3>📜 History</h3>
            <div className="history-grid">
              {history.map(t => (
                <div key={t._id} className="history-card" onClick={() => setTrip(t)}>
                  <strong>{t.tripName}</strong><br/><small>₹{t.remainingBudget} Bal</small>
                  <button className="delete-icon" onClick={(e) => { e.stopPropagation(); axios.delete(`${BASE_URL}/${t._id}`).then(fetchHistory); }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="fade-in">
          <div className="balance-card"><strong>{trip.tripName}</strong><div className="balance-amount">₹{trip.remainingBudget}</div></div>
          
          <div className="input-group">
            <h3>{editingId ? "📝 Edit Item" : "➕ Add Expense"}</h3>
            <select value={expense.category} onChange={e => setExpense({...expense, category: e.target.value})}>
              <option value="">Category</option>
              <option value="Food">Food 🍔</option><option value="Stay">Stay 🏨</option><option value="Travel">Travel 🚗</option><option value="Shopping">Shopping 🛍️</option>
            </select>

            {expense.category === 'Food' && (
              <div className="sub-form">
                <input type="text" placeholder="Hotel Name" value={expense.hotelName} onChange={e => setExpense({...expense, hotelName: e.target.value})} />
                {(expense.menuItems ?? []).map((it, i) => (
                  <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <input value={it} placeholder="Item" onChange={e => handleListChange('menuItems', i, e.target.value)} />
                    {i === (expense.menuItems?.length ?? 0) - 1 && <button onClick={() => setExpense({...expense, menuItems: [...(expense.menuItems ?? []), '']})} className="plus-btn-small">+</button>}
                  </div>
                ))}
                <input type="number" placeholder="Tip" value={expense.tip} onChange={e => setExpense({...expense, tip: e.target.value})} />
              </div>
            )}

            {expense.category === 'Stay' && (
              <div className="sub-form">
                <input type="text" placeholder="Hotel" value={expense.hotelName} onChange={e => setExpense({...expense, hotelName: e.target.value})} />
                <div className="datetime-row"><label>In:</label><input type="datetime-local" value={expense.checkIn} onChange={e => setExpense({...expense, checkIn: e.target.value})} /></div>
                <div className="datetime-row"><label>Out:</label><input type="datetime-local" value={expense.checkOut} onChange={e => setExpense({...expense, checkOut: e.target.value})} /></div>
              </div>
            )}

            {expense.category === 'Travel' && (
              <div className="sub-form">
                <div className="radio-group">
                    <label><input type="radio" name="tt" value="Rent" checked={expense.travelType === 'Rent'} onChange={e => setExpense({...expense, travelType: e.target.value})} /> Rent</label>
                    <label><input type="radio" name="tt" value="Own" checked={expense.travelType === 'Own'} onChange={e => setExpense({...expense, travelType: e.target.value})} /> Own</label>
                </div>
                <input type="text" placeholder="Vehicle" value={expense.vehicleType} onChange={e => setExpense({...expense, vehicleType: e.target.value})} />
                <input type="text" placeholder="From" value={expense.startPoint} onChange={e => setExpense({...expense, startPoint: e.target.value})} /><input type="text" placeholder="To" value={expense.endPoint} onChange={e => setExpense({...expense, endPoint: e.target.value})} />
                <input type="text" placeholder="Vehicle No." value={expense.vehicleNumber} onChange={e => setExpense({...expense, vehicleNumber: e.target.value})} />
              </div>
            )}

            {expense.category === 'Shopping' && (
              <div className="sub-form">
                <input type="text" placeholder="Shop Name" value={expense.shopName} onChange={e => setExpense({...expense, shopName: e.target.value})} />
                {(expense.shoppingItems ?? []).map((it, i) => (
                  <div key={i} style={{display:'flex', gap:'5px', marginBottom:'5px'}}>
                    <input value={it} placeholder="Item" onChange={e => handleListChange('shoppingItems', i, e.target.value)} />
                    {i === (expense.shoppingItems?.length ?? 0) - 1 && <button onClick={() => setExpense({...expense, shoppingItems: [...(expense.shoppingItems ?? []), '']})} className="plus-btn-small">+</button>}
                  </div>
                ))}
              </div>
            )}

            <input type="number" placeholder="Amount (₹)" value={expense.amount} onChange={e => setExpense({...expense, amount: e.target.value})} />
            <button className="btn-primary" onClick={addExpense}>{editingId ? "Update Item" : "Add to Budget"}</button>
            <button onClick={() => downloadPDF(trip)} className="btn-download-main">📥 Download Detailed Bill</button>
          </div>

          <div className="live-list">
            <h4>Live List:</h4>
            {trip.expenses.map(ex => (
              <div key={ex._id} className="expense-item">
                <div className="expense-info"><b>{ex.category}</b><br/><small>{ex.hotelName || ex.vehicleType || ex.shopName || ""}</small></div>
                <div className="item-actions">
                    <span>-₹{Number(ex.amount) + (Number(ex.tip)||0)}</span>
                    <button onClick={() => editItem(ex)} className="edit-btn">Edit</button>
                    <button onClick={() => axios.delete(`${BASE_URL}/remove-expense/${trip._id}/${ex._id}`).then(res => setTrip(res.data))} className="delete-btn">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <center><button onClick={() => {setTrip(null); fetchHistory();}} className="btn-back">← Dashboard</button></center>
        </div>
      )}
    </div>
  );
}

export default App;