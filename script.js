// --- CONFIGURATION ---
const SPREADSHEET_ID = '12kHQeKs8OrxADFW7ICgRoZOHpwgambPc2mbeKwkKEMw';
const API_KEY = 'AIzaSyAiUTTvYAc9LG7eoF6eyky49ucGZtyaePU';
const SHEET_NAME = 'Sheet1'; 
const RANGE = `${SHEET_NAME}!A:H`; 
const API_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;

const HEADERS = ['RD NO', 'MOBILE', 'DATE', 'AMT', 'SHARE NAME', 'AGENT', 'COMPANY', 'BRANCH'];

// --- BRANCH PASSWORD MAPPING ---
const BRANCH_PASSWORDS = {
    "ALATHUR": "Alathur#22",
    "ANGAMALY": "Anga77*",
    "CHENGANNUR": "Cheng@34",
    "EDAPPALY": "Edap#55",
    "HARIPAD": "Hari81*",
    "KATTAPANA": "Katta@12",
    "KODUVAYOOR": "Kodu#66",
    "KOTTAYAM": "Kott30*",
    "KUZHALMANAM": "Kuzhal@99",
    "MATTANCHERY": "Mattan#41",
    "MAVELIKKARA": "Maveli88*",
    "MUVATTUPUZHA": "Muva@74",
    "NENMARA": "Nenmara#19",
    "NEDUMKANDOM": "Nedum72*",
    "PARAVUR": "Parv!50",
    "PATHANAMTHITTA": "Pathan#10",
    "PERUMBAVOOR": "Perum43*",
    "THIRUVALLA": "Thiru@05",
    "THIRUWILLAMALA": "Thirui#09",
    "THODUPUZHA": "Thodu61*"
};

// ADDED: Define a common password as requested
const COMMON_PASSWORD = "/"; 

// --- GLOBAL STATE ---
let ALL_DATA = []; 
let FILTERED_BRANCH_DATA = []; 
let agentChartInstance = null; 
let IS_ADMIN_VIEW = false; // Flag to track common password usage

// --- DOM REFERENCES (UPDATED) ---
let branchSelect, branchSelectLogin, branchPassword, loginButton, logoutButton, messageElement, 
    loginContainer, dataDisplay, currentBranchName, dashboardContainer, 
    totalSummaryElement, agentSummaryElement, detailedViewContainer, 
    dataTableBody, monthFilter, backToDashboardButton, tableTitle,
    latestUpdateElement, branchFilterLabel; 

// --- INITIALIZATION (UPDATED) ---
function initDOM() {
    branchSelect = document.getElementById('branch-select'); // Now used as a filter
    branchSelectLogin = document.getElementById('branch-select-login'); // ADDED for login
    branchPassword = document.getElementById('branch-password');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    messageElement = document.getElementById('message');
    loginContainer = document.getElementById('login-container');
    dataDisplay = document.getElementById('data-display');
    currentBranchName = document.getElementById('current-branch-name');
    dashboardContainer = document.getElementById('dashboard-container');
    totalSummaryElement = document.getElementById('total-summary');
    agentSummaryElement = document.getElementById('agent-summary');
    detailedViewContainer = document.getElementById('detailed-view-container');
    dataTableBody = document.querySelector('#data-table tbody');
    monthFilter = document.getElementById('month-filter');
    backToDashboardButton = document.getElementById('back-to-dashboard-button');
    tableTitle = document.getElementById('table-title');
    latestUpdateElement = document.getElementById('latest-update-date');
    branchFilterLabel = document.getElementById('branch-filter-label'); // ADDED label
}

function safeRun(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// --- FETCH DATA ---
async function fetchAllData() { 
    if (!messageElement || !branchSelectLogin) {
        console.error("Critical Error: DOM elements were not assigned before data fetch attempted.");
        return;
    }

    messageElement.textContent = 'Loading data...'; 
    branchSelectLogin.disabled = true; 

    try { 
        const response = await fetch(API_URL); 
        if (!response.ok) { 
            if (response.status === 403) { 
                throw new Error(`403 Forbidden. Check your Sheet's sharing settings and API key restrictions.`); 
            }
            throw new Error(`HTTP error! status: ${response.status}`); 
        }

        const data = await response.json(); 
        const rows = data.values; 
        ALL_DATA = rows.slice(1); 

        const latestDate = getLatestUpdateDate(ALL_DATA);
        if (latestUpdateElement) {
            latestUpdateElement.textContent = `Data Updated Upto: ${latestDate}`;
        }

        populateBranchDropdown(ALL_DATA); 
        messageElement.textContent = 'Please select your branch and enter the password.'; 
        messageElement.className = 'info'; 

    } catch (error) { 
        console.error('Error fetching data:', error); 
        messageElement.textContent = `Error: Failed to load sheet data. (${error.message})`; 
        messageElement.className = 'error'; 
    }
}

// --- POPULATE BRANCH DROPDOWN ---
function populateBranchDropdown(data) {
    const branchColumnIndex = HEADERS.indexOf('BRANCH'); 
    if (branchColumnIndex === -1) {
        messageElement.textContent = 'Error: "BRANCH" header not found.';
        return;
    }

    const uniqueBranches = new Set();
    data.forEach(row => {
        const branchName = row[branchColumnIndex];
        // Only include branches that have a password for login
        if (branchName && BRANCH_PASSWORDS.hasOwnProperty(branchName)) {
            uniqueBranches.add(branchName);
        }
    });

    const sortedBranches = Array.from(uniqueBranches).sort();

    // 1. Populate the LOGIN dropdown
    branchSelectLogin.innerHTML = '<option value="" disabled selected>Select...</option>';
    sortedBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelectLogin.appendChild(option);
    });
    branchSelectLogin.disabled = false;
    
    // 2. Populate the FILTER dropdown (with all options - visibility controlled later)
    branchSelect.innerHTML = '<option value="ALL BRANCHES (Admin View)">All Branches</option>';
    sortedBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelect.appendChild(option);
    });
}


// --- DATE PARSING HELPERS ---
function parseSheetDate(dateString) {
    if (!dateString) return null;

    let date = new Date(dateString);
    
    // Attempt to handle common non-standard formats (d/m/y or y/m/d)
    if (isNaN(date) || date.getFullYear() < 1900) {
        // Try d/m/y, m/d/y, or y/m/d parsing
        const parts = dateString.match(/(\d{1,4})[-/.](\d{1,4})[-/.](\d{2,4})/);
        
        if (parts && parts.length === 4) {
            // Assume d/m/y for simplicity in this case, but proper date handling requires more context
            const year = parseInt(parts[3].length === 2 ? '20' + parts[3] : parts[3]);
            const day = parseInt(parts[1]);
            const month = parseInt(parts[2]) - 1; // Month is 0-indexed
            date = new Date(year, month, day);
        }
    }
    
    // Return the date object only if it seems valid (year >= 1900 to filter out default invalid dates)
    return (!isNaN(date) && date.getFullYear() >= 1900) ? date : null;
}

function getLatestUpdateDate(data) {
    const dateIndex = HEADERS.indexOf('DATE');
    let latestDate = null;
    
    data.forEach(row => {
        const date = parseSheetDate(row[dateIndex]);
        if (date) {
            if (!latestDate || date.getTime() > latestDate.getTime()) {
                latestDate = date;
            }
        }
    });

    if (latestDate) {
        const day = String(latestDate.getDate()).padStart(2, '0');
        const month = String(latestDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = latestDate.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return 'N/A';
}

function formatDateToDisplay(dateString) {
    const date = parseSheetDate(dateString);
    if (!date) return dateString;

    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-GB', options); 
}

// --- NEW HELPER FUNCTION FOR ROBUST NUMBER PARSING ---
function parseCurrencyValue(valueString) {
    if (typeof valueString !== 'string') {
        // If it's already a number or null/undefined, try to convert it directly
        return parseFloat(valueString) || 0;
    }
    
    // 1. Remove commas (thousands separators)
    let cleanString = valueString.replace(/,/g, '');
    
    // 2. Remove any currency symbols or other non-numeric characters, keeping the decimal point
    cleanString = cleanString.replace(/[^0-9.-]/g, '');

    // 3. Parse and return the number, or 0 if parsing fails
    return parseFloat(cleanString) || 0;
}


// --- LOGIN HANDLER ---
function handleLogin() {
    const selectedBranch = branchSelectLogin.value; // Use login select
    const enteredPassword = branchPassword.value;

    if (!selectedBranch || !enteredPassword) {
        messageElement.textContent = 'Please select a branch and enter the password.';
        messageElement.className = 'error';
        return;
    }

    // 1. Check for the Common Password (Admin Login)
    if (enteredPassword === COMMON_PASSWORD) {
        IS_ADMIN_VIEW = true;
        // Admin: Show filter, set initial value to ALL
        branchSelect.value = 'ALL BRANCHES (Admin View)';
        branchSelect.style.display = 'inline-block'; // SHOW the filter
        branchFilterLabel.style.display = 'inline-block'; // SHOW the label
        filterAndProcessData('ALL BRANCHES (Admin View)'); 
        messageElement.textContent = 'Admin view: All branches loaded.';
        messageElement.className = 'success';
    
    // 2. Check for the Specific Branch Password (Regular User Login)
    } else if (enteredPassword === BRANCH_PASSWORDS[selectedBranch]) {
        IS_ADMIN_VIEW = false; 
        // Regular User: Hide filter, set initial value to logged-in branch
        branchSelect.value = selectedBranch;
        branchSelect.style.display = 'none'; // HIDE the filter
        branchFilterLabel.style.display = 'none'; // HIDE the label
        filterAndProcessData(selectedBranch);
        messageElement.textContent = `Successfully logged into ${selectedBranch}.`;
        messageElement.className = 'success';
    
    // 3. Invalid Password
    } else {
        messageElement.textContent = 'Invalid password for this branch.';
        messageElement.className = 'error';
        branchPassword.value = ''; 
        return; // Important to return here
    }
    
    // If login is successful
    loginContainer.classList.add('hidden');
    dataDisplay.classList.remove('hidden');
    detailedViewContainer.classList.add('hidden'); 
    dashboardContainer.classList.remove('hidden');
    branchPassword.value = ''; // Clear password on successful login
    monthFilter.value = 'all'; // Reset month filter
}


// --- FILTER AND PROCESS DATA ---
function filterAndProcessData(branch) {
    
    let dataToUse = [];
    
    // If Admin View is active AND we are filtering for 'ALL BRANCHES'
    if (IS_ADMIN_VIEW && branch === 'ALL BRANCHES (Admin View)') {
        dataToUse = ALL_DATA; 
    } else {
        // Standard view: filter by the specific branch name
        const branchColumnIndex = HEADERS.indexOf('BRANCH'); 
        dataToUse = ALL_DATA.filter(row => row[branchColumnIndex] === branch);
    }
    
    FILTERED_BRANCH_DATA = dataToUse; 

    // Only show an error if no data was found for the *current* selection
    if (FILTERED_BRANCH_DATA.length === 0) {
        messageElement.textContent = `No data found for branch: ${branch}.`;
        messageElement.className = 'error';
    } else if (IS_ADMIN_VIEW) {
         messageElement.textContent = `Data loaded for ${branch}.`;
         messageElement.className = 'success';
    }
    
    currentBranchName.textContent = branch;

    generateDashboard(FILTERED_BRANCH_DATA);
    populateMonthFilter(FILTERED_BRANCH_DATA);
}


// --- DASHBOARD GENERATION (MODIFIED) ---
function generateDashboard(data) {
    // 1. Calculate Summary
    const amtIndex = HEADERS.indexOf('AMT');
    const agentIndex = HEADERS.indexOf('AGENT');
    const rdNoIndex = HEADERS.indexOf('RD NO');

    // MODIFIED: Use the new robust parser
    const totalAmount = data.reduce((sum, row) => sum + parseCurrencyValue(row[amtIndex]), 0);
    const totalTransactions = data.length;
    
    const agentData = {};
    data.forEach(row => {
        const agentName = row[agentIndex] || 'UNKNOWN';
        // MODIFIED: Use the new robust parser
        const amount = parseCurrencyValue(row[amtIndex]); 
        const rdNo = row[rdNoIndex];
        
        if (!agentData[agentName]) {
            agentData[agentName] = { 
                amount: 0, 
                count: 0,
                transactions: []
            };
        }
        
        agentData[agentName].amount += amount;
        agentData[agentName].count++;
        agentData[agentName].transactions.push(row);
    });

    // Sort agents by amount descending
    const sortedAgents = Object.entries(agentData)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.amount - a.amount);

    // 2. Render Total Summary
    totalSummaryElement.innerHTML = `
        <div class="summary-card total-card">
            <h4>Total Amount:</h4>
            <p class="big-number">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div class="summary-card count-card">
            <h4>Total Transactions:</h4>
            <p class="big-number">${totalTransactions.toLocaleString('en-IN')}</p>
        </div>
    `;

    // 3. Render Agent Summary
    agentSummaryElement.innerHTML = '';
    sortedAgents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'summary-card agent-card';
        card.innerHTML = `
            <h4>${agent.name}</h4>
            <p>Amount: ₹${agent.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p>Transactions: ${agent.count.toLocaleString('en-IN')}</p>
        `;
        // Add click listener to show detailed view
        card.addEventListener('click', () => showDetailedView(agent.name, agent.transactions));
        agentSummaryElement.appendChild(card);
    });

    // 4. Render Chart
    renderAgentChart(sortedAgents);
}

function renderAgentChart(sortedAgents) {
    const ctx = document.getElementById('agentBarChart').getContext('2d');
    
    // Destroy previous chart instance if it exists
    if (agentChartInstance) {
        agentChartInstance.destroy();
    }
    
    const labels = sortedAgents.map(a => a.name);
    const dataAmounts = sortedAgents.map(a => a.amount);
    
    agentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Amount (₹)',
                data: dataAmounts,
                backgroundColor: 'rgba(0, 123, 255, 0.7)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (INR)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x !== null) {
                                label += '₹' + context.parsed.x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


// --- DETAILED VIEW AND FILTERING (MODIFIED) ---
function showDetailedView(agentName, transactions) {
    tableTitle.textContent = `Detailed Transactions for Agent: ${agentName}`;
    dataTableBody.innerHTML = ''; // Clear previous data
    
    const amtIndex = HEADERS.indexOf('AMT'); // Get index once

    transactions.forEach(row => {
        const tr = document.createElement('tr');
        // MODIFIED: Use the new robust parser for safe display calculation
        const amountValue = parseCurrencyValue(row[amtIndex]); 

        tr.innerHTML = `
            <td>${row[HEADERS.indexOf('RD NO')]}</td>
            <td>${row[HEADERS.indexOf('MOBILE')]}</td>
            <td>${formatDateToDisplay(row[HEADERS.indexOf('DATE')])}</td>
            <td class="numeric">₹${amountValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${row[HEADERS.indexOf('SHARE NAME')]}</td>
            <td>${row[HEADERS.indexOf('AGENT')]}</td>
            <td>${row[HEADERS.indexOf('COMPANY')]}</td>
            <td>${row[HEADERS.indexOf('BRANCH')]}</td>
        `;
        dataTableBody.appendChild(tr);
    });

    dashboardContainer.classList.add('hidden');
    detailedViewContainer.classList.remove('hidden');
}

function populateMonthFilter(data) {
    const dateIndex = HEADERS.indexOf('DATE');
    const uniqueMonths = new Set();

    data.forEach(row => {
        const date = parseSheetDate(row[dateIndex]);
        if (date) {
            // Format as YYYY-MM for sorting and display
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(monthYear);
        }
    });

    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => {
        // YYYY-MM format ensures correct string sorting for chronological order
        return a.localeCompare(b);
    });

    // Populate the dropdown
    monthFilter.innerHTML = '<option value="all">All Months</option>';
    sortedMonths.forEach(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = monthName;
        monthFilter.appendChild(option);
    });
}

function filterByMonth(e) {
    const selectedMonth = e.target.value;
    const dateIndex = HEADERS.indexOf('DATE');

    let dataToFilter = FILTERED_BRANCH_DATA; // Start with the data already filtered by branch

    if (selectedMonth !== 'all') {
        dataToFilter = FILTERED_BRANCH_DATA.filter(row => {
            const date = parseSheetDate(row[dateIndex]);
            if (!date) return false;
            
            const rowMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return rowMonthYear === selectedMonth;
        });
    }

    generateDashboard(dataToFilter);
}


// --- BRANCH FILTER HANDLER ---
function filterByBranch(e) {
    const selectedBranch = e.target.value;
    
    // CRITICAL: Only allow branch filtering if IS_ADMIN_VIEW is true
    if (!IS_ADMIN_VIEW) {
        // A regular user shouldn't even see the filter, but this is a failsafe
        // Reset the value to the currently displayed branch if somehow it was triggered
        const loggedInBranch = currentBranchName.textContent;
        e.target.value = loggedInBranch; 
        return; 
    }
    
    // The filterAndProcessData handles logic for both 'ALL BRANCHES' and specific branches
    filterAndProcessData(selectedBranch);
    
    // Always reset the month filter when the branch filter changes
    monthFilter.value = 'all'; 
}

function backToDashboard() {
    detailedViewContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    // Generates the dashboard with the currently filtered data
    generateDashboard(FILTERED_BRANCH_DATA);
}

function handleLogout() {
    // Reset admin flag
    IS_ADMIN_VIEW = false; 
    
    // Clear global state
    FILTERED_BRANCH_DATA = [];
    branchSelectLogin.value = ''; // Clear login select
    branchPassword.value = '';
    
    // Switch views back to login
    loginContainer.classList.remove('hidden');
    dataDisplay.classList.add('hidden');
    
    // Ensure filter controls are visible for the next (potentially admin) login
    branchSelect.style.display = 'inline-block'; 
    branchFilterLabel.style.display = 'inline-block'; 
    
    // Update message
    messageElement.textContent = 'Please select your branch and enter the password.';
    messageElement.className = 'info';
}

// --- FINAL SETUP ---
safeRun(() => {
    initDOM();
    fetchAllData();

    // Attach all event listeners
    loginButton.addEventListener('click', handleLogin);
    logoutButton.addEventListener('click', handleLogout);
    
    // ADDED: New event listener for the branch filter
    branchSelect.addEventListener('change', filterByBranch); 
    
    monthFilter.addEventListener('change', filterByMonth);
    backToDashboardButton.addEventListener('click', backToDashboard);
    branchPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleLogin();
    });
});
