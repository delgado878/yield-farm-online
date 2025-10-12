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
app.use(express.static('.'));

// Database file path
const DB_PATH = path.join(__dirname, 'data', 'users.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initialize database if it doesn't exist
function initDatabase() {
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
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: [] };
    }
}

// Write to database
function writeDatabase(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing to database:', error);
        return false;
    }
}

// Initialize database on startup
initDatabase();

// Routes

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
    const apy = 0.30 + ((lockPeriod - 3) / 21) * 1.70;

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

    // Calculate weekly gains
    const activeInvestments = user.investments ? user.investments.filter(inv => inv.status === 'active') : [];
    const weeklyGains = activeInvestments.reduce((total, inv) => {
        const weeklyReturn = (inv.amount * inv.apy) / 52;
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
                    // Calculate daily earnings
                    const dailyEarnings = (investment.amount * investment.apy) / 365;
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 YieldFarm Server running on port ${PORT}`);
    console.log(`📊 Database file: ${DB_PATH}`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
