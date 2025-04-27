import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

// ESM Fixes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const CSV_FILE = path.join(__dirname, '../TQQQ_Backtest_CSV.csv');
const INITIAL_BUY_AMOUNT = 10000;
const BUY_MULTIPLE = 1.618;  // 1.5x more buying each drop
const SELL_FRACTION = 0.382; // 50% selling each gain trigger
const DROP_LEVELS = [0.382, 0.5, 0.618, 0.786, 0.886, 0.941]; // deeper drops: 50%, 75%, 87.5%, 93.75%
const SELL_MULTIPLIERS = [
    1.618, 2.618, 4.236, 6.854, 11.089,
    17.944, 29.032, 46.769, 75.706, 122.429
]
// sell at 100%, 200%, etc gains


console.log(`BUY RULE MULTIPLE: ${DROP_LEVELS.map(val => ` ${val}`)}`)
console.log(`SELL RULE MULTIPLE: ${SELL_MULTIPLIERS.map(val => ` ${val}`)}`)
console.log("==================================")

// State
let globalPeakPrice = 0;
let cyclePeakPrice = 0;
let inBuyCycle = false;
let currentDropLevel = 0;
let nextSellMultiplierIndex = 0;
let transactions = [];
let holdingShares = 0;
let holdingCost = 0;

function handleBuy(price, date) {
    const multiplier = Math.pow(BUY_MULTIPLE, currentDropLevel); // <-- updated
    const buyAmount = INITIAL_BUY_AMOUNT * multiplier;
    const sharesBought = buyAmount / price;

    transactions.push({ type: 'BUY', date, price, shares: sharesBought });
    holdingCost += buyAmount;
    holdingShares += sharesBought;
    console.log(`Buy ${sharesBought.toFixed(2)} shares at $${price.toFixed(2)} on ${date} (drop ${DROP_LEVELS[currentDropLevel] * 100}%)`);

    currentDropLevel++;
}

function handleSell(price, date) {
    const sharesToSell = holdingShares * SELL_FRACTION; // <<< updated
    transactions.push({ type: 'SELL', date, price, shares: sharesToSell });
    holdingCost *= (1 - SELL_FRACTION); // <<< holdingCost reduces proportionally
    holdingShares *= (1 - SELL_FRACTION); // <<< holdingShares reduces proportionally
    console.log(`Sell ${((SELL_FRACTION) * 100).toFixed(1)}% (${sharesToSell.toFixed(2)} shares) at $${price.toFixed(2)} on ${date} (gain stage ${nextSellMultiplierIndex + 1})`);

    nextSellMultiplierIndex++;
}

function handleReset(price, date) {
    console.log(`\n=== Recovered to original peak at ${date} ($${price.toFixed(2)}), resetting strategy ===\n`);
    inBuyCycle = false;
    currentDropLevel = 0;
    nextSellMultiplierIndex = 0;
    cyclePeakPrice = globalPeakPrice;
}

function runBacktest(data) {
    for (const row of data) {
        const { Date: date, Close: closeStr, 'Peak Price': peakStr, 'Drawdown %': drawdownStr } = row;
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
        if (inBuyCycle && !boughtToday) { // <<< Only check sell if NOT bought today
            if (holdingShares > 0 && nextSellMultiplierIndex < SELL_MULTIPLIERS.length) {
                const avgCostPerShare = holdingCost / holdingShares;
                const targetSellPrice = avgCostPerShare * SELL_MULTIPLIERS[nextSellMultiplierIndex];

                if (close >= targetSellPrice) {
                    handleSell(close, date);
                }
            }
        }

        // ----- Recovery Section -----
        if (inBuyCycle && close >= cyclePeakPrice) {
            handleReset(close, date);
        }
    }


    finalize(data);
}

function finalize(data) {
    const latestClose = parseFloat(data[data.length - 1]['Close']);
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

    console.log('\n=== Final Summary ===');
    console.log(`Total Invested: $${totalInvested.toFixed(2)}`);
    console.log(`Total Sold: $${totalSold.toFixed(2)}`);
    console.log(`Final Portfolio Value: $${finalPortfolioValue.toFixed(2)}`);
    console.log(`Net Profit: $${netProfit.toFixed(2)}`);
    console.log(`\nTotal Value (Sold + Current): $${totalValue.toFixed(2)}`);
    console.log(`Multiple on Investment: ${multiple.toFixed(2)}x`);
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
        runBacktest(data);
    } catch (err) {
        console.error('Error loading CSV:', err);
    }
})();
