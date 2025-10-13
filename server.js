const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Simple in-memory storage (for now)
let users = [];
let investments = [];

// APY calculation function
function apyFromTerm(months) {
  const minMonths = 3;
  const maxMonths = 24;
  const minApy = 0.30;
  const maxApy = 2.00;
  const t = (Math.min(Math.max(months, minMonths), maxMonths) - minMonths) / (maxMonths - minMonths);
  return minApy + t * (maxApy - minApy);
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'YieldFarm API is running',
    timestamp: new Date().toISOString(),
    usersCount: users.length
  });
});

// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: 'user_' + Date.now(),
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      balance: 0,
      totalEarnings: 0,
      investments: []
    };

    users.push(newUser);
    
    console.log(`New user registered: ${email}`);
    res.json({ 
      success: true, 
      message: 'Registration successful',
      user: { 
        id: newUser.id, 
        email: newUser.email,
        balance: newUser.balance
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        investments: user.investments || []
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create Investment
app.post('/api/invest', (req, res) => {
  try {
    const { userId, amount, lockPeriod, compoundType, transactionHash } = req.body;
    
    if (!userId || !amount || !lockPeriod || !transactionHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate amount
    const investmentAmount = parseFloat(amount);
    if (investmentAmount < 500 || investmentAmount > 1000000) {
      return res.status(400).json({ error: 'Amount must be between 500 and 1,000,000 USDT' });
    }

    // Calculate APY
    const apy = apyFromTerm(lockPeriod);

    const newInvestment = {
      id: 'inv_' + Date.now(),
      userId,
      amount: investmentAmount,
      lockPeriod: parseInt(lockPeriod),
      compoundType: compoundType || 'monthly',
      apy,
      transactionHash,
      startDate: new Date().toISOString(),
      status: 'active'
    };

    // Update user balance and add investment
    user.balance += investmentAmount;
    if (!user.investments) user.investments = [];
    user.investments.push(newInvestment);

    console.log(`New investment: ${investmentAmount} USDT by ${user.email}`);
    res.json({
      success: true,
      investment: newInvestment,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('Investment error:', error);
    res.status(500).json({ error: 'Investment failed' });
  }
});

// Get user data
app.get('/api/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        investments: user.investments || []
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Get wallet address
app.get('/api/wallet-address', (req, res) => {
  res.json({ address: "0x71C7656EC7ab88b098defB751B7401B5f6d897AB" });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Export for Vercel
module.exports = app;

// Only start server if not in Vercel
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 YieldFarm Server running on port ${PORT}`);
    console.log(`✅ Backend API: http://localhost:${PORT}/api`);
    console.log(`✅ Frontend: http://localhost:${PORT}`);
  });
}