// simulateTQQQFromQQQ.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import { parse, format } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configs
const INPUT_CSV = path.join(__dirname, './raw/QQQ_1999_2010.csv');
const OUTPUT_CSV = path.join(__dirname, './serialized/TQQQ_Simulated_1999_2010.csv');

const INITIAL_TQQQ_PRICE = 85; // Set initial simulated price so final value aligns with real TQQQ launch price ($0.41)
const LEVERAGE = 3;
const EXPENSE_RATIO = 0.0095;
const ANNUAL_DRAG_RATIO = 0.08; // LEVERAGE COST + SWAP FEE
const TRADING_DAYS = 252;

const dailyExpenseFee = EXPENSE_RATIO / TRADING_DAYS;
const dailyLeverageFee = ANNUAL_DRAG_RATIO / TRADING_DAYS;
const totalDailyFee = dailyExpenseFee + dailyLeverageFee;

async function loadQQQData(filepath) {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

async function simulateTQQQ() {
    const qqqData = await loadQQQData(INPUT_CSV);

    if (qqqData.length === 0) {
        console.error('No data found in input CSV.');
        return;
    }

    const simulatedTQQQ = [];
    let prevTQQQClose = INITIAL_TQQQ_PRICE;

    for (let i = 1; i < qqqData.length; i++) {
        const prevQQQClose = parseFloat(qqqData[i - 1].Close);
        const currQQQClose = parseFloat(qqqData[i].Close);

        if (isNaN(prevQQQClose) || isNaN(currQQQClose)) {
            continue;
        }

        const dailyReturnQQQ = (currQQQClose - prevQQQClose) / prevQQQClose;
        const leveragedReturn = (LEVERAGE * dailyReturnQQQ) - totalDailyFee;
        const currTQQQClose = prevTQQQClose * (1 + leveragedReturn);

        const dailyChangePct = ((currTQQQClose - prevTQQQClose) / prevTQQQClose) * 100;

        const estOpen = currTQQQClose * (1 + (Math.random() - 0.5) * 0.01);
        const estHigh = currTQQQClose * (1 + Math.random() * 0.01);
        const estLow = currTQQQClose * (1 - Math.random() * 0.01);
        const estVolume = parseInt(qqqData[i].Volume.replace(/,/g, '')) || 0;

        let formattedDate;
        try {
            const rawDate = qqqData[i].Date.trim();
            let parsedDate = parse(rawDate, 'MMM. dd, yyyy', new Date());
            if (isNaN(parsedDate)) {
                parsedDate = parse(rawDate, 'MMM dd, yyyy', new Date());
            }
            formattedDate = format(parsedDate, 'yyyy-MM-dd');
        } catch (error) {
            console.warn(`Warning: failed to parse date for row ${i}:`, qqqData[i].Date, error);
            formattedDate = qqqData[i].Date;
        }

        simulatedTQQQ.push({
            Date: formattedDate,
            Open: estOpen.toFixed(2),
            High: estHigh.toFixed(2),
            Low: estLow.toFixed(2),
            Close: currTQQQClose.toFixed(2),
            Change: dailyChangePct.toFixed(2) + '%',
            Volume: estVolume
        });

        prevTQQQClose = currTQQQClose;
    }

    console.log(`Simulated ${simulatedTQQQ.length} days of TQQQ data.`);

    await saveTQQQData(simulatedTQQQ);
}

async function saveTQQQData(data) {
    const csvWriter = createObjectCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'Date', title: 'Date' },
            { id: 'Open', title: 'Open' },
            { id: 'High', title: 'High' },
            { id: 'Low', title: 'Low' },
            { id: 'Close', title: 'Close' },
            { id: 'Change', title: 'Change %' },
            { id: 'Volume', title: 'Volume' },
        ],
    });

    await csvWriter.writeRecords(data);
    console.log(`Saved simulated TQQQ data to ${OUTPUT_CSV}`);
}

(async () => {
    try {
        await simulateTQQQ();
    } catch (err) {
        console.error('Error during simulation:', err);
    }
})();
