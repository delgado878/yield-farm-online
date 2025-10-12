// script.js - Complete working version
let currentUser = null;
const API_BASE = window.location.origin + '/api';

console.log('🚀 YieldFarm Platform Loading...');
console.log('API Base:', API_BASE);

// Make functions globally available
window.showAuthModal = function(type) {
    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (authModal) {
        authModal.classList.remove('hidden');
        if (type === 'login') {
            if (loginForm) loginForm.classList.remove('hidden');
            if (registerForm) registerForm.classList.add('hidden');
        } else {
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
        }
    }
};

window.hideAuthModal = function() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.classList.add('hidden');
    }
};

window.logout = function() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUIForUser();
    console.log('User logged out');
};

// Show loading state
function showLoading(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Loading...';
    button.disabled = true;
    return originalText;
}

function hideLoading(button, originalText) {
    button.innerHTML = originalText;
    button.disabled = false;
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileButton = document.getElementById('mobile-menu-button');
    if (mobileButton) {
        mobileButton.addEventListener('click', function() {
            const menu = document.getElementById('mobile-menu');
            if (menu) menu.classList.toggle('hidden');
        });
    }
});

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const authModal = document.getElementById('auth-modal');
    if (authModal && e.target === authModal) {
        hideAuthModal();
    }
});

// Login form submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const button = this.querySelector('button[type="submit"]');
        const originalText = showLoading(button);
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        console.log('Attempting login for:', email);
        const result = await loginUser(email, password);
        if (result.success) {
            hideAuthModal();
            updateUIForUser();
        } else {
            alert(result.error || 'Login failed');
        }
        hideLoading(button, originalText);
    });
}

// Register form submission
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const button = this.querySelector('button[type="submit"]');
        const originalText = showLoading(button);
        
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        console.log('Attempting registration for:', email);
        const result = await registerUser(email, password);
        if (result.success) {
            hideAuthModal();
            updateUIForUser();
        } else {
            alert(result.error || 'Registration failed');
        }
        hideLoading(button, originalText);
    });
}

// Real API Functions
async function apiRequest(endpoint, options = {}) {
    try {
        console.log('📡 API Request:', `${API_BASE}${endpoint}`);
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
        console.log('✅ API Response:', data);
        return data;
    } catch (error) {
        console.error('❌ API request failed:', error);
        return { error: 'Network error - Please try again' };
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
        console.log('✅ Login successful:', currentUser.email);
        return result;
    }
    
    return result;
}

function updateUIForUser() {
    const authButtons = document.getElementById('auth-buttons');
    const userSection = document.getElementById('user-section');
    const userEmail = document.getElementById('user-email');
    const mobileAuth = document.getElementById('mobile-auth');
    const mobileUser = document.getElementById('mobile-user');
    const mobileUserEmail = document.getElementById('mobile-user-email');

    if (currentUser) {
        // User is logged in
        if (authButtons) authButtons.classList.add('hidden');
        if (userSection) userSection.classList.remove('hidden');
        if (userEmail) userEmail.textContent = currentUser.email;
        
        if (mobileAuth) mobileAuth.classList.add('hidden');
        if (mobileUser) mobileUser.classList.remove('hidden');
        if (mobileUserEmail) mobileUserEmail.textContent = currentUser.email;
        
        // Update dashboard
        updateDashboardNumbers(currentUser);
        console.log('✅ UI updated for logged in user');
    } else {
        // User is not logged in
        if (authButtons) authButtons.classList.remove('hidden');
        if (userSection) userSection.classList.add('hidden');
        
        if (mobileAuth) mobileAuth.classList.remove('hidden');
        if (mobileUser) mobileUser.classList.add('hidden');
        
        // Reset dashboard
        const balanceDisplay = document.getElementById('balance-display');
        const investmentsDisplay = document.getElementById('investments-display');
        const earningsDisplay = document.getElementById('earnings-display');
        
        if (balanceDisplay) balanceDisplay.textContent = '0.00 USDT';
        if (investmentsDisplay) investmentsDisplay.textContent = '0';
        if (earningsDisplay) earningsDisplay.textContent = '0.00 USDT';
        
        console.log('✅ UI updated for logged out user');
    }
}

function updateDashboardNumbers(user) {
    const balanceDisplay = document.getElementById('balance-display');
    const earningsDisplay = document.getElementById('earnings-display');
    const investmentsDisplay = document.getElementById('investments-display');
    
    if (balanceDisplay) balanceDisplay.textContent = user.balance.toFixed(2) + ' USDT';
    if (earningsDisplay) earningsDisplay.textContent = user.totalEarnings.toFixed(2) + ' USDT';
    if (investmentsDisplay) investmentsDisplay.textContent = user.investments ? user.investments.length : '0';
}

// Calculator functions - YOUR EXACT FORMULA
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
    if (n > 1000000000) {
        return (n / 1000000000).toFixed(2) + 'B';
    }
    if (n > 1000000) {
        return (n / 1000000).toFixed(2) + 'M';
    }
    if (n > 1000) {
        return (n / 1000).toFixed(2) + 'K';
    }
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
        // YOUR EXACT FORMULA: A = P(1 + r)^n
        // Where P = principal, r = APY, n = months
        finalAmount = principal * Math.pow(1 + apy, months);
    } else {
        // Simple interest: A = P(1 + r*t)
        // Where r = APY, t = years (months/12)
        const years = months / 12;
        finalAmount = principal * (1 + apy * years);
    }

    const interest = finalAmount - principal;

    document.getElementById('result').innerHTML = `
        <div class="space-y-2">
            <div class="flex justify-between"><div class="text-defi-muted">APY</div><div class="font-bold">${(apy * 100).toFixed(2)}%</div></div>
            <div class="flex justify-between"><div class="text-defi-muted">Final Amount</div><div class="font-bold">${formatMoney(finalAmount)} USDT</div></div>
            <div class="flex justify-between"><div class="text-defi-muted">Total Interest</div><div class="font-bold">${formatMoney(interest)} USDT</div></div>
            <div class="flex justify-between"><div class="text-defi-muted">Lock Period</div><div class="font-bold">${months} months</div></div>
        </div>
    `;
}

window.calc = calc;

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

window.resetForm = resetForm;

// Investment calculator functions
document.addEventListener('DOMContentLoaded', function() {
    // Calculator buttons
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (calculateBtn) calculateBtn.addEventListener('click', calc);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    
    // Term slider
    const termSlider = document.getElementById('term');
    if (termSlider) {
        termSlider.addEventListener('input', function() {
            const termValue = document.getElementById('termValue');
            const selectedTerm = document.getElementById('selected-term');
            if (termValue) termValue.textContent = this.value;
            if (selectedTerm) selectedTerm.value = this.value + ' months';
        });
    }
    
    // Amount input
    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', function() {
            const selectedAmount = document.getElementById('selected-amount');
            if (selectedAmount) selectedAmount.value = this.value + ' USDT';
        });
    }
    
    // Copy wallet address
    const copyAddressBtn = document.getElementById('copy-address');
    if (copyAddressBtn) {
        copyAddressBtn.addEventListener('click', function() {
            const address = document.getElementById('wallet-address');
            if (address) {
                address.select();
                document.execCommand('copy');
                
                // Visual feedback
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = originalText;
                }, 2000);
            }
        });
    }
    
    // Submit transaction
    const submitTxBtn = document.getElementById('submit-tx');
    if (submitTxBtn) {
        submitTxBtn.addEventListener('click', async function() {
            if (!currentUser) {
                alert('Please login first');
                return;
            }
            
            const button = this;
            const originalText = showLoading(button);
            
            const txHash = document.getElementById('tx-hash').value;
            const amount = document.getElementById('amount').value;
            const lockPeriod = document.getElementById('term').value;
            const compoundType = document.getElementById('compound').value;
            
            if (txHash.trim() === '') {
                alert('Please enter your transaction hash');
                hideLoading(button, originalText);
                return;
            }

            console.log('Creating investment for user:', currentUser.id);
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
                const successMsg = document.getElementById('success-message');
                if (successMsg) successMsg.classList.remove('hidden');
                
                const txHashInput = document.getElementById('tx-hash');
                if (txHashInput) txHashInput.value = '';
                
                // Update user data
                currentUser.balance = result.newBalance;
                if (!currentUser.investments) currentUser.investments = [];
                currentUser.investments.push(result.investment);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUIForUser();
                
                setTimeout(() => {
                    if (successMsg) successMsg.classList.add('hidden');
                }, 5000);
            } else {
                alert(result.error || 'Investment failed');
            }
            
            hideLoading(button, originalText);
        });
    }
    
    // FAQ toggle
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const answer = button.nextElementSibling;
            const icon = button.querySelector('i');
            
            if (answer) answer.classList.toggle('hidden');
            if (icon) {
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            }
        });
    });
    
    // Initialize selected values
    const selectedAmount = document.getElementById('selected-amount');
    const selectedTerm = document.getElementById('selected-term');
    if (selectedAmount) selectedAmount.value = '5000 USDT';
    if (selectedTerm) selectedTerm.value = '12 months';
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded - initializing YieldFarm Platform');
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('✅ Found saved user:', currentUser.email);
        } catch (e) {
            console.error('❌ Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
        }
    }
    
    updateUIForUser();
    calc();
    
    // Test backend connection
    apiRequest('/health').then(health => {
        if (health.status === 'OK') {
            console.log('✅ Backend connected successfully');
        } else {
            console.log('❌ Backend not responding');
        }
    });
    
    console.log('✅ YieldFarm Platform initialized successfully');
});