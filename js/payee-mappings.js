/**
 * Payee Mappings
 * Maps bank transaction descriptions to clean payee names
 *
 * Pattern format: Bank description patterns (case-insensitive, supports wildcards)
 * Each mapping includes: payeeName and optional defaultCategory
 *
 * Learning system: User-set categories are saved to localStorage and take priority
 */

const LEARNED_MAPPINGS_KEY = 'maybank2ynab_learned_mappings';
const LEARNED_PAYEES_KEY = 'maybank2ynab_learned_payees'; // bank description -> payee name

/**
 * Get learned payee-to-category mappings from localStorage
 */
function getLearnedMappings() {
    try {
        const stored = localStorage.getItem(LEARNED_MAPPINGS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error reading learned mappings:', e);
        return {};
    }
}

/**
 * Get learned bank description -> payee mappings from localStorage
 */
function getLearnedPayeeMappings() {
    try {
        const stored = localStorage.getItem(LEARNED_PAYEES_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error reading learned payee mappings:', e);
        return {};
    }
}

/**
 * Save a learned bank description -> payee mapping
 * @param {string} bankDescription - The raw bank description
 * @param {string} payeeName - The payee name user chose
 */
function saveLearnedPayeeMapping(bankDescription, payeeName) {
    if (!bankDescription || !payeeName) return;

    const mappings = getLearnedPayeeMappings();
    // Create a normalized key from the bank description
    const key = normalizeDescriptionKey(bankDescription);

    mappings[key] = {
        payeeName: payeeName.trim(),
        originalDescription: bankDescription,
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(LEARNED_PAYEES_KEY, JSON.stringify(mappings));
        console.log(`Saved learned payee: "${bankDescription.substring(0, 40)}..." -> ${payeeName}`);
    } catch (e) {
        console.error('Error saving learned payee mapping:', e);
    }
}

/**
 * Get learned payee for a bank description (if exists)
 * @param {string} bankDescription - The raw bank description
 * @returns {string|null} - The learned payee name or null
 */
function getLearnedPayee(bankDescription) {
    if (!bankDescription) return null;

    const mappings = getLearnedPayeeMappings();
    const key = normalizeDescriptionKey(bankDescription);
    const learned = mappings[key];

    return learned ? learned.payeeName : null;
}

/**
 * Normalize bank description to create a consistent lookup key
 * Removes variable parts like reference numbers, dates, etc.
 */
function normalizeDescriptionKey(description) {
    if (!description) return '';

    return description
        .toUpperCase()
        .replace(/T\d{8,}/g, '') // Remove transaction IDs like T055492691519
        .replace(/\d{10,}/g, '') // Remove long numbers
        .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // Remove dates
        .replace(/QR\d+/gi, '') // Remove QR codes
        .replace(/[*\-.,]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Save a learned payee-to-category mapping
 * @param {string} payeeName - The payee name (will be lowercased for lookup)
 * @param {string} category - The category to associate
 */
function saveLearnedMapping(payeeName, category) {
    if (!payeeName) return;

    const mappings = getLearnedMappings();
    const key = payeeName.toLowerCase().trim();

    if (category && category.trim()) {
        mappings[key] = {
            category: category.trim(),
            updatedAt: new Date().toISOString()
        };
    } else {
        // Remove mapping if category is empty
        delete mappings[key];
    }

    try {
        localStorage.setItem(LEARNED_MAPPINGS_KEY, JSON.stringify(mappings));
        console.log(`Saved learned mapping: ${payeeName} -> ${category}`);
    } catch (e) {
        console.error('Error saving learned mapping:', e);
    }
}

/**
 * Get learned category for a payee (if exists)
 * @param {string} payeeName - The payee name to look up
 * @returns {string|null} - The learned category or null
 */
function getLearnedCategory(payeeName) {
    if (!payeeName) return null;

    const mappings = getLearnedMappings();
    const key = payeeName.toLowerCase().trim();
    const learned = mappings[key];

    return learned ? learned.category : null;
}

/**
 * Clear all learned mappings
 */
function clearLearnedMappings() {
    try {
        localStorage.removeItem(LEARNED_MAPPINGS_KEY);
        console.log('Cleared all learned mappings');
    } catch (e) {
        console.error('Error clearing learned mappings:', e);
    }
}

// Category hints from memo/reference keywords
const MEMO_CATEGORY_HINTS = {
    // Transport
    'transport': 'Social Transport / Taxi',
    'taxi': 'Social Transport / Taxi',
    'grab': 'Social Transport / Taxi',
    'uber': 'Social Transport / Taxi',
    'lrt': 'Social Transport / Taxi',
    'mrt': 'Social Transport / Taxi',
    'bus': 'Social Transport / Taxi',

    // Food
    'food': 'Treats / Restaurants',
    'lunch': 'Treats / Restaurants',
    'dinner': 'Treats / Restaurants',
    'breakfast': 'Treats / Restaurants',
    'makan': 'Treats / Restaurants',

    // Rent
    'rent': 'Renting',
    'rental': 'Renting',
    'sewa': 'Renting',

    // Utilities
    'electric': 'Electricity',
    'water': 'Water',
    'internet': 'Internet',
    'wifi': 'Internet',

    // Groceries
    'groceries': 'Groceries',
    'grocery': 'Groceries',
};

/**
 * Get category hint from memo text
 * @param {string} memo - The memo/reference text
 * @returns {string|null} - Suggested category or null
 */
function getCategoryFromMemo(memo) {
    if (!memo) return null;

    const lowerMemo = memo.toLowerCase();

    for (const [keyword, category] of Object.entries(MEMO_CATEGORY_HINTS)) {
        if (lowerMemo.includes(keyword)) {
            return category;
        }
    }

    return null;
}

const PAYEE_MAPPINGS = [
    // Groceries
    { pattern: /STAR GROCER/i, payeeName: 'Star Grocer', category: 'Groceries' },
    { pattern: /99 SPEEDMART/i, payeeName: '99 SpeedMart', category: 'Groceries' },
    { pattern: /JAYA GROCER/i, payeeName: 'Jaya Grocer', category: 'Groceries' },
    { pattern: /KEN'?S GROCER/i, payeeName: "Ken's Grocer", category: 'Groceries' },
    { pattern: /KK SUPER MART/i, payeeName: 'KK Super Mart', category: 'Groceries' },
    { pattern: /BAKEZ GROCER/i, payeeName: 'Bakez Grocer', category: 'Groceries' },

    // Online Shopping
    { pattern: /SHOPEE/i, payeeName: 'Shopee', category: null }, // Category varies
    { pattern: /SHEIN/i, payeeName: 'Shein', category: 'Cosmetics' },
    { pattern: /LAZADA/i, payeeName: 'Lazada', category: null },

    // Bills & Utilities
    { pattern: /TENAGA NASIONAL/i, payeeName: 'Tenaga Nasional Berhad', category: 'Electricity' },
    { pattern: /UNIFI|MYUNIFI/i, payeeName: 'MyUnifi', category: 'Internet' },
    // Phone
    { pattern: /YOODO/i, payeeName: 'Yoodo', category: 'Phone' },
    { pattern: /UMOBILE/i, payeeName: 'U Mobile', category: 'Phone' },
    { pattern: /U MO\b/i, payeeName: 'U Mo', category: 'Phone' },

    // Subscriptions
    { pattern: /NAME-?CHEAP/i, payeeName: 'Namecheap', category: 'Needs Subscriptions' },
    { pattern: /OPENAI.*CHATGPT/i, payeeName: 'Chat GPT', category: 'Needs Subscriptions' },
    { pattern: /ANTHROPIC|CLAUDE/i, payeeName: 'Claude', category: 'Needs Subscriptions' },

    // Streaming
    { pattern: /YOUTUBE/i, payeeName: 'Youtube Premium', category: 'TV streaming' },
    { pattern: /NETFLIX/i, payeeName: 'Netflix', category: 'TV streaming' },
    { pattern: /SPOTIFY/i, payeeName: 'Spotify', category: 'TV streaming' },

    // Food & Restaurants
    { pattern: /BURGER KING/i, payeeName: 'Burger King', category: 'Treats / Restaurants' },
    { pattern: /SUBWAY/i, payeeName: 'Subway', category: 'Treats / Restaurants' },
    { pattern: /MIXUE/i, payeeName: 'Mixue', category: 'Treats / Restaurants' },
    { pattern: /7-?ELEVEN/i, payeeName: '7-eleven', category: 'Treats / Restaurants' },
    { pattern: /ECO-?SHOP/i, payeeName: 'Eco-shop', category: 'Treats / Restaurants' },

    // Gas Stations
    { pattern: /SHELL/i, payeeName: 'Shell', category: 'Gas' },
    { pattern: /PETRONAS/i, payeeName: 'Petronas', category: 'Gas' },

    // Health & Pharmacy
    { pattern: /HEALTH LANE/i, payeeName: 'Health Lane-Neo', category: 'Pharmacy' },
    { pattern: /GUARDIAN/i, payeeName: 'Guardian', category: 'Cosmetics' },
    { pattern: /POLIKLINIK CAHAYA/i, payeeName: 'Poliklinik Cahaya', category: 'Clinic' },
    { pattern: /SUNWAY MEDICAL/i, payeeName: 'Sunway Medical', category: 'Clinic' },
    { pattern: /QUALITAS/i, payeeName: 'Qualitas', category: 'Clinic' },

    // Pets
    { pattern: /DACO PETSMART/i, payeeName: 'Daco Petsmart', category: 'Pet food' },
    { pattern: /COO.?RIKU/i, payeeName: 'Coo&Riku', category: 'Pet food' },

    // Household
    { pattern: /MR DIY/i, payeeName: 'Mr DIY', category: 'Household Supplies' },

    // Parking & Transport
    { pattern: /PARKING|KLCC PARKING/i, payeeName: 'Parking', category: 'Parking' },
    { pattern: /RAPID RAIL/i, payeeName: 'TnG Student Leksi', category: 'Social Transport / Taxi' },

    // Gaming
    { pattern: /STEAM/i, payeeName: 'Steam', category: 'Hobbies' },

    // Bank
    { pattern: /DIVIDEND PAID/i, payeeName: 'Maybank', category: null },
    { pattern: /FPX REFUND/i, payeeName: 'FPX Refund', category: null },
];

/**
 * Find matching payee for a bank description
 * @param {string} description - Bank transaction description
 * @returns {object} - { payeeName, category } or null if no match
 */
function findPayeeMapping(description) {
    if (!description) return null;

    const upperDesc = description.toUpperCase();

    for (const mapping of PAYEE_MAPPINGS) {
        if (mapping.pattern.test(upperDesc)) {
            return {
                payeeName: mapping.payeeName,
                category: mapping.category
            };
        }
    }

    return null;
}

/**
 * Clean and extract merchant name from bank description
 * Used when no mapping is found - NEVER returns "Unknown"
 * @param {string} description - Raw bank description
 * @returns {string} - Cleaned merchant name (always something meaningful)
 */
function cleanMerchantName(description) {
    if (!description) return 'Bank Transaction';

    // Extract transaction type before removing it (use as fallback)
    let transactionType = null;
    const typeMatch = description.match(/^(SALE DEBIT|PAYMENT FR A\/C|TRANSFER FR A\/C|TRANSFER TO A\/C|PRE-AUTH DEBIT|PRE-AUTH REFUND|FPX REFUND BUYER)/i);
    if (typeMatch) {
        // Clean up transaction type for fallback use
        transactionType = typeMatch[1]
            .replace(/FR A\/C/i, '')
            .replace(/TO A\/C/i, '')
            .replace(/BUYER/i, '')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    // Remove common prefixes
    let cleaned = description
        .replace(/^(SALE DEBIT|PAYMENT FR A\/C|TRANSFER FR A\/C|TRANSFER TO A\/C|PRE-AUTH DEBIT|PRE-AUTH REFUND|FPX REFUND BUYER)\s*/i, '')
        .trim();

    // Take first line (merchant name is usually on first line)
    const lines = cleaned.split('\n');
    cleaned = lines[0] || cleaned;

    // Remove reference numbers and codes
    cleaned = cleaned
        .replace(/\*$/, '') // Remove trailing asterisk
        .replace(/T\d{12,}/, '') // Remove transaction IDs
        .replace(/\d{10,}/, '') // Remove long numbers
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();

    // Capitalize properly
    if (cleaned.length > 0) {
        cleaned = cleaned.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    // Never return empty or Unknown - use transaction type as fallback
    if (!cleaned || cleaned.length < 2) {
        return transactionType || 'Bank Transaction';
    }

    return cleaned;
}

// Export for use in other modules
window.PayeeMappings = {
    findPayeeMapping,
    cleanMerchantName,
    getLearnedMappings,
    saveLearnedMapping,
    getLearnedCategory,
    clearLearnedMappings,
    getCategoryFromMemo,
    // New: description -> payee learning
    getLearnedPayeeMappings,
    saveLearnedPayeeMapping,
    getLearnedPayee,
    normalizeDescriptionKey,
    PAYEE_MAPPINGS
};
