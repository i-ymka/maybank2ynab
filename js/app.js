/**
 * Maybank to YNAB - Main Application v3
 * With editable fields, duplicate checking, and learning system
 */

// SVG Icons (replacing emojis)
const ICONS = {
    sun: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    skip: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

// Global state
let uploadedFiles = [];
let parsedTransactions = [];
let statementInfo = null; // Statement balance info
let ynabCategories = { map: {}, list: [] }; // Cache of YNAB categories
let ynabPayees = { map: {}, list: [] }; // Cache of YNAB payees
let ynabDataLoaded = false; // Track if we've loaded YNAB data
let duplicatesChecked = false; // Track if we've checked for duplicates
let editMode = false; // Track if edit mode is active (shows checkboxes)

// DOM Elements
const elements = {
    tokenInput: document.getElementById('ynab-token'),
    toggleTokenBtn: document.getElementById('toggle-token'),
    saveTokenBtn: document.getElementById('save-token'),
    connectionStatus: document.getElementById('connection-status'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    fileList: document.getElementById('file-list'),
    previewSection: document.getElementById('preview-section'),
    previewStats: document.getElementById('preview-stats'),
    transactionsBody: document.getElementById('transactions-body'),
    clearBtn: document.getElementById('clear-btn'),
    checkYnabBtn: document.getElementById('check-ynab-btn'),
    importBtn: document.getElementById('import-btn'),
    resultSection: document.getElementById('result-section'),
    resultCard: document.getElementById('result-card'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    themeToggle: document.getElementById('theme-toggle')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Initialize theme
    initializeTheme();

    // Load saved token
    const savedToken = YNAB.getToken();
    if (savedToken) {
        elements.tokenInput.value = savedToken;
        testConnection();
    }

    // Setup event listeners
    setupEventListeners();
}

// Theme Management
function initializeTheme() {
    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('maybank2ynab_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        setTheme(savedTheme);
    } else if (systemPrefersDark) {
        setTheme('dark');
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('maybank2ynab_theme', theme);
    // Update theme toggle button icons
    const moonIcon = elements.themeToggle.querySelector('.icon-moon');
    const sunIcon = elements.themeToggle.querySelector('.icon-sun');
    if (moonIcon && sunIcon) {
        moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
        sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Edit Mode Management
function toggleEditMode() {
    editMode = !editMode;
    renderPreview();
}

function handleCheckboxChange(e) {
    const index = parseInt(e.target.dataset.index);
    if (index >= 0 && index < parsedTransactions.length) {
        parsedTransactions[index].isSelected = e.target.checked;
        updateButtons();
    }
}

function selectAllTransactions() {
    for (const t of parsedTransactions) {
        if (!t.isDuplicate) { // Don't select duplicates
            t.isSelected = true;
        }
    }
    renderPreview();
}

function deselectAllTransactions() {
    for (const t of parsedTransactions) {
        t.isSelected = false;
    }
    renderPreview();
}

function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Token management
    elements.toggleTokenBtn.addEventListener('click', toggleTokenVisibility);
    elements.saveTokenBtn.addEventListener('click', saveToken);
    elements.tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveToken();
    });

    // File upload
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Actions
    elements.clearBtn.addEventListener('click', clearAll);
    elements.checkYnabBtn.addEventListener('click', checkForDuplicates);
    elements.importBtn.addEventListener('click', importToYNAB);
}

// Token Management
function toggleTokenVisibility() {
    const type = elements.tokenInput.type === 'password' ? 'text' : 'password';
    elements.tokenInput.type = type;
    // Toggle eye icons
    const eyeIcon = elements.toggleTokenBtn.querySelector('.icon-eye');
    const eyeOffIcon = elements.toggleTokenBtn.querySelector('.icon-eye-off');
    if (eyeIcon && eyeOffIcon) {
        eyeIcon.style.display = type === 'password' ? 'block' : 'none';
        eyeOffIcon.style.display = type === 'password' ? 'none' : 'block';
    }
}

async function saveToken() {
    const token = elements.tokenInput.value.trim();
    if (!token) {
        showStatus('Please enter your YNAB API token', 'error');
        return;
    }

    YNAB.setToken(token);
    await testConnection();
}

async function testConnection() {
    showStatus('Connecting to YNAB...', 'info');

    try {
        const result = await YNAB.testConnection();
        showStatus(
            `Connected! Budget: ${result.budgetName} | Account: ${result.accountName} (RM ${result.accountBalance.toFixed(2)})`,
            'success'
        );

        // Load categories and payees in background for dropdowns
        loadYnabData();

        // Update buttons now that we're connected
        updateButtons();
    } catch (error) {
        showStatus(`Connection failed: ${error.message}`, 'error');
    }
}

/**
 * Load YNAB categories and payees for dropdowns
 */
async function loadYnabData() {
    if (ynabDataLoaded) return;

    try {
        // Load categories and payees in parallel
        const [categories, payees] = await Promise.all([
            YNAB.getCategories(),
            YNAB.getPayees()
        ]);

        ynabCategories = categories;
        ynabPayees = payees;
        ynabDataLoaded = true;

        console.log(`Loaded ${ynabCategories.list.length} categories, ${ynabPayees.list.length} payees`);
    } catch (error) {
        console.error('Error loading YNAB data:', error);
    }
}

function showStatus(message, type) {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = `connection-status ${type}`;
    elements.connectionStatus.style.display = 'block';
}

// File Upload Handling
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');

    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) {
        alert('Please drop PDF files only');
        return;
    }

    addFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    e.target.value = ''; // Reset input
}

function addFiles(files) {
    uploadedFiles = uploadedFiles.concat(files);
    renderFileList();
    parseUploadedFiles();
}

function renderFileList() {
    elements.fileList.innerHTML = uploadedFiles.map((file, index) => `
        <div class="file-item">
            <span class="file-name">${ICONS.file} ${file.name}</span>
            <button class="remove-btn" onclick="removeFile(${index})">${ICONS.close}</button>
        </div>
    `).join('');
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderFileList();
    if (uploadedFiles.length > 0) {
        parseUploadedFiles();
    } else {
        clearAll();
    }
}

// PDF Parsing
async function parseUploadedFiles() {
    if (uploadedFiles.length === 0) return;

    showLoading('Parsing PDF files...');

    try {
        const result = await PDFParser.parseMultiplePDFs(uploadedFiles);
        parsedTransactions = result.transactions;
        statementInfo = result.statementInfo;
        duplicatesChecked = false; // Reset duplicate check
        renderPreview();
    } catch (error) {
        alert(`Error parsing PDFs: ${error.message}`);
        console.error(error);
    } finally {
        hideLoading();
    }
}

function renderPreview() {
    if (parsedTransactions.length === 0) {
        elements.previewSection.style.display = 'none';
        return;
    }

    // Calculate stats - use isSelected for import count
    const selectedTransactions = parsedTransactions.filter(t => t.isSelected);
    const duplicateTransactions = parsedTransactions.filter(t => t.isDuplicate);
    const internalTransactions = parsedTransactions.filter(t => t.isInternalTransfer);
    const preAuthTransactions = parsedTransactions.filter(t => t.isPreAuth || t.isPreAuthRefund);
    const importableTransactions = parsedTransactions.filter(t => !t.isDuplicate && !t.isInternalTransfer && !t.isPreAuth && !t.isPreAuthRefund);
    const unmatchedTransactions = importableTransactions.filter(t => t.isUnmatched);

    const totalInflow = importableTransactions
        .filter(t => t.isInflow)
        .reduce((sum, t) => sum + t.amount, 0);

    const totalOutflow = importableTransactions
        .filter(t => !t.isInflow)
        .reduce((sum, t) => sum + t.amount, 0);

    let statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${parsedTransactions.length}</div>
            <div class="stat-label">Total</div>
        </div>
        <div class="stat-card stat-selected">
            <div class="stat-value">${selectedTransactions.length}</div>
            <div class="stat-label">To Import</div>
        </div>
    `;

    if (duplicateTransactions.length > 0) {
        statsHtml += `
            <div class="stat-card">
                <div class="stat-value">${duplicateTransactions.length}</div>
                <div class="stat-label">In YNAB</div>
            </div>
        `;
    }
    if (internalTransactions.length > 0) {
        statsHtml += `
            <div class="stat-card stat-internal">
                <div class="stat-value">${internalTransactions.length}</div>
                <div class="stat-label">Internal</div>
            </div>
        `;
    }
    if (preAuthTransactions.length > 0) {
        statsHtml += `
            <div class="stat-card stat-preauth">
                <div class="stat-value">${preAuthTransactions.length}</div>
                <div class="stat-label">Pre-Auth</div>
            </div>
        `;
    }

    // Show unmatched count if any
    if (unmatchedTransactions.length > 0) {
        statsHtml += `
            <div class="stat-card stat-warning">
                <div class="stat-value">${unmatchedTransactions.length}</div>
                <div class="stat-label">Need Review</div>
            </div>
        `;
    }

    statsHtml += `
        <div class="stat-card stat-inflow">
            <div class="stat-amount">
                <span class="amount-sign">+</span>
                <span class="amount-value">${formatAmount(totalInflow)}</span>
            </div>
            <div class="stat-label">Inflow</div>
        </div>
        <div class="stat-card stat-outflow">
            <div class="stat-amount">
                <span class="amount-sign">-</span>
                <span class="amount-value">${formatAmount(totalOutflow)}</span>
            </div>
            <div class="stat-label">Outflow</div>
        </div>
    `;

    // Add edit mode toggle and select all buttons
    statsHtml += `
        <div class="edit-mode-controls">
            <button class="btn-edit-mode" onclick="toggleEditMode()">
                ${editMode ? 'Done' : 'Edit'}
            </button>
            ${editMode ? `
                <button class="btn-select-all" onclick="selectAllTransactions()">Select All</button>
                <button class="btn-select-all" onclick="deselectAllTransactions()">Deselect All</button>
            ` : ''}
        </div>
    `;

    elements.previewStats.innerHTML = statsHtml;

    // Identify unique accounts from transactions (using filename pattern like "M2U CA 405647")
    const accountIds = [...new Set(parsedTransactions.map(t => {
        const fileMatch = t.sourceFile?.match(/(\d{6})/);
        return fileMatch ? fileMatch[1] : null;
    }).filter(a => a !== null))];

    // Map account IDs to friendly names
    const accountNames = {};
    accountIds.forEach((acct, idx) => {
        if (idx === 0) accountNames[acct] = 'Zest';
        else if (idx === 1) accountNames[acct] = 'MAE';
        else accountNames[acct] = `Acct ${idx + 1}`;
    });

    // Assign account ID to each transaction
    for (const t of parsedTransactions) {
        const fileMatch = t.sourceFile?.match(/(\d{6})/);
        t.accountId = fileMatch ? fileMatch[1] : null;
    }

    // Calculate running balance per account
    // Each account's column shows its pdfBalance when updated, keeps previous value otherwise
    const runningBalances = {};
    accountIds.forEach(acct => { runningBalances[acct] = null; });

    for (const t of parsedTransactions) {
        // Update the balance for THIS transaction's account using pdfBalance
        if (t.accountId && t.pdfBalance !== null && t.pdfBalance !== undefined) {
            runningBalances[t.accountId] = t.pdfBalance;
        }
        // Store snapshot of all balances at this point
        t.accountBalances = { ...runningBalances };
    }

    // Store for rendering
    window.currentAccountIds = accountIds;
    window.accountNames = accountNames;

    // Update table headers with per-account balance columns
    const tableHead = document.querySelector('#transactions-table thead tr');
    const balanceHeaders = accountIds.map(acct => `<th>${accountNames[acct]}</th>`).join('');
    const ynabBalHeader = duplicatesChecked ? '<th>YNAB</th>' : '';
    const checkboxHeader = editMode ? '<th class="checkbox-col"></th>' : '';
    tableHead.innerHTML = `
        ${checkboxHeader}
        <th></th>
        <th>Date</th>
        <th>Payee</th>
        <th>Category</th>
        <th>Memo</th>
        <th>Amount</th>
        ${balanceHeaders}
        ${ynabBalHeader}
    `;

    // Calculate YNAB projected balance (only if duplicates checked)
    let ynabRunningBalance = YNAB.getAccountBalance();
    if (duplicatesChecked) {
        for (const t of parsedTransactions) {
            if (t.isDuplicate || t.isInternalTransfer || t.isPreAuth) {
                t.projectedYnabBalance = null; // Won't be imported
            } else {
                if (t.isInflow) {
                    ynabRunningBalance += t.amount;
                } else {
                    ynabRunningBalance -= t.amount;
                }
                t.projectedYnabBalance = Math.round(ynabRunningBalance * 100) / 100;
            }
        }
    }

    // Render transactions table with editable fields and balance columns
    elements.transactionsBody.innerHTML = parsedTransactions.map((t, index) => {
        // Determine row classes
        let rowClasses = [];
        if (t.isDuplicate) rowClasses.push('duplicate-row');
        if (t.isInternalTransfer) rowClasses.push('internal-row');
        if (t.isPreAuth || t.isPreAuthRefund) rowClasses.push('preauth-row');
        if (t.isUnmatched && !t.isDuplicate && !t.isInternalTransfer && !t.isPreAuth && !t.isPreAuthRefund) rowClasses.push('unmatched-row');
        if (!t.isSelected) rowClasses.push('excluded-row');

        // Balance columns - one for each account
        let balanceColumnsHtml = '';
        if (t.accountBalances && window.currentAccountIds) {
            for (const acct of window.currentAccountIds) {
                const bal = t.accountBalances[acct];
                const isThisAccount = t.accountId === acct;
                const hasBalance = bal !== null && bal !== undefined;
                balanceColumnsHtml += hasBalance
                    ? `<td class="balance-cell ${isThisAccount ? 'balance-active' : 'balance-inactive'}">${bal.toFixed(2)}</td>`
                    : `<td class="balance-cell">-</td>`;
            }
        }

        const ynabBalHtml = duplicatesChecked
            ? (t.projectedYnabBalance !== null
                ? `<td class="balance-cell">${t.projectedYnabBalance.toFixed(2)}</td>`
                : `<td class="balance-cell">-</td>`)
            : '';

        // Checkbox column (only in edit mode)
        const checkboxHtml = editMode
            ? `<td class="checkbox-cell">
                <input type="checkbox" class="transaction-checkbox"
                    data-index="${index}"
                    ${t.isSelected ? 'checked' : ''}
                    ${t.isDuplicate ? 'disabled' : ''}>
               </td>`
            : '';

        return `
        <tr class="${rowClasses.join(' ')}" data-index="${index}">
            ${checkboxHtml}
            <td class="info-cell">
                <span class="info-icon" data-index="${index}" title="${t.excludeReason ? escapeHtml(t.excludeReason) : ''}">${ICONS.info}</span>
                <div class="info-tooltip" id="tooltip-${index}">${formatTooltipTable(t)}</div>
            </td>
            <td>${formatDate(t.date)}</td>
            <td>
                <input type="text" class="editable-field"
                    value="${escapeHtml(t.payeeName)}"
                    data-field="payeeName"
                    data-index="${index}"
                    placeholder="Payee"
                    list="payee-list"
                    ${t.isDuplicate ? 'disabled' : ''}>
            </td>
            <td>
                <input type="text" class="editable-field"
                    value="${escapeHtml(t.category || '')}"
                    data-field="category"
                    data-index="${index}"
                    placeholder="Category"
                    list="category-list"
                    ${t.isDuplicate ? 'disabled' : ''}>
            </td>
            <td>
                <input type="text" class="editable-field"
                    value="${escapeHtml(t.memo || '')}"
                    data-field="memo"
                    data-index="${index}"
                    placeholder="Memo"
                    ${t.isDuplicate ? 'disabled' : ''}>
            </td>
            <td class="${t.isInflow ? 'amount-inflow' : 'amount-outflow'}">
                ${t.isInflow ? '+' : '-'}${t.amount.toFixed(2)}
            </td>
            ${balanceColumnsHtml}
            ${ynabBalHtml}
        </tr>
        `;
    }).join('');

    // Add datalists for autocomplete
    // Category datalist
    let categoryDatalistHtml = '<datalist id="category-list">';
    ynabCategories.list.forEach(cat => {
        categoryDatalistHtml += `<option value="${escapeHtml(cat.name)}">`;
    });
    categoryDatalistHtml += '</datalist>';

    // Payee datalist - includes both YNAB payees and payees from current transactions
    const allPayees = new Set();
    ynabPayees.list.forEach(p => allPayees.add(p.name));
    parsedTransactions.forEach(t => {
        if (t.payeeName) allPayees.add(t.payeeName);
    });
    let payeeDatalistHtml = '<datalist id="payee-list">';
    [...allPayees].sort().forEach(payee => {
        payeeDatalistHtml += `<option value="${escapeHtml(payee)}">`;
    });
    payeeDatalistHtml += '</datalist>';

    // Add datalists to the page
    let existingCategoryDatalist = document.getElementById('category-list');
    if (existingCategoryDatalist) {
        existingCategoryDatalist.outerHTML = categoryDatalistHtml;
    } else {
        elements.transactionsBody.insertAdjacentHTML('afterend', categoryDatalistHtml);
    }

    let existingPayeeDatalist = document.getElementById('payee-list');
    if (existingPayeeDatalist) {
        existingPayeeDatalist.outerHTML = payeeDatalistHtml;
    } else {
        elements.transactionsBody.insertAdjacentHTML('afterend', payeeDatalistHtml);
    }

    // Add event listeners for editable fields
    document.querySelectorAll('.editable-field').forEach(input => {
        input.addEventListener('change', handleFieldEdit);
    });

    // Add event listeners for checkboxes (edit mode)
    document.querySelectorAll('.transaction-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Show balance summary if we have statement info
    renderBalanceSummary();

    elements.previewSection.style.display = 'block';
    elements.resultSection.style.display = 'none';

    // Update buttons
    updateButtons();
}

/**
 * Render balance summary section
 */
function renderBalanceSummary() {
    // Remove existing summary if any
    const existingSummary = document.querySelector('.balance-summary');
    if (existingSummary) existingSummary.remove();

    if (!statementInfo || statementInfo.endingBalance === 0) return;

    const ynabBalance = YNAB.getAccountBalance();
    const stmtEndingBalance = statementInfo.endingBalance;

    // Calculate what YNAB balance should be after importing new transactions
    let projectedFinalBalance = ynabBalance;
    for (const t of parsedTransactions) {
        if (!t.isDuplicate) {
            if (t.isInflow) {
                projectedFinalBalance += t.amount;
            } else {
                projectedFinalBalance -= t.amount;
            }
        }
    }
    projectedFinalBalance = Math.round(projectedFinalBalance * 100) / 100;

    const balanceMatch = Math.abs(projectedFinalBalance - stmtEndingBalance) < 0.01;
    const balanceDiff = Math.round((projectedFinalBalance - stmtEndingBalance) * 100) / 100;

    const summaryHtml = `
        <div class="balance-summary ${balanceMatch ? 'balance-match' : 'balance-mismatch-summary'}">
            <div class="balance-item">
                <span class="balance-label">Statement Ending:</span>
                <span class="balance-value">RM ${stmtEndingBalance.toFixed(2)}</span>
            </div>
            <div class="balance-item">
                <span class="balance-label">YNAB After Import:</span>
                <span class="balance-value">RM ${projectedFinalBalance.toFixed(2)}</span>
            </div>
            ${balanceMatch
                ? '<div class="balance-status balance-ok">Balances match</div>'
                : `<div class="balance-status balance-warning">Mismatch: RM ${balanceDiff.toFixed(2)}</div>`
            }
        </div>
    `;

    // Insert after stats
    elements.previewStats.insertAdjacentHTML('afterend', summaryHtml);
}

function handleFieldEdit(e) {
    const index = parseInt(e.target.dataset.index);
    const field = e.target.dataset.field;
    const value = e.target.value.trim();

    if (index >= 0 && index < parsedTransactions.length) {
        const transaction = parsedTransactions[index];
        const oldValue = transaction[field];
        transaction[field] = value;

        // If payee was changed, save the learned description -> payee mapping
        if (field === 'payeeName' && value && value !== oldValue) {
            // Save mapping: bank description -> user's chosen payee name
            if (transaction.rawDescription) {
                PayeeMappings.saveLearnedPayeeMapping(transaction.rawDescription, value);
            }

            // Mark as no longer unmatched since user explicitly set the payee
            if (transaction.isUnmatched) {
                transaction.isUnmatched = false;
                const row = e.target.closest('tr');
                if (row) {
                    row.classList.remove('unmatched-row');
                }
                updateStats();
            }
        }

        // If category was changed, save the learned mapping
        if (field === 'category' && value && value !== oldValue) {
            PayeeMappings.saveLearnedMapping(transaction.payeeName, value);

            // Mark as no longer unmatched if category is now set
            if (transaction.isUnmatched && value) {
                transaction.isUnmatched = false;
                // Update the row styling
                const row = e.target.closest('tr');
                if (row) {
                    row.classList.remove('unmatched-row');
                }
                // Update stats
                updateStats();
            }
        }
    }
}

/**
 * Update stats display without full re-render
 */
function updateStats() {
    const importableTransactions = parsedTransactions.filter(t => !t.isDuplicate && !t.isInternalTransfer);
    const unmatchedTransactions = importableTransactions.filter(t => t.isUnmatched);

    // Find the "Need Review" stat card and update it
    const warningCard = document.querySelector('.stat-warning');
    if (warningCard && unmatchedTransactions.length > 0) {
        warningCard.querySelector('.stat-value').textContent = unmatchedTransactions.length;
    } else if (warningCard && unmatchedTransactions.length === 0) {
        warningCard.remove();
    }
}

function updateButtons() {
    const hasToken = !!YNAB.getToken();
    // Only count selected transactions
    const selectedTransactions = parsedTransactions.filter(t => t.isSelected);
    const count = selectedTransactions.length;

    // Check YNAB button
    elements.checkYnabBtn.disabled = !hasToken || parsedTransactions.length === 0;

    // Import button
    elements.importBtn.disabled = !hasToken || count === 0;
    elements.importBtn.textContent = count > 0
        ? `Import ${count} transaction${count !== 1 ? 's' : ''} to YNAB`
        : 'No transactions selected';
}

// Check for duplicates in YNAB
async function checkForDuplicates() {
    if (!YNAB.getToken()) {
        alert('Please save your YNAB API token first');
        return;
    }

    if (parsedTransactions.length === 0) {
        return;
    }

    showLoading('Checking YNAB for duplicates...');

    try {
        // Find date range of transactions
        const dates = parsedTransactions.map(t => t.date).sort();
        const sinceDate = dates[0];

        // Fetch existing YNAB transactions
        const ynabTransactions = await YNAB.getRecentTransactions(sinceDate);

        // Create lookup map: date+amount -> list of transactions
        const ynabLookup = {};
        for (const yt of ynabTransactions) {
            const key = `${yt.date}:${yt.amount}`;
            if (!ynabLookup[key]) {
                ynabLookup[key] = [];
            }
            ynabLookup[key].push(yt);
        }

        // Mark duplicates
        let duplicatesFound = 0;
        for (const t of parsedTransactions) {
            // Check exact match first
            const exactKey = `${t.date}:${t.milliunits}`;
            if (ynabLookup[exactKey]) {
                t.isDuplicate = true;
                t.matchedYnabTransaction = ynabLookup[exactKey][0];
                duplicatesFound++;
                continue;
            }

            // Check +/- 1 day tolerance
            const dateObj = new Date(t.date);
            for (const dayOffset of [-1, 1]) {
                const checkDate = new Date(dateObj);
                checkDate.setDate(checkDate.getDate() + dayOffset);
                const checkKey = `${checkDate.toISOString().split('T')[0]}:${t.milliunits}`;
                if (ynabLookup[checkKey]) {
                    t.isDuplicate = true;
                    t.matchedYnabTransaction = ynabLookup[checkKey][0];
                    duplicatesFound++;
                    break;
                }
            }
        }

        // Mark that we've checked for duplicates
        duplicatesChecked = true;

        // Re-render preview with duplicate highlighting and YNAB balance column
        renderPreview();

        if (duplicatesFound > 0) {
            showStatus(`Found ${duplicatesFound} transactions already in YNAB`, 'info');
        } else {
            showStatus('No duplicates found - all transactions are new', 'success');
        }

    } catch (error) {
        showStatus(`Error checking duplicates: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Import to YNAB
async function importToYNAB() {
    if (!YNAB.getToken()) {
        alert('Please save your YNAB API token first');
        return;
    }

    // Only import selected transactions
    const transactionsToImport = parsedTransactions.filter(t => t.isSelected);

    if (transactionsToImport.length === 0) {
        alert('No transactions selected for import');
        return;
    }

    showLoading(`Importing ${transactionsToImport.length} transactions to YNAB...`);

    try {
        const result = await YNAB.createTransactions(transactionsToImport);

        // Mark successfully imported transactions as duplicates (already in YNAB)
        if (result.created > 0 || result.duplicates > 0) {
            for (const t of transactionsToImport) {
                t.isDuplicate = true;
                t.isSelected = false;
            }
            // Re-render to show updated state
            renderPreview();
        }

        showResult(result);
    } catch (error) {
        showResult({
            created: 0,
            duplicates: 0,
            errors: [{ error: error.message }]
        });
    } finally {
        hideLoading();
    }
}

function showResult(result) {
    const isSuccess = result.errors.length === 0;

    const checkIconSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const skipIconSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>`;
    const errorIconSmall = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

    let html = `
        <div class="result-icon">${isSuccess ? ICONS.check : ICONS.warning}</div>
        <div class="result-title">${isSuccess ? 'Import Complete!' : 'Import Completed with Errors'}</div>
        <div class="result-details">
    `;

    if (result.created > 0) {
        html += `<p>${checkIconSmall} ${result.created} transactions imported</p>`;
    }

    if (result.duplicates > 0) {
        html += `<p>${skipIconSmall} ${result.duplicates} duplicates skipped</p>`;
    }

    if (result.errors.length > 0) {
        html += `<p>${errorIconSmall} ${result.errors.length} errors</p>`;
        result.errors.forEach(err => {
            html += `<p class="error-detail">${escapeHtml(err.error)}</p>`;
        });
    }

    html += '</div>';

    elements.resultCard.innerHTML = html;
    elements.resultCard.className = `result-card ${isSuccess ? 'success' : 'error'}`;
    elements.resultSection.style.display = 'block';
}

// Clear all
function clearAll() {
    uploadedFiles = [];
    parsedTransactions = [];
    statementInfo = null;
    duplicatesChecked = false;
    elements.fileList.innerHTML = '';
    elements.previewSection.style.display = 'none';
    elements.resultSection.style.display = 'none';

    // Remove balance summary if exists
    const existingSummary = document.querySelector('.balance-summary');
    if (existingSummary) existingSummary.remove();
}

// Utility functions
function showLoading(text) {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Format amount with thousand separators for display
 */
function formatAmount(amount) {
    return amount.toLocaleString('en-MY', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Format tooltip content as a table-like layout
 */
function formatTooltipTable(t) {
    const date = formatDate(t.date);
    const desc = escapeHtml(t.rawDescription || '');
    const amount = `${t.amount.toFixed(2)}${t.isInflow ? '+' : '-'}`;
    const balance = t.pdfBalance !== null ? t.pdfBalance.toFixed(2) : '-';

    // Split description into lines for better display (max ~40 chars per line)
    const descLines = [];
    const words = desc.split(' ');
    let currentLine = '';
    for (const word of words) {
        if (currentLine.length + word.length + 1 > 40) {
            descLines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
    }
    if (currentLine) descLines.push(currentLine);

    // Build table-like format
    let result = '';
    result += `Date:        ${date}\n`;
    result += `─────────────────────────────────────────────\n`;
    result += `Description: ${descLines[0] || ''}\n`;
    for (let i = 1; i < descLines.length; i++) {
        result += `             ${descLines[i]}\n`;
    }
    result += `─────────────────────────────────────────────\n`;
    result += `Amount:      ${amount.padStart(12)}\n`;
    result += `Balance:     ${balance.padStart(12)}`;

    return result;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// Make functions available globally
window.removeFile = removeFile;
window.toggleEditMode = toggleEditMode;
window.selectAllTransactions = selectAllTransactions;
window.deselectAllTransactions = deselectAllTransactions;
