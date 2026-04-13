/**
 * Maybank PDF Statement Parser v3
 * Extracts transactions from Maybank PDF statements using pdf.js
 * - Fixed payee extraction (recipient name, not reference)
 * - Skip internal transfers between own accounts
 * - Mark unmatched transactions for review
 */

// Set pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Configuration: Names to identify internal transfers (between your own accounts)
const OWN_ACCOUNT_NAMES = [
    'ALEKSANDRA TARSKAIA',
    'TARSKAIA ALEKSANDRA',
    // Add more variations if needed
];

/**
 * Parse a Maybank PDF statement
 * @param {File} file - PDF file object
 * @returns {Promise<Object>} - { transactions, statementInfo }
 */
async function parseMaybankPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let allText = '';
    let statementDate = null;
    let statementInfo = null;

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join('\n');
        allText += pageText + '\n---PAGE_BREAK---\n';

        // Try to extract statement date and balances from first page
        if (i === 1 && !statementDate) {
            statementDate = extractStatementDate(pageText);
            statementInfo = extractStatementBalances(pageText);
        }
    }

    // Parse transactions from extracted text
    const transactions = parseTransactionText(allText, statementDate, statementInfo);

    return { transactions, statementInfo };
}

/**
 * Extract beginning and ending balance from PDF header
 */
function extractStatementBalances(text) {
    let beginningBalance = null;
    let endingBalance = null;
    let accountNumber = null;

    // Extract account number
    const accountMatch = text.match(/(?:NOMBOR AKAUN|ACCOUNT NUMBER)\s*[:\s]*(\d{12})/i);
    if (accountMatch) {
        accountNumber = accountMatch[1];
    }

    // Extract beginning balance
    // Pattern: "BEGINNING BALANCE" followed by amount
    const beginMatch = text.match(/BEGINNING\s*BALANCE[:\s]*(\d{1,3}(?:,\d{3})*\.\d{2})/i);
    if (beginMatch) {
        beginningBalance = parseFloat(beginMatch[1].replace(/,/g, ''));
    }

    // Extract ending/statement balance
    const endPatterns = [
        /ENDING\s*BALANCE[:\s]*(\d{1,3}(?:,\d{3})*\.\d{2})/i,
        /STATEMENT\s*BALANCE[:\s]*(\d{1,3}(?:,\d{3})*\.\d{2})/i,
        /LEDGER\s*BALANCE[:\s]*(\d{1,3}(?:,\d{3})*\.\d{2})/i,
    ];

    for (const pattern of endPatterns) {
        const match = text.match(pattern);
        if (match) {
            endingBalance = parseFloat(match[1].replace(/,/g, ''));
            break;
        }
    }

    return {
        accountNumber,
        beginningBalance,
        endingBalance
    };
}

/**
 * Extract statement date (month/year) from PDF header
 */
function extractStatementDate(text) {
    // Look for "STATEMENT DATE : 30/11/25" pattern
    const dateMatch = text.match(/STATEMENT\s*DATE\s*:?\s*(\d{2})\/(\d{2})\/(\d{2,4})/i);
    if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        let year = parseInt(dateMatch[3]);
        if (year < 100) year += 2000;
        return { month, year };
    }

    // Default to current date
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Remove unwanted sections from text (like Python repo does)
 * This cleans up headers, footers, and notices before parsing
 * SAFE VERSION: Only removes if BOTH start and end markers are found
 */
function removeSections(lines, startMarker, endMarker) {
    // First, check if both markers exist
    const hasStart = lines.some(l => l.includes(startMarker));
    const hasEnd = lines.some(l => l.includes(endMarker));

    // Only remove if BOTH markers are found
    if (!hasStart || !hasEnd) {
        return lines;
    }

    const result = [];
    let inSection = false;

    for (const line of lines) {
        if (line.includes(startMarker)) {
            inSection = true;
            continue;
        }
        if (inSection && line.includes(endMarker)) {
            inSection = false;
            continue;
        }
        if (!inSection) {
            result.push(line);
        }
    }

    return result;
}

/**
 * Pre-process lines to remove header/footer sections
 * DISABLED: Section removal was causing transaction loss
 * The isNoiseLine() and isPageBreakMarker() functions handle filtering instead
 */
function preprocessLines(lines) {
    // Return lines unchanged - rely on isNoiseLine() for filtering
    // Section removal was too aggressive and deleted valid transactions
    return [...lines];
}

/**
 * Parse transaction lines from PDF text
 *
 * MAYBANK PDF STRUCTURE (as extracted by pdf.js):
 *   DATE (DD/MM)
 *   TRANSACTION_TYPE (e.g., "PAYMENT FR A/C", "SALE DEBIT")
 *   AMOUNT (with +/-)
 *   BALANCE (plain number)
 *   REFERENCE_NUMBER (e.g., T055492691519)
 *   "*" separator
 *   MERCHANT_NAME (e.g., "SHOPEE MALAYSIA")  <-- THIS IS WHAT WE NEED!
 *   LOCATION (optional)
 *   ... next DATE starts new transaction
 *
 * Key insight: Merchant name comes AFTER balance, not before amount!
 */
function parseTransactionText(text, statementDate, statementInfo) {
    const transactions = [];

    // Track parsing progress
    let transactionsCreated = 0;

    // Split by page breaks and process each page
    const pages = text.split('---PAGE_BREAK---');


    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageText = pages[pageIdx];
        let lines = pageText.split('\n').map(l => l.trim()).filter(l => l);

        // Pre-process: remove header/footer sections (like Python repo)
        lines = preprocessLines(lines);


        // Find transaction blocks
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // Check if this line is a date (DD/MM format)
            const dateMatch = line.match(/^(\d{2})\/(\d{2})$/);

            if (dateMatch) {
                const day = parseInt(dateMatch[1]);
                const month = parseInt(dateMatch[2]);

                // Collect ALL lines for this transaction until next date
                const preAmountLines = [];    // Lines before amount (transaction type)
                const postBalanceLines = [];   // Lines after balance (merchant name)
                let amount = null;
                let isInflow = false;
                let pdfBalance = null;
                let amountFound = false;
                let balanceFound = false;
                let j = i + 1;

                // Look ahead to collect ALL transaction data
                while (j < lines.length) {
                    const nextLine = lines[j];

                    // Stop if we hit another date (start of next transaction)
                    if (/^\d{2}\/\d{2}$/.test(nextLine)) {
                        break;
                    }

                    // Stop at page break markers
                    if (isPageBreakMarker(nextLine)) {
                        break;
                    }

                    // Check for amount (number followed by + or -)
                    // Supports: "1,234.56+" or ".06+" (amounts starting with decimal)
                    const amountMatch = nextLine.match(/^(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\.\d{2})([+-])$/);
                    if (amountMatch && !amountFound) {
                        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                        isInflow = amountMatch[2] === '+';
                        amountFound = true;
                        j++;
                        continue;
                    }

                    // Check for balance (plain number like "1234.56" or ".00")
                    const balanceMatch = nextLine.match(/^(\d{1,3}(?:,\d{3})*\.\d{2})$|^\.(\d{2})$/);
                    if (balanceMatch && amountFound && !balanceFound) {
                        if (balanceMatch[2]) {
                            pdfBalance = parseFloat('0.' + balanceMatch[2]);
                        } else {
                            pdfBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
                        }
                        balanceFound = true;
                        j++;
                        continue;
                    }

                    // Collect lines in appropriate bucket
                    if (!isNoiseLine(nextLine)) {
                        if (!balanceFound) {
                            // Before balance: transaction type info
                            preAmountLines.push(nextLine);
                        } else {
                            // After balance: merchant name and location
                            postBalanceLines.push(nextLine);
                        }
                    }

                    j++;
                }

                // Create transaction if we have an amount
                if (amount !== null && amount > 0) {
                    // Build description from pre-amount lines (transaction type)
                    const transactionTypePart = preAmountLines.join(' ').trim();

                    // Extract merchant name from post-balance lines
                    const merchantPart = extractMerchantFromPostBalance(postBalanceLines);

                    // Combine: "PAYMENT FR A/C SHOPEE MALAYSIA"
                    let description = transactionTypePart;
                    if (merchantPart) {
                        description = description + ' ' + merchantPart;
                    }
                    description = cleanRawDescription(description);


                    // Create transaction
                    const transaction = createTransaction(
                        day, month, statementDate,
                        description, amount, isInflow, pdfBalance
                    );
                    if (transaction) {
                        // Mark PRE-AUTH transactions
                        if (transactionTypePart.toUpperCase().includes('PRE-AUTH')) {
                            transaction.isPreAuth = true;
                        }
                        transactions.push(transaction);
                        transactionsCreated++;
                    }
                }

                i = j;
            } else {
                i++;
            }
        }
    }

    // Sort by date and adjust import IDs
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    let processed = adjustDuplicateImportIds(transactions);

    // Detect PRE-AUTH pairs and set default selection states
    processed = detectPreAuthPairs(processed);

    return processed;
}

/**
 * Extract merchant name from post-balance lines
 *
 * Post-balance lines typically contain:
 *   - Reference number (T055492691519 or 16+ digit number) - SKIP
 *   - Asterisk (*) - KEEP as separator for merchant/reference split
 *   - Merchant name (SHOPEE MALAYSIA) - KEEP
 *   - Location (CYBERJAYA, MY) - SKIP
 *   - User reference for transfers (Good job babe) - KEEP as memo hint
 *
 * Output format: "MERCHANT_NAME* reference" or just "MERCHANT_NAME"
 * The asterisk is preserved so parseDescription can split merchant from reference
 */
function extractMerchantFromPostBalance(lines) {
    if (!lines || lines.length === 0) return '';

    const beforeAsterisk = [];   // Merchant name (before *)
    const afterAsterisk = [];    // User reference/location (after *)
    let foundAsterisk = false;

    for (const line of lines) {
        // Skip reference numbers (T followed by digits, or long digit strings)
        if (/^T\d{8,}/.test(line)) continue;
        if (/^\d{10,}$/.test(line)) continue;

        // Track asterisk position
        if (line === '*') {
            foundAsterisk = true;
            continue;
        }

        // Skip location codes
        if (/^(MY|MYS|US|NL|SG|GB)$/i.test(line)) continue;

        // Skip lines that are just location fragments
        if (/^(CYBERJAYA|KUALA LUMPUR|SELANGOR|MALAYSIA)$/i.test(line)) continue;

        // Sort into before/after asterisk buckets
        if (foundAsterisk) {
            afterAsterisk.push(line);
        } else {
            beforeAsterisk.push(line);
        }
    }

    // Build result with asterisk separator if we found one and have content after it
    let result = beforeAsterisk.join(' ').trim();

    if (foundAsterisk && afterAsterisk.length > 0) {
        // Add asterisk back as delimiter so parseDescription can split properly
        result = result + '* ' + afterAsterisk.join(' ').trim();
    }

    // Clean up
    result = result.replace(/,\s*$/, '').trim();

    return result;
}

/**
 * Check if line is a page break marker (headers, footers, etc.)
 */
function isPageBreakMarker(line) {
    const markers = [
        /^URUSNIAGA AKAUN/i,
        /^ACCOUNT TRANSACTIONS/i,
        /^TARIKH MASUK/i,
        /^ENTRY DATE/i,
        /^MUKA.*PAGE/i,
        /^NOT PROTECTED BY PIDM/i,
    ];
    return markers.some(m => m.test(line));
}

/**
 * Check if a line is noise (should be filtered out)
 */
function isNoiseLine(line) {
    // Empty or very short
    if (!line || line.length < 2) return true;

    // Known noise patterns (can appear anywhere in line)
    const containsPatterns = [
        /MUKA\s*\/\s*\/?\s*PAGE/i,  // "MUKA/ /PAGE" or "MUKA/PAGE"
        /Statement\s*Date/i,        // "Statement Date"
        /Account\s*Number/i,        // "Account Number"
        /NOMBOR\s*AKAUN/i,          // "NOMBOR AKAUN"
    ];

    // Check if line contains any noise pattern anywhere
    if (containsPatterns.some(pattern => pattern.test(line))) {
        return true;
    }

    // Known noise patterns (must match at start)
    const noisePatterns = [
        // Page headers/footers
        /^BEGINNING BALANCE/i,
        /^ENDING BALANCE/i,
        /^LEDGER BALANCE/i,
        /^TOTAL DEBIT/i,
        /^TOTAL CREDIT/i,
        /^STATEMENT BALANCE/i,
        /^TRANSACTION AMOUNT/i,
        /^TRANSACTION DESCRIPTION/i,
        /^ENTRY DATE/i,
        /^VALUE DATE/i,

        // Malay headers
        /^BAKI PENYATA/i,
        /^JUMLAH URUSNIAGA/i,
        /^BUTIR URUSNIAGA/i,
        /^TARIKH/i,

        // Chinese text (common in Maybank statements)
        /^進支日期/,
        /^仄過賬日期/,
        /^進支項說明/,
        /^银碼/,
        /^結單存餘/,
        /^結單日期/,
        /^戶號/,
        /^戶口進支項/,
        /^可應用存餘/,
        /^截止結餘減未過賬仄/,
        /^本欄内誌/,
        /^若银行/,
        /^余额将被视为正确/,
        /^請通知本行/,

        // Bank notices and disclaimers
        /^NOT PROTECTED BY PIDM/i,
        /^ZEST-I$/i,
        /^Maybank Islamic/i,
        /^MS \/ CIK/i,
        /^IBS SUBANG/i,
        /^Perhatian/i,
        /^Note$/i,
        /^Semua maklumat/i,
        /^All items and balances/i,
        /^Sila beritahu/i,
        /^Please notify/i,
        /^Wang yang keluar/i,
        /^Overdrawn balances/i,
        /^URUSNIAGA AKAUN/i,
        /^ACCOUNT TRANSACTIONS/i,

        // Long bank notices (FCN, etc.)
        /^FCN$/i,
        /^EXCHANGE YOUR CURRENCY/i,
        /^PLEASE BE REMINDED/i,
        /^CREDIT TO MULTIPLE/i,
        /^KINI, ANDA TIDAK/i,
        /^EFFECTIVE \d/i,
        /^STARTING \d/i,
        /^BERMULA \d/i,
        /^NOTICE:/i,
        /^NOTIS/i,
        /^WE WOULD LIKE/i,
        /^KINDLY BE INFORMED/i,
        /^FOR ANY FURTHER/i,
        /^THANK YOU FOR/i,

        // Account numbers and codes
        /^\d{12}$/,
        /^562227\d+$/,
        /^MAE$/i,

        // Location/address fragments
        /^15th Floor/i,
        /^Tower A/i,
        /^Dataran Maybank/i,
        /^Jalan Maarof/i,
        /^Kuala Lumpur$/i,
        /^T2-22-12 JALAN/i,
        /^CYBER 4 THIRD/i,
        /^AVENUE.*CYBERJAYA/i,
        /^SELANGOR.*MYS$/i,

        // Balance indicators
        /^=$/,
        /^-$/,
        /^\*$/,
        /^:$/,

        // Pure numbers (balance column)
        /^\d{1,3}(,\d{3})*\.\d{2}$/,
    ];

    return noisePatterns.some(pattern => pattern.test(line));
}

/**
 * Clean raw description - remove page noise that leaked into transaction text
 */
function cleanRawDescription(description) {
    if (!description) return '';

    return description
        // Remove page markers
        .replace(/MUKA\s*\/\s*\/?\s*PAGE.*/gi, '')
        // Remove statement date fragments
        .replace(/Statement\s*Date.*/gi, '')
        .replace(/\d{2}\/\d{2}\/\d{2,4}\s*$/g, '') // Date at end
        // Remove account number fragments
        .replace(/Account\s*Number.*/gi, '')
        .replace(/NOMBOR\s*AKAUN.*/gi, '')
        .replace(/\s+\d{12}\s*$/g, '') // 12-digit account number at end
        // Remove QR codes and reference numbers at end
        .replace(/QR\d{8,}\s*$/gi, '')
        // Clean up extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if a name matches any of the own account names (for internal transfer detection)
 */
function isOwnAccountName(name) {
    if (!name) return false;
    const upperName = name.toUpperCase().trim();
    return OWN_ACCOUNT_NAMES.some(ownName =>
        upperName.includes(ownName.toUpperCase()) ||
        ownName.toUpperCase().includes(upperName)
    );
}

/**
 * Create a transaction object from parsed data
 * Returns object with skipImport flag for internal transfers
 * @param {number} pdfBalance - The balance shown in PDF after this transaction
 */
function createTransaction(day, month, statementDate, description, amount, isInflow, pdfBalance = null) {
    // Determine year
    let year = statementDate.year;
    if (month > statementDate.month + 1) {
        year = statementDate.year - 1;
    }

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Extract transaction type and details
    const { transactionType, merchantName, userReference } = parseDescription(description);

    // Check if internal transfer between own accounts
    const isInternalTransfer = (transactionType === 'TRANSFER OUT' || transactionType === 'TRANSFER IN') &&
        isOwnAccountName(merchantName);


    // Determine payee and category
    let payeeName = null;
    let category = null;
    let memo = userReference || ''; // Reference always goes to memo
    let isUnmatched = false;
    let payeeSource = 'unknown'; // Track where payee came from

    // Step 0: Check if user has previously set a payee for this description (learned mapping)
    const learnedPayee = PayeeMappings.getLearnedPayee(description);
    if (learnedPayee) {
        payeeName = learnedPayee;
        payeeSource = 'learned_payee';
        isUnmatched = false; // User already mapped this, not unmatched
    }

    // Step 1: Check if user reference maps to a known payee
    // This handles cases like "Mixue" -> Mixue, "Youtube" -> Youtube Premium
    if (!payeeName && userReference) {
        const refMapping = PayeeMappings.findPayeeMapping(userReference);
        if (refMapping && refMapping.payeeName) {
            payeeName = refMapping.payeeName;
            category = refMapping.category;
            payeeSource = 'reference_mapping';
        }
    }

    // Step 2: If no payee from reference, check merchant name mapping
    if (!payeeName && merchantName) {
        const merchantMapping = PayeeMappings.findPayeeMapping(merchantName);
        if (merchantMapping && merchantMapping.payeeName) {
            payeeName = merchantMapping.payeeName;
            category = merchantMapping.category;
            payeeSource = 'merchant_mapping';
        }
    }

    // Step 3: If still no payee, use cleaned merchant name as payee
    if (!payeeName && merchantName) {
        payeeName = PayeeMappings.cleanMerchantName(merchantName);
        payeeSource = 'merchant_fallback';
        isUnmatched = true; // No mapping found, needs review
    }

    // Step 4: Ultimate fallback
    if (!payeeName) {
        payeeName = PayeeMappings.cleanMerchantName(description) || 'Unknown';
        payeeSource = 'description_fallback';
        isUnmatched = true;
    }

    // Step 5: Check learned category for this payee (user's previous selections)
    if (!category && payeeName) {
        const learnedCategory = PayeeMappings.getLearnedCategory(payeeName);
        if (learnedCategory) {
            category = learnedCategory;
            // No longer unmatched if we found a learned category
            isUnmatched = false;
        }
    }

    // Step 5.5: Check memo for category hints (e.g., "Transport" -> Social Transport)
    if (!category && memo) {
        const memoCategory = PayeeMappings.getCategoryFromMemo(memo);
        if (memoCategory) {
            category = memoCategory;
            isUnmatched = false;
        }
    }

    // Step 6: For inflows without a category, default to "Inflow: Ready to Assign"
    if (isInflow && !category) {
        category = 'Inflow: Ready to Assign';
    }

    // Mark as unmatched if no category for outflows
    if (!isInflow && !category) {
        isUnmatched = true;
    }

    // Calculate milliunits
    const milliunits = Math.round(amount * 1000) * (isInflow ? 1 : -1);
    const importId = `YNAB:${milliunits}:${date}:1`;

    return {
        date,
        payeeName,
        category,
        memo,
        amount,
        isInflow,
        milliunits,
        importId,
        rawDescription: description,
        transactionType,
        isUnmatched,
        payeeSource,
        isInternalTransfer,  // Mark for skipping import but keep for balance calc
        pdfBalance  // Balance shown in PDF after this transaction (per-account)
    };
}

/**
 * Parse description to extract transaction type, merchant, and user reference
 *
 * Description format (after parsing fix):
 *   "PAYMENT FR A/C SHOPEE MALAYSIA"
 *   "TRANSFER FR A/C ALEKSANDRA TARSKAIA Good job babe"
 *   "SALE DEBIT STAR GROCER- LALAPO"
 *
 * For transfers, text after recipient name (without *) is user reference/memo
 */
function parseDescription(description) {
    let transactionType = '';
    let merchantName = '';
    let userReference = '';

    const desc = description.trim();

    // Identify and remove transaction type prefix
    const typePatterns = [
        { pattern: /^PRE-AUTH DEBIT\s*/i, type: 'PRE-AUTH DEBIT', remove: 'PRE-AUTH DEBIT' },
        { pattern: /^PRE-AUTH REFUND\s*/i, type: 'PRE-AUTH REFUND', remove: 'PRE-AUTH REFUND' },
        { pattern: /^SALE DEBIT\s*/i, type: 'SALE DEBIT', remove: 'SALE DEBIT' },
        { pattern: /^PAYMENT FR A\/C\s*/i, type: 'PAYMENT', remove: 'PAYMENT FR A/C' },
        { pattern: /^TRANSFER FR A\/C\s*/i, type: 'TRANSFER OUT', remove: 'TRANSFER FR A/C' },
        { pattern: /^TRANSFER TO A\/C\s*/i, type: 'TRANSFER IN', remove: 'TRANSFER TO A/C' },
        { pattern: /^FPX REFUND BUYER\s*/i, type: 'FPX REFUND', remove: 'FPX REFUND BUYER' },
        { pattern: /^FPX REFUND\s*/i, type: 'FPX REFUND', remove: 'FPX REFUND' },
        { pattern: /^DIVIDEND PAID\s*/i, type: 'DIVIDEND', remove: 'DIVIDEND PAID' },
    ];

    let remaining = desc;
    for (const { pattern, type, remove } of typePatterns) {
        if (pattern.test(desc)) {
            transactionType = type;
            remaining = desc.replace(new RegExp('^' + remove.replace(/[\/]/g, '\\/') + '\\s*', 'i'), '').trim();
            break;
        }
    }

    // Now 'remaining' contains: "SHOPEE MALAYSIA" or "ALEKSANDRA TARSKAIA Good job babe"

    // For transfers, the recipient name often ends with * in the original PDF
    // After our extraction, the format might be: "RECIPIENT_NAME reference text"
    // Split by asterisk if present
    if (remaining.includes('*')) {
        const asteriskParts = remaining.split('*');
        merchantName = asteriskParts[0].trim();
        userReference = asteriskParts.slice(1).join(' ').trim();
    } else {
        // No asterisk - for transfers, try to identify where recipient ends and reference begins
        // Heuristic: recipient is usually ALL CAPS name, reference might have mixed case
        const words = remaining.split(/\s+/);

        if (transactionType === 'TRANSFER OUT' || transactionType === 'TRANSFER IN') {
            // For transfers: look for transition from name to reference
            // Names are usually 2-3 words in CAPS
            const nameWords = [];
            const refWords = [];
            let inReference = false;

            for (const word of words) {
                // Skip known skip words
                if (/^(MBB|CT|DUITNOW)$/i.test(word)) continue;

                // If we find a word that looks like a reference (not all caps, or common reference words)
                if (!inReference && nameWords.length >= 2) {
                    // Check if this word could be a reference
                    const looksLikeName = /^[A-Z]+$/.test(word) && word.length > 1;
                    if (!looksLikeName) {
                        inReference = true;
                    }
                }

                if (inReference) {
                    refWords.push(word);
                } else {
                    nameWords.push(word);
                }
            }

            merchantName = nameWords.join(' ').trim();
            userReference = refWords.join(' ').trim();
        } else {
            // For non-transfers (purchases), everything is merchant name
            merchantName = remaining;
        }
    }

    // Clean up merchant name - remove trailing asterisks, location codes
    merchantName = merchantName
        .replace(/\*+$/, '')
        .replace(/\s+(MY|MYS|US|NL|SG|GB)$/i, '')
        .replace(/,\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Clean up reference
    userReference = userReference
        .replace(/^[\s,*]+/, '')
        .replace(/\s+(MY|MYS|US|NL|SG|GB)$/i, '')
        .replace(/CYBERJAYA/gi, '')
        .replace(/KUALA LUMPUR/gi, '')
        .replace(/SELANGOR/gi, '')
        .replace(/,\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { transactionType, merchantName, userReference };
}

/**
 * Detect PRE-AUTH pairs (PRE-AUTH DEBIT + matching refund)
 * PRE-AUTH REFUND has no label in PDF - detected by matching amount/payee
 *
 * @param {Array} transactions - Parsed transactions
 * @returns {Array} - Transactions with PRE-AUTH pairs marked
 */
function detectPreAuthPairs(transactions) {
    // Find all PRE-AUTH DEBIT transactions
    const preAuthDebits = transactions.filter(t => t.isPreAuth && !t.isInflow);


    for (const preAuth of preAuthDebits) {
        // Look for matching refund: same payee, same amount, inflow, within 7 days
        const matchingRefund = transactions.find(t =>
            t.isInflow &&
            t.amount === preAuth.amount &&
            normalizePayeeName(t.payeeName) === normalizePayeeName(preAuth.payeeName) &&
            !t.isPreAuthRefund && // Don't match already-matched refunds
            Math.abs(new Date(t.date) - new Date(preAuth.date)) <= 7 * 24 * 60 * 60 * 1000
        );

        if (matchingRefund) {
            matchingRefund.isPreAuthRefund = true;
            matchingRefund.matchedPreAuthId = preAuth.importId;
            preAuth.matchedRefundId = matchingRefund.importId;
        }
    }

    // Set default isSelected for all transactions
    for (const t of transactions) {
        if (t.isPreAuth || t.isPreAuthRefund) {
            t.isSelected = false; // PRE-AUTH pairs excluded by default
            t.excludeReason = t.isPreAuth ? 'PRE-AUTH DEBIT' : 'PRE-AUTH REFUND';
        } else if (t.isInternalTransfer) {
            t.isSelected = false; // Internal transfers excluded by default
            t.excludeReason = 'Internal transfer';
        } else {
            t.isSelected = true; // Normal transactions selected by default
        }
    }

    return transactions;
}

/**
 * Normalize payee name for comparison (case-insensitive, trimmed)
 */
function normalizePayeeName(name) {
    if (!name) return '';
    return name.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[*\-.,]/g, '');
}

/**
 * Adjust import_ids for transactions with same date and amount
 */
function adjustDuplicateImportIds(transactions) {
    const idCounts = {};

    return transactions.map(t => {
        const baseId = `YNAB:${t.milliunits}:${t.date}`;

        if (!idCounts[baseId]) {
            idCounts[baseId] = 1;
        } else {
            idCounts[baseId]++;
        }

        return {
            ...t,
            importId: `${baseId}:${idCounts[baseId]}`
        };
    });
}

/**
 * Parse multiple PDF files
 * @returns {Object} - { transactions, statementInfo }
 */
async function parseMultiplePDFs(files) {
    let allTransactions = [];
    let combinedBeginningBalance = 0;
    let combinedEndingBalance = 0;
    let accountsFound = [];

    for (const file of files) {
        try {
            const { transactions, statementInfo } = await parseMaybankPDF(file);

            // Add account info to each transaction
            const accountNumber = statementInfo?.accountNumber || 'unknown';
            transactions.forEach(t => {
                t.accountNumber = accountNumber;
                t.sourceFile = file.name;
            });

            allTransactions = allTransactions.concat(transactions);

            // Accumulate balances from all statements
            if (statementInfo) {
                if (statementInfo.beginningBalance !== null) {
                    combinedBeginningBalance += statementInfo.beginningBalance;
                }
                if (statementInfo.endingBalance !== null) {
                    combinedEndingBalance += statementInfo.endingBalance;
                }
                if (statementInfo.accountNumber) {
                    accountsFound.push(statementInfo.accountNumber);
                }
            }
        } catch (error) {
            console.error(`Error parsing ${file.name}:`, error);
            throw new Error(`Failed to parse ${file.name}: ${error.message}`);
        }
    }

    // Sort by date
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Use the PDF balance directly (per-account balance from the statement)
    // This is the most accurate as it's exactly what the bank shows
    for (const t of allTransactions) {
        t.statementBalance = t.pdfBalance;
    }

    // Adjust import_ids for duplicates across all files
    allTransactions = adjustDuplicateImportIds(allTransactions);

    return {
        transactions: allTransactions,
        statementInfo: {
            beginningBalance: combinedBeginningBalance,
            endingBalance: combinedEndingBalance,
            accounts: accountsFound
        }
    };
}

// Export for use in other modules
window.PDFParser = {
    parseMaybankPDF,
    parseMultiplePDFs
};
