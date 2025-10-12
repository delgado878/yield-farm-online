// script.js
// Authentication state
let currentUser = null;
const API_BASE = window.location.origin + '/api';

// DOM Elements
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authButtons = document.getElementById('auth-buttons');
const userSection = document.getElementById('user-section');
const userEmail = document.getElementById('user-email');
const mobileAuth = document.getElementById('mobile-auth');
const mobileUser = document.getElementById('mobile-user');
const mobileUserEmail = document.getElementById('mobile-user-email');

// Mobile menu toggle
document.getElementById('mobile-menu-button').addEventListener('click', function() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
});

// Auth modal functions
function showAuthModal(type) {
    authModal.classList.remove('hidden');
    if (type === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

function hideAuthModal() {
    authModal.classList.add('hidden');
}

// Close modal when clicking outside
authModal.addEventListener('click', function(e) {
    if (e.target === authModal) {
        hideAuthModal();
    }
});

// Login form submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const result = await loginUser(email, password);
    if (result.success) {
        hideAuthModal();
        updateUIForUser();
    } else {
        alert(result.error || 'Login failed');
    }
});

// Register form submission
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    const result = await registerUser(email, password);
    if (result.success) {
        hideAuthModal();
        updateUIForUser();
    } else {
        alert(result.error || 'Registration failed');
    }
});

// API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        return { error: 'Network error - Please check if server is running' };
    }
}

async function registerUser(email, password) {
    const result = await apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    
    if (result.success) {
        return loginUser(email, password);
    }
    
    return result;
}

async function loginUser(email, password) {
    const result = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    
    if (result.success) {
        currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return result;
    }
    
    return result;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUIForUser();
}

function updateUIForUser() {
    if (currentUser) {
        // User is logged in
        authButtons.classList.add('hidden');
        userSection.classList.remove('hidden');
        userEmail.textContent = currentUser.email;
        
        mobileAuth.classList.add('hidden');
        mobileUser.classList.remove('hidden');
        mobileUserEmail.textContent = currentUser.email;
        
        // Update dashboard
        updateDashboardNumbers(currentUser);
    } else {
        // User is not logged in
        authButtons.classList.remove('hidden');
        userSection.classList.add('hidden');
        
        mobileAuth.classList.remove('hidden');
        mobileUser.classList.add('hidden');
        
        // Reset dashboard
        document.getElementById('balance-display').textContent = '0.00 USDT';
        document.getElementById('investments-display').textContent = '0';
        document.getElementById('earnings-display').textContent = '0.00 USDT';
    }
}

function updateDashboardNumbers(user) {
    document.getElementById('balance-display').textContent = user.balance.toFixed(2) + ' USDT';
    document.getElementById('earnings-display').textContent = user.totalEarnings.toFixed(2) + ' USDT';
    document.getElementById('investments-display').textContent = user.investments ? user.investments.length : '0';
}

// Investment calculator functions
document.getElementById('calculate-btn').addEventListener('click', calc);
document.getElementById('reset-btn').addEventListener('click', resetForm);
document.getElementById('term').addEventListener('input', function() {
    document.getElementById('termValue').textContent = this.value;
    document.getElementById('selected-term').value = this.value + ' months';
});

// Update selected amount when input changes
document.getElementById('amount').addEventListener('input', function() {
    document.getElementById('selected-amount').value = this.value + ' USDT';
});

// Initialize selected values
document.getElementById('selected-amount').value = document.getElementById('amount').value + ' USDT';
document.getElementById('selected-term').value = document.getElementById('term').value + ' months';

// Copy wallet address
document.getElementById('copy-address').addEventListener('click', function() {
    const address = document.getElementById('wallet-address');
    address.select();
    document.execCommand('copy');
    
    // Visual feedback
    const originalText = this.textContent;
    this.textContent = 'Copied!';
    setTimeout(() => {
        this.textContent = originalText;
    }, 2000);
});

// Submit transaction
document.getElementById('submit-tx').addEventListener('click', async function() {
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    const txHash = document.getElementById('tx-hash').value;
    const amount = document.getElementById('amount').value;
    const lockPeriod = document.getElementById('term').value;
    const compoundType = document.getElementById('compound').value;
    
    if (txHash.trim() === '') {
        alert('Please enter your transaction hash');
        return;
    }

    const result = await apiRequest('/invest', {
        method: 'POST',
        body: JSON.stringify({
            userId: currentUser.id,
            amount,
            lockPeriod,
            compoundType,
            transactionHash: txHash
        }),
    });
    
    if (result.success) {
        document.getElementById('success-message').classList.remove('hidden');
        document.getElementById('tx-hash').value = '';
        
        // Update user data
        currentUser.balance = result.newBalance;
        if (!currentUser.investments) currentUser.investments = [];
        currentUser.investments.push(result.investment);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForUser();
        
        setTimeout(() => {
            document.getElementById('success-message').classList.add('hidden');
        }, 5000);
    } else {
        alert(result.error || 'Investment failed');
    }
});

// FAQ toggle
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const answer = button.nextElementSibling;
        const icon = button.querySelector('i');
        
        answer.classList.toggle('hidden');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
    });
});

// Calculator functions
function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

function apyFromTerm(months) {
    const minMonths = 3;
    const maxMonths = 24;
    const minApy = 0.30; // 30%
    const maxApy = 2.00; // 200%
    const t = (clamp(months, minMonths, maxMonths) - minMonths) / (maxMonths - minMonths);
    return minApy + t * (maxApy - minApy);
}

function formatMoney(n) { 
    return Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); 
}

function calc() {
    const amountEl = document.getElementById('amount');
    const termEl = document.getElementById('term');
    const comp = document.getElementById('compound').value;

    let principal = Number(amountEl.value);
    const months = Number(termEl.value);

    if (Number.isNaN(principal) || principal < 500 || principal > 1000000) {
        document.getElementById('result').innerHTML = '<div class="text-red-400">Enter amount between 500 and 1,000,000 USDT.</div>';
        return;
    }

    const apy = apyFromTerm(months);

    let finalAmount;
    if (comp === 'monthly') {
        const periods = months;
        const monthlyRate = Math.pow(1 + apy, 1 / 12) - 1;
        finalAmount = principal * Math.pow(1 + monthlyRate, periods);
    } else {
        finalAmount = principal * (1 + apy * (months / 12));
    }

    const interest = finalAmount - principal;

    document.getElementById('result').innerHTML = `
        <div class="space-y-2">
            <div class="flex justify-between"><div class="text-defi-muted">APY</div><div class="font-bold">${(apy * 100).toFixed(2)}%</div></div>
            <div class="flex justify-between"><div class="text-defi-muted">Final Amount</div><div class="font-bold">${formatMoney(finalAmount)} USDT</div></div>
            <div class="flex justify-between"><div class="text-defi-muted">Total Interest</div><div class="font-bold">${formatMoney(interest)} USDT</div></div>
        </div>
    `;
}

function resetForm() {
    document.getElementById('amount').value = 5000;
    document.getElementById('term').value = 12;
    document.getElementById('termValue').textContent = '12';
    document.getElementById('compound').value = 'monthly';
    document.getElementById('result').innerHTML = '<p class="text-defi-muted text-center">Enter your investment details to see projected returns</p>';
    document.getElementById('selected-amount').value = '5000 USDT';
    document.getElementById('selected-term').value = '12 months';
    calc();
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
    
    updateUIForUser();
    calc();
});