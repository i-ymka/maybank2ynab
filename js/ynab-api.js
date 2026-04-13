/**
 * YNAB API Client
 * Handles all interactions with the YNAB API
 */

const YNAB_API_BASE = 'https://api.ynab.com/v1';

class YNABClient {
    constructor() {
        this.token = localStorage.getItem('ynab_token') || null;
        this.budgetId = localStorage.getItem('ynab_budget_id') || null;
        this.accountId = localStorage.getItem('ynab_account_id') || null;
        this.budgetName = 'Malaysia'; // Default budget name to find
        this.accountName = 'Maybank'; // Default account name to find
    }

    /**
     * Set and save the API token
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('ynab_token', token);
    }

    /**
     * Get the current token
     */
    getToken() {
        return this.token;
    }

    /**
     * Clear stored credentials
     */
    clearCredentials() {
        this.token = null;
        this.budgetId = null;
        this.accountId = null;
        localStorage.removeItem('ynab_token');
        localStorage.removeItem('ynab_budget_id');
        localStorage.removeItem('ynab_account_id');
    }

    /**
     * Make an authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        if (!this.token) {
            throw new Error('No API token set');
        }

        const url = `${YNAB_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error('Invalid API token. Please check your token and try again.');
            }
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            }
            throw new Error(error.error?.detail || `API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Test the connection and find budget/account
     */
    async testConnection() {
        // Get all budgets
        const budgetsResponse = await this.apiRequest('/budgets');
        const budgets = budgetsResponse.data.budgets;

        if (!budgets || budgets.length === 0) {
            throw new Error('No budgets found in your YNAB account');
        }

        // Find the "Malaysia" budget
        let budget = budgets.find(b => b.name.toLowerCase() === this.budgetName.toLowerCase());
        if (!budget) {
            // Use first budget as fallback
            budget = budgets[0];
            console.warn(`Budget "${this.budgetName}" not found, using "${budget.name}" instead`);
        }

        this.budgetId = budget.id;
        localStorage.setItem('ynab_budget_id', this.budgetId);

        // Get accounts for this budget
        const accountsResponse = await this.apiRequest(`/budgets/${this.budgetId}/accounts`);
        const accounts = accountsResponse.data.accounts;

        // Find the "Maybank" account
        let account = accounts.find(a =>
            a.name.toLowerCase().includes(this.accountName.toLowerCase()) &&
            !a.closed &&
            !a.deleted
        );

        if (!account) {
            // Use first open on-budget account as fallback
            account = accounts.find(a => !a.closed && !a.deleted && a.on_budget);
            if (!account) {
                throw new Error(`Account "${this.accountName}" not found in budget "${budget.name}"`);
            }
            console.warn(`Account "${this.accountName}" not found, using "${account.name}" instead`);
        }

        this.accountId = account.id;
        this.accountBalance = account.balance / 1000; // Store for later use
        localStorage.setItem('ynab_account_id', this.accountId);

        return {
            budgetName: budget.name,
            budgetId: this.budgetId,
            accountName: account.name,
            accountId: this.accountId,
            accountBalance: this.accountBalance
        };
    }

    /**
     * Get categories for the budget
     * Returns both a lookup map and an array for dropdown use
     */
    async getCategories() {
        if (!this.budgetId) {
            await this.testConnection();
        }

        const response = await this.apiRequest(`/budgets/${this.budgetId}/categories`);
        const categoryGroups = response.data.category_groups;

        // Flatten categories into a lookup map and array
        const categoriesMap = {};
        const categoriesList = [];

        for (const group of categoryGroups) {
            // Skip internal categories
            if (group.hidden || group.deleted) continue;

            for (const category of group.categories) {
                if (category.hidden || category.deleted) continue;

                const catObj = {
                    id: category.id,
                    name: category.name,
                    groupName: group.name
                };

                categoriesMap[category.name.toLowerCase()] = catObj;
                categoriesList.push(catObj);
            }
        }

        // Sort alphabetically
        categoriesList.sort((a, b) => a.name.localeCompare(b.name));

        return {
            map: categoriesMap,
            list: categoriesList
        };
    }

    /**
     * Get payees for the budget
     * Returns both a lookup map and an array for dropdown use
     */
    async getPayees() {
        if (!this.budgetId) {
            await this.testConnection();
        }

        const response = await this.apiRequest(`/budgets/${this.budgetId}/payees`);
        const payees = response.data.payees;

        // Create lookup map and array
        const payeesMap = {};
        const payeesList = [];

        for (const payee of payees) {
            // Skip deleted payees and transfer payees
            if (payee.deleted) continue;
            if (payee.transfer_account_id) continue; // Transfer payees

            const payeeObj = {
                id: payee.id,
                name: payee.name
            };

            payeesMap[payee.name.toLowerCase()] = payeeObj;
            payeesList.push(payeeObj);
        }

        // Sort alphabetically
        payeesList.sort((a, b) => a.name.localeCompare(b.name));

        return {
            map: payeesMap,
            list: payeesList
        };
    }

    /**
     * Get current account balance
     */
    getAccountBalance() {
        return this.accountBalance || 0;
    }

    /**
     * Create transactions in YNAB
     * @param {Array} transactions - Array of parsed transactions
     * @returns {object} - { created: number, duplicates: number, errors: Array }
     */
    async createTransactions(transactions) {
        if (!this.budgetId || !this.accountId) {
            await this.testConnection();
        }

        // Get categories for mapping
        const { map: categoriesMap } = await this.getCategories();

        // Prepare transactions for YNAB API
        const ynabTransactions = transactions.map(t => {
            const transaction = {
                account_id: this.accountId,
                date: t.date,
                amount: t.milliunits,
                payee_name: t.payeeName,
                memo: t.memo || null,
                cleared: 'cleared',
                approved: true,
                import_id: t.importId
            };

            // Try to find category
            if (t.category) {
                const categoryKey = t.category.toLowerCase();
                // Try exact match first
                let category = categoriesMap[categoryKey];

                // Try partial match if no exact match
                if (!category) {
                    for (const [name, cat] of Object.entries(categoriesMap)) {
                        if (name.includes(categoryKey) || categoryKey.includes(name)) {
                            category = cat;
                            break;
                        }
                    }
                }

                if (category) {
                    transaction.category_id = category.id;
                }
            }

            return transaction;
        });

        // Send to YNAB API (bulk create)
        try {
            const response = await this.apiRequest(`/budgets/${this.budgetId}/transactions`, {
                method: 'POST',
                body: JSON.stringify({ transactions: ynabTransactions })
            });

            const result = response.data;
            const duplicateIds = result.duplicate_import_ids || [];

            return {
                created: ynabTransactions.length - duplicateIds.length,
                duplicates: duplicateIds.length,
                duplicateIds,
                transactionIds: result.transaction_ids || [],
                errors: []
            };
        } catch (error) {
            // If bulk fails, try one by one to identify problematic transactions
            if (ynabTransactions.length > 1) {
                return await this.createTransactionsOneByOne(ynabTransactions);
            }
            throw error;
        }
    }

    /**
     * Create transactions one by one (fallback for debugging)
     */
    async createTransactionsOneByOne(transactions) {
        let created = 0;
        let duplicates = 0;
        const errors = [];
        const duplicateIds = [];

        for (const transaction of transactions) {
            try {
                const response = await this.apiRequest(`/budgets/${this.budgetId}/transactions`, {
                    method: 'POST',
                    body: JSON.stringify({ transaction })
                });

                const result = response.data;
                if (result.duplicate_import_ids && result.duplicate_import_ids.length > 0) {
                    duplicates++;
                    duplicateIds.push(...result.duplicate_import_ids);
                } else {
                    created++;
                }
            } catch (error) {
                errors.push({
                    transaction,
                    error: error.message
                });
            }
        }

        return { created, duplicates, duplicateIds, errors };
    }

    /**
     * Get recent transactions (for verification)
     */
    async getRecentTransactions(sinceDate = null) {
        if (!this.budgetId || !this.accountId) {
            await this.testConnection();
        }

        let endpoint = `/budgets/${this.budgetId}/accounts/${this.accountId}/transactions`;
        if (sinceDate) {
            endpoint += `?since_date=${sinceDate}`;
        }

        const response = await this.apiRequest(endpoint);
        return response.data.transactions;
    }
}

// Export singleton instance
window.YNAB = new YNABClient();
