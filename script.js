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
    "PARAVUR": "Parav@50",
    "PATHANAMTHITTA": "Pathan#10",
    "PERUMBAVOOR": "Perum43*",
    "THIRUVALLA": "Thiru@05",
    "THIRUWILLAMALA": "Thirui#09",
    "THODUPUZHA": "Thodu61*"
};

// --- GLOBAL STATE ---
let ALL_DATA = []; 
let FILTERED_BRANCH_DATA = []; 
let agentChartInstance = null; 

// --- DOM REFERENCES ---
let branchSelect, branchPassword, loginButton, logoutButton, messageElement, 
    loginContainer, dataDisplay, currentBranchName, dashboardContainer, 
    totalSummaryElement, agentSummaryElement, detailedViewContainer, 
    dataTableBody, monthFilter, backToDashboardButton, tableTitle,
    latestUpdateElement; // <-- ADDED

// --- INITIALIZATION ---
function initDOM() {
    branchSelect = document.getElementById('branch-select');
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
    latestUpdateElement = document.getElementById('latest-update-date'); // <-- ADDED
}

function safeRun(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// --- FETCH DATA ---
// --- FETCH DATA ---
async function fetchAllData() { 
    if (!messageElement || !branchSelect) {
        console.error("Critical Error: DOM elements were not assigned before data fetch attempted.");
        return;
    }

    messageElement.textContent = 'Loading data...'; 
    branchSelect.disabled = true; 

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

        // ADDED: Calculate and display the latest date
        const latestDate = getLatestUpdateDate(ALL_DATA);
        if (latestUpdateElement) {
            latestUpdateElement.textContent = `Data Updated Upto: ${latestDate}`;
        }
        // END ADDED

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
        if (branchName && BRANCH_PASSWORDS.hasOwnProperty(branchName)) {
            uniqueBranches.add(branchName);
        }
    });

    branchSelect.innerHTML = '<option value="" disabled selected>Select...</option>';
    uniqueBranches.forEach(branch => {
        const option = document.createElement('option');
        option.value = branch;
        option.textContent = branch;
        branchSelect.appendChild(option);
    });

    branchSelect.disabled = false;
}
// --- DATE PARSING HELPER ---

function parseSheetDate(dateString) {
    if (!dateString) return null;
    
    // 1. Attempt to parse standard formats (YYYY-MM-DD, etc.)
    let date = new Date(dateString);

    // 2. If initial parsing fails or results in a bad date, try manual parsing
    if (isNaN(date) || date.getFullYear() < 1900) {
        // This regex captures the three date parts separated by -, /, or .
        const parts = dateString.match(/(\d{1,4})[-/.](\d{1,4})[-/.](\d{2,4})/);
        
        if (parts && parts.length === 4) {
            // Your format is DD/MM/YYYY.
            // parts[1] is DD, parts[2] is MM, parts[3] is YYYY
            
            const year = parseInt(parts[3].length === 2 ? '20' + parts[3] : parts[3]);
            // FIX: Set day using parts[1] and month using parts[2]
            const day = parseInt(parts[1]);
            const month = parseInt(parts[2]) - 1; // Month is 0-indexed (0=Jan, 11=Dec)
            
            date = new Date(year, month, day);
        }
    }
    
    // Final check for validity
    return (!isNaN(date) && date.getFullYear() >= 1900) ? date : null;
}

// --- LATEST DATE FINDER ---
function getLatestUpdateDate(data) {
    const dateIndex = HEADERS.indexOf('DATE');
    let latestDate = null;

    data.forEach(row => {
        // Use the robust parser we fixed earlier
        const date = parseSheetDate(row[dateIndex]);
        if (date) {
            // Check if this date is later than the current latestDate
            if (!latestDate || date.getTime() > latestDate.getTime()) {
                latestDate = date;
            }
        }
    });

    if (latestDate) {
        // Format the date as DD/MM/YYYY
        const day = String(latestDate.getDate()).padStart(2, '0');
        const month = String(latestDate.getMonth() + 1).padStart(2, '0');
        const year = latestDate.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return 'N/A';
}

// --- LOGIN HANDLER ---
function handleLogin() {
    const selectedBranch = branchSelect.value;
    const enteredPassword = branchPassword.value;

    if (!selectedBranch || !enteredPassword) {
        messageElement.textContent = 'Please select a branch and enter the password.';
        messageElement.className = 'error';
        return;
    }

    if (enteredPassword === BRANCH_PASSWORDS[selectedBranch]) {
        filterAndProcessData(selectedBranch);
    } else {
        messageElement.textContent = 'Invalid password for this branch.';
        messageElement.className = 'error';
        branchPassword.value = ''; 
    }
}

// --- FILTER AND PROCESS DATA ---
function filterAndProcessData(branch) {
    const branchColumnIndex = HEADERS.indexOf('BRANCH'); 
    FILTERED_BRANCH_DATA = ALL_DATA.filter(row => row[branchColumnIndex] === branch);

    if (FILTERED_BRANCH_DATA.length === 0) {
        messageElement.textContent = 'No data found for this branch.';
        messageElement.className = 'error';
        return;
    }
    
    currentBranchName.textContent = branch;
    loginContainer.classList.add('hidden');
    dataDisplay.classList.remove('hidden');
    detailedViewContainer.classList.add('hidden'); 
    dashboardContainer.classList.remove('hidden');
    messageElement.textContent = ''; 
    monthFilter.value = 'all'; 

    generateDashboard(FILTERED_BRANCH_DATA);
    populateMonthFilter(FILTERED_BRANCH_DATA);
}

// --- DASHBOARD GENERATION ---

function populateMonthFilter(data) {
    const dateIndex = HEADERS.indexOf('DATE');
    const uniqueMonths = new Set();

    data.forEach(row => {
        const dateString = row[dateIndex];
        // Use the new, robust parser
        const date = parseSheetDate(dateString); 
        
        if (date) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(key);
        }
    });

    const sortedMonths = Array.from(uniqueMonths).sort();
    monthFilter.innerHTML = '<option value="all">All Months</option>';
    sortedMonths.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        // This is safe because the 'date' was validated in parseSheetDate
        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }); 
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = `${monthName} ${year}`;
        monthFilter.appendChild(option);
    });
}

function generateDashboard(data) {
    const amtIndex = HEADERS.indexOf('AMT');
    const agentIndex = HEADERS.indexOf('AGENT');
    
    let totalAmount = 0;
    const agentSummary = {};

    data.forEach(row => {
        let amount = parseFloat((row[amtIndex] || '').replace(/[₹$,\s]/g, '')) || 0;
        totalAmount += amount;
        const agent = row[agentIndex] || 'Unassigned';
        if (!agentSummary[agent]) agentSummary[agent] = { count: 0, amount: 0, data: [] };
        agentSummary[agent].count++;
        agentSummary[agent].amount += amount;
        agentSummary[agent].data.push(row);
    });

    totalSummaryElement.innerHTML = `
        <div class="summary-card"><h3>Total RD Count</h3><p>${data.length}</p></div>
        <div class="summary-card"><h3>Total Amount</h3><p>₹ ${totalAmount.toFixed(2)}</p></div>
    `;

    agentSummaryElement.innerHTML = '';
    for (const agent in agentSummary) {
        const summary = agentSummary[agent];
        const card = document.createElement('div');
        card.className = 'summary-card agent-card';
        card.innerHTML = `<h3>${agent}</h3><p>Count: ${summary.count}</p><p>Amount: ₹ ${summary.amount.toFixed(2)}</p>`;
        card.addEventListener('click', () => showDetailedView(summary.data, `${agent}'s Transactions`));
        agentSummaryElement.appendChild(card);
    }

    renderAgentChart(agentSummary);
}

function renderAgentChart(agentSummary) {
    const ctx = document.getElementById('agentBarChart').getContext('2d');
    const chartData = Object.entries(agentSummary)
        .map(([name, val]) => ({ name, amount: val.amount }))
        .sort((a, b) => b.amount - a.amount);

    if (agentChartInstance) agentChartInstance.destroy();
    agentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.name),
            datasets: [{
                label: 'Total Amount (₹)',
                data: chartData.map(d => d.amount),
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
    });
}

// --- DETAILED VIEW, FILTERS, LOGOUT ---
function showDetailedView(data, title) {
    tableTitle.textContent = title;
    dataTableBody.innerHTML = data.map(row => 
        // Generates a table row (<tr>) with all the column data (<td>)
        `<tr>${HEADERS.map((_, j) => `<td>${row[j] || ''}</td>`).join('')}</tr>`
    ).join('') || '<tr><td colspan="8">No records.</td></tr>';

    dashboardContainer.classList.add('hidden');
    detailedViewContainer.classList.remove('hidden');
}

function filterByMonth(e) {
    const val = e.target.value;
    if (val === 'all') return generateDashboard(FILTERED_BRANCH_DATA);
    
    const dateIndex = HEADERS.indexOf('DATE');
    
    const monthlyData = FILTERED_BRANCH_DATA.filter(row => {
        // FIX: Use the robust parseSheetDate function for reliable parsing
        const d = parseSheetDate(row[dateIndex]); 
        
        // Check if parsing failed (parseSheetDate returns null on failure)
        if (!d) return false; 
        
        // Format the date for comparison (YYYY-MM)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === val;
    });
    
    generateDashboard(monthlyData);
}

function backToDashboard() {
    detailedViewContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    // Generates the dashboard with the currently filtered branch data (unfiltered by month)
    generateDashboard(FILTERED_BRANCH_DATA);
}

function handleLogout() {
    // Clear global state
    FILTERED_BRANCH_DATA = [];
    branchSelect.value = '';
    branchPassword.value = '';
    
    // Switch views back to login
    loginContainer.classList.remove('hidden');
    dataDisplay.classList.add('hidden');
    
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
    monthFilter.addEventListener('change', filterByMonth);
    backToDashboardButton.addEventListener('click', backToDashboard);
    branchPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleLogin();
    });
});