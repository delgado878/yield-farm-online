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

// Database file path - Use /tmp for Vercel serverless compatibility
const DB_PATH = '/tmp/data/users.json';

// Ensure data directory exists
function ensureDataDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created data directory:', dir);
  }
}

// Initialize database if it doesn't exist
function initDatabase() {
  ensureDataDirectory();
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      settings: {
        wallet_address: "0x71C7656EC7ab88b098defB751B7401B5f6d897AB"
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    console.log('Database initialized at:', DB_PATH);
  }
}

// Read database
function readDatabase() {
  try {
    ensureDataDirectory();
    // Create file if it doesn't exist
    if (!fs.existsSync(DB_PATH)) {
      initDatabase();
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    // Return default structure if file is corrupted
    return { 
      users: [], 
      settings: { 
        wallet_address: "0x71C7656EC7ab88b098defB751B7401B5f6d897AB" 
      } 
    };
  }
}

// Write to database
function writeDatabase(data) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing to database:', error);
    return false;
  }
}

// Initialize database on startup
initDatabase();

// APY calculation function (matches frontend)
function apyFromTerm(months) {
  const minMonths = 3;
  const maxMonths = 24;
  const minApy = 0.30; // 30%
  const maxApy = 2.00; // 200%
  const t = (Math.min(Math.max(months, minMonths), maxMonths) - minMonths) / (maxMonths - minMonths);
  return minApy + t * (maxApy - minApy);
}

// API Routes

// User Registration
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDatabase();

  // Check if user already exists
  const existingUser = db.users.find(user => user.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  // Limit to 10 users max
  if (db.users.length >= 10) {
    return res.status(400).json({ error: 'Maximum user limit reached (10 users)' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create new user
  const newUser = {
    id: 'user_' + Date.now(),
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    balance: 0,
    totalEarnings: 0,
    investments: [],
    isActive: true
  };

  db.users.push(newUser);
  
  if (writeDatabase(db)) {
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
  } else {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDatabase();

  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  if (!user.isActive) {
    return res.status(400).json({ error: 'Account is deactivated' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).json({ error: 'Invalid password' });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  writeDatabase(db);

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
});

// Create Investment
app.post('/api/invest', (req, res) => {
  const { userId, amount, lockPeriod, compoundType, transactionHash } = req.body;
  
  if (!userId || !amount || !lockPeriod || !transactionHash) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = readDatabase();

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Validate amount
  const investmentAmount = parseFloat(amount);
  if (investmentAmount < 500 || investmentAmount > 1000000) {
    return res.status(400).json({ error: 'Amount must be between 500 and 1,000,000 USDT' });
  }

  // Calculate APY based on lock period (30% to 200%)
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
    endDate: new Date(Date.now() + lockPeriod * 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    totalEarned: 0,
    weeklyEarnings: []
  };

  // Update user balance and add investment
  user.balance += investmentAmount;
  if (!user.investments) user.investments = [];
  user.investments.push(newInvestment);
  
  // Add transaction record
  const transaction = {
    id: 'tx_' + Date.now(),
    type: 'deposit',
    amount: investmentAmount,
    timestamp: new Date().toISOString(),
    hash: transactionHash
  };
  
  if (!user.transactions) user.transactions = [];
  user.transactions.push(transaction);

  if (writeDatabase(db)) {
    console.log(`New investment: ${investmentAmount} USDT by ${user.email}`);
    res.json({
      success: true,
      investment: newInvestment,
      newBalance: user.balance
    });
  } else {
    res.status(500).json({ error: 'Failed to create investment' });
  }
});

// Get user data
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const db = readDatabase();

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Calculate weekly gains using your APY formula
  const activeInvestments = user.investments ? user.investments.filter(inv => inv.status === 'active') : [];
  const weeklyGains = activeInvestments.reduce((total, inv) => {
    // Weekly return using your formula: P(1 + r)^n where n = 1/52 (one week)
    const weeklyReturn = inv.amount * (Math.pow(1 + inv.apy, 1/52) - 1);
    return total + weeklyReturn;
  }, 0);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      balance: user.balance,
      totalEarnings: user.totalEarnings,
      investments: user.investments || [],
      transactions: user.transactions || []
    },
    weeklyGains: weeklyGains
  });
});

// Get wallet address
app.get('/api/wallet-address', (req, res) => {
  const db = readDatabase();
  res.json({ address: db.settings.wallet_address });
});

// Update earnings (manual trigger for demo)
app.post('/api/update-earnings', (req, res) => {
  const db = readDatabase();
  const now = new Date();

  db.users.forEach(user => {
    if (user.investments) {
      user.investments.forEach(investment => {
        if (investment.status === 'active') {
          // Calculate daily earnings using your APY formula
          // Daily rate = (1 + APY)^(1/365) - 1
          const dailyRate = Math.pow(1 + investment.apy, 1/365) - 1;
          const dailyEarnings = investment.amount * dailyRate;
          
          investment.totalEarned += dailyEarnings;
          
          // Update user balance and total earnings
          user.balance += dailyEarnings;
          user.totalEarnings += dailyEarnings;
          
          // Record weekly earnings (for chart)
          if (!investment.weeklyEarnings) investment.weeklyEarnings = [];
          const weekData = {
            week: Math.floor((now - new Date(investment.startDate)) / (7 * 24 * 60 * 60 * 1000)),
            earnings: dailyEarnings,
            timestamp: now.toISOString()
          };
          investment.weeklyEarnings.push(weekData);
        }
      });
    }
  });

  if (writeDatabase(db)) {
    res.json({ success: true, message: 'Earnings updated for all users' });
  } else {
    res.status(500).json({ error: 'Failed to update earnings' });
  }
});

// Get all users (for admin purposes)
app.get('/api/users', (req, res) => {
  const db = readDatabase();
  // Return users without passwords
  const usersWithoutPasswords = db.users.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  res.json({ users: usersWithoutPasswords });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Calculate projected returns (for frontend verification)
app.post('/api/calculate', (req, res) => {
  const { amount, lockPeriod, compoundType } = req.body;
  
  if (!amount || !lockPeriod) {
    return res.status(400).json({ error: 'Amount and lock period are required' });
  }

  const investmentAmount = parseFloat(amount);
  const months = parseInt(lockPeriod);
  
  if (investmentAmount < 500 || investmentAmount > 1000000) {
    return res.status(400).json({ error: 'Amount must be between 500 and 1,000,000 USDT' });
  }

  const apy = apyFromTerm(months);

  let finalAmount;
  if (compoundType === 'monthly') {
    // YOUR EXACT FORMULA: A = P(1 + r)^n
    finalAmount = investmentAmount * Math.pow(1 + apy, months);
  } else {
    // Simple interest: A = P(1 + r*t)
    const years = months / 12;
    finalAmount = investmentAmount * (1 + apy * years);
  }

  const interest = finalAmount - investmentAmount;

  res.json({
    success: true,
    apy: apy * 100,
    finalAmount,
    interest,
    lockPeriod: months
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Export for Vercel
module.exports = app;

// Only listen if not in Vercel
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 YieldFarm Server running on port ${PORT}`);
    console.log(`📊 Database location: ${DB_PATH}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    console.log(`📈 APY Range: 30% (3 months) to 200% (24 months)`);
  });
}