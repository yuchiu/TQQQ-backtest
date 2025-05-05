import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { storePortfolioData, plotPortfolio } from './plotting/index.js';
import { calculateStats } from './stats/index.js';

// ESM Fixes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const CSV_FILE = path.join(__dirname, '../historical_data/aggregated_TQQQ_simulation_1999_2025.csv');

// export const START_DATE = '1999-03-11'; // QQQ Launch
// export const START_DATE = '2000-03-11'; // Peak before 2000 Internet Bubble
export const START_DATE = '2007-10-31'; // Peak before 2008 Financial Crisis
// export const START_DATE = '2010-02-11'; // Peak before 2008 Financial Crisis
// export const START_DATE = '2018-08-31'; // Peak before 2008 Financial Crisis
// export const START_DATE = '2021-12-31'; // Peak before 2022 correction

// export const END_DATE = '2018-08-31';
// export const END_DATE = '2021-12-31'; // Peak before 2022 correction
// export const END_DATE = '2025-03-31'; // Online backtest tool date
export const END_DATE = '2025-04-22'; // historical data date
const INITIAL_BUY_AMOUNT = 10000;
// const BUY_MULTIPLE = 1.618
const BUY_MULTIPLE = 2;
// const SELL_FRACTION = 0.146; // 0.146 0.236 0.382
const SELL_FRACTION = 0.2;
const DROP_LEVELS = [
    // 0.382, 0.5, 0.618, 0.786, 0.886, 0.941, 0.970, 0.985
    0.25, 0.5, 0.75, 0.875, 0.9375, 0.96875, 0.984375, 0.9921875
    // 0.5, 0.75, 0.875, 0.9375, 0.96875, 0.984375, 0.9921875
];
const SELL_MULTIPLIERS = [
    // 10000
    // 1.618, 2.618, 4.236, 6.854, 11.089, 17.944, 29.032, 46.769, 75.706, 122.429
    2, 4, 8, 16, 32, 64, 128, 256
];

console.log(`============================ ${START_DATE} - ${END_DATE} ==========================\n`);
console.log("================================== ⚙️  RULES ⚙️  ================================");
console.log(`Buy Triggers (Drawdown % Levels) : ${DROP_LEVELS.map(val => ` ${val}`)}`);
console.log(`Buy Amount Growth Factor         : ${BUY_MULTIPLE}x`);
console.log(`Sell Targets (Price Multipliers) : ${SELL_MULTIPLIERS.map(val => ` ${val}`)}`);
console.log(`Sell Fraction per Target         : ${SELL_FRACTION}`);
console.log("\n============================== 💰 TRANSACTIONS 💰 =============================");

// State
let globalPeakPrice = 0;
let cyclePeakPrice = 0;
let inBuyCycle = false;
let hasRecovered = false;
let currentDropLevel = 0;
let nextSellMultiplierIndex = 0;
let transactions = [];
let holdingShares = 0;
let cumulativeInvestedAmount = 0;
let anchoredSellPrice = null; // Sell anchor point, using first Buy Level Triggered Price

// For plotting portfolio
let dailyPortfolio = [];
let cumulativeSoldAmount = 0;


function handleBuy(price, date) {
    if (currentDropLevel === 0) {
        nextSellMultiplierIndex = 0; // <<< Only reset here if starting brand new cycle
        anchoredSellPrice = price
    }

    const multiplier = Math.pow(BUY_MULTIPLE, currentDropLevel);
    const buyAmount = INITIAL_BUY_AMOUNT * multiplier;
    const sharesBought = buyAmount / price;

    transactions.push({ type: 'BUY', date, price, shares: sharesBought });
    holdingShares += sharesBought;

    // Calculate actual drop from cyclePeakPrice
    const actualDropFromPeak = ((cyclePeakPrice - price) / cyclePeakPrice) * 100;

    console.log(`Buy ${sharesBought.toFixed(2)} shares at $${price.toFixed(2)} on ${date} for $${buyAmount.toFixed(2)} (price drop: ${actualDropFromPeak.toFixed(2)}% from $${cyclePeakPrice.toFixed(2)})`);

    currentDropLevel++;
    cumulativeInvestedAmount += buyAmount;
}

function handleSell(price, date) {
    const sharesToSell = holdingShares * SELL_FRACTION;
    transactions.push({ type: 'SELL', date, price, shares: sharesToSell });

    holdingShares *= (1 - SELL_FRACTION);

    console.log(`Sell ${((SELL_FRACTION) * 100).toFixed(1)}% (${sharesToSell.toFixed(2)} shares) at $${price.toFixed(2)} on ${date} for $${(sharesToSell * price).toFixed(2)} (sell target multiple ${SELL_MULTIPLIERS[nextSellMultiplierIndex]} of ${anchoredSellPrice.toFixed(2)})`);

    nextSellMultiplierIndex++;
    cumulativeSoldAmount += sharesToSell * price;
}


function handleReset(price, date) {
    console.log(`\n=== Recovered to original peak at ${date} ($${price.toFixed(2)}), resetting strategy ===\n`);
    inBuyCycle = false;
    hasRecovered = true;
    currentDropLevel = 0;
    cyclePeakPrice = globalPeakPrice;
}

function runBacktest(data) {
    for (const row of data) {
        const { Date: date, Close: closeStr, 'Peak Price': peakStr, 'Drawdown %': drawdownStr } = row;

        if (date < START_DATE || date > END_DATE) {
            continue; // <<< Skip dates outside the range
        }

        storePortfolioData({
            dailyPortfolio,
            rowData: row,
            holdingShares,
            cumulativeSoldAmount,
            cumulativeInvested: cumulativeInvestedAmount
        });


        const close = parseFloat(closeStr);
        const peak = parseFloat(peakStr);
        const drawdown = parseFloat(drawdownStr.replace('%', '')) / 100;

        if (isNaN(close) || isNaN(peak) || isNaN(drawdown)) {
            continue;
        }

        if (close > globalPeakPrice) {
            globalPeakPrice = close;
            if (!inBuyCycle) {
                cyclePeakPrice = globalPeakPrice;
            }
        }

        // ----- Buy Section -----
        let boughtToday = false;

        if (!inBuyCycle && close <= cyclePeakPrice * (1 - DROP_LEVELS[0])) {
            handleBuy(close, date);
            inBuyCycle = true;
            hasRecovered = false; // <<< reset hasRecovered on new buy cycle
            boughtToday = true;
        }

        if (inBuyCycle) {
            const dropFromCyclePeak = (cyclePeakPrice - close) / cyclePeakPrice;

            if (currentDropLevel < DROP_LEVELS.length) {
                const nextDrop = DROP_LEVELS[currentDropLevel];
                if (dropFromCyclePeak >= nextDrop) {
                    handleBuy(close, date);
                    boughtToday = true;
                }
            }
        }

        // ----- Sell Section -----
        if (hasRecovered && holdingShares > 0 && !boughtToday) {
            while (nextSellMultiplierIndex < SELL_MULTIPLIERS.length) {
                const targetSellPrice = anchoredSellPrice * SELL_MULTIPLIERS[nextSellMultiplierIndex];

                if (close >= targetSellPrice) {
                    handleSell(close, date);
                } else {
                    break;
                }
            }
        }


        // ----- Recovery Section -----
        if (inBuyCycle && close >= cyclePeakPrice) {
            handleReset(close, date);
        }
    }

    return finalize(data);
}

function finalize(data) {
    const endDateObj = new Date(END_DATE);

    // ✅ Correctly find the last price before or equal to END_DATE
    const lastRow = [...data].reverse().find(row => new Date(row.Date) <= endDateObj);

    if (!lastRow) {
        console.error('No final price found before END_DATE');
        return;
    }

    const latestClose = parseFloat(lastRow['Close']);
    const finalPortfolioValue = holdingShares > 0 ? holdingShares * latestClose : 0;

    const totalInvested = transactions
        .filter(t => t.type === 'BUY')
        .reduce((sum, t) => sum + (t.price * t.shares), 0);

    const totalSold = transactions
        .filter(t => t.type === 'SELL')
        .reduce((sum, t) => sum + (t.price * t.shares), 0);

    const netProfit = (finalPortfolioValue + totalSold) - totalInvested;
    const totalValue = finalPortfolioValue + totalSold;
    const multiple = totalInvested > 0 ? totalValue / totalInvested : 0;

    console.log('\n================================ 📊 Summary 📊 ===============================');
    console.log(`Total Invested: $${totalInvested.toFixed(2)}`);
    console.log(`Total Sold (Cashout): $${totalSold.toFixed(2)}`);
    console.log(`Final Holding Value: $${finalPortfolioValue.toFixed(2)}`);
    console.log(`Net Profit: $${netProfit.toFixed(2)}`);
    console.log(`Total Value: $${totalValue.toFixed(2)} (Sold + Holding)`);
    console.log(`Multiple on Investment: ${multiple.toFixed(2)}x`);


    return { multiple, totalInvested }
}

async function loadCSV(filepath) {
    const results = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Main
(async () => {
    try {
        const data = await loadCSV(CSV_FILE);
        const backtestData = runBacktest(data);
        const summaryStats = await calculateStats(dailyPortfolio);
        const fullSummaryStats = { ...summaryStats, ...backtestData }
        await plotPortfolio(dailyPortfolio, fullSummaryStats);
    } catch (err) {
        console.error('Error loading CSV:', err);
    }
})();
