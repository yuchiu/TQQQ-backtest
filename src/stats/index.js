import { END_DATE } from '../index.js';

// Helper functions
function average(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr) {
    const mean = average(arr);
    const sqDiff = arr.map(x => Math.pow(x - mean, 2));
    return arr.length ? Math.sqrt(average(sqDiff)) : 0;
}

export function calculateStats(dailyPortfolio) {
    if (dailyPortfolio.length < 2) {
        console.log("Not enough data to calculate stats.");
        return;
    }

    // Find first valid starting point (nonzero)
    const firstNonZero = dailyPortfolio.find(d => d.totalValue > 0);
    const initialValue = firstNonZero ? firstNonZero.totalValue : 0;
    const startDate = new Date(firstNonZero.date);

    const endDateObj = new Date(END_DATE);
    const lastEntry = [...dailyPortfolio].reverse().find(d => new Date(d.date) <= endDateObj);

    if (!lastEntry) {
        console.log("No valid data up to END_DATE.");
        return;
    }

    const finalValue = lastEntry.totalValue;
    const endDate = new Date(lastEntry.date);

    const numYears = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);

    if (initialValue === 0 || numYears <= 0) {
        console.log("Invalid initial value or numYears. Skipping stats calculation.");
        return;
    }

    // 🛠 Fix: use totalValue for returns
    const dailyReturns = [];
    for (let i = 1; i < dailyPortfolio.length; i++) {
        const prev = dailyPortfolio[i - 1];
        const curr = dailyPortfolio[i];

        if (new Date(curr.date) > endDate) break;

        const prevValue = prev.totalValue;
        const currValue = curr.totalValue;

        if (prevValue === 0) continue;
        const ret = (currValue - prevValue) / prevValue;
        dailyReturns.push(ret);
    }

    const meanDailyReturn = average(dailyReturns);
    const stdevDailyReturn = stddev(dailyReturns);

    const annualReturn = Math.pow(finalValue / initialValue, 1 / numYears) - 1;
    const sharpeRatio = meanDailyReturn && stdevDailyReturn ? meanDailyReturn / stdevDailyReturn * Math.sqrt(252) : NaN;

    // 🛠 Fix: use totalValue for maxDrawdown
    let peak = 0;
    let maxDrawdown = 0;
    for (const point of dailyPortfolio) {
        const pointDate = new Date(point.date);
        if (pointDate > endDate) break;

        if (point.totalValue > peak) peak = point.totalValue;
        const drawdown = (point.totalValue - peak) / peak;
        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    }

    // Annual returns
    const annualReturns = {};
    for (let i = 1; i < dailyPortfolio.length; i++) {
        const year = new Date(dailyPortfolio[i].date).getFullYear();
        if (new Date(dailyPortfolio[i].date) > endDate) break;

        if (!annualReturns[year]) annualReturns[year] = { start: dailyPortfolio[i - 1].totalValue, end: dailyPortfolio[i].totalValue };
        else annualReturns[year].end = dailyPortfolio[i].totalValue;
    }

    const annualReturnsPct = Object.entries(annualReturns)
        .filter(([, { start }]) => start !== 0)
        .map(([year, { start, end }]) => ({
            year,
            returnPct: (end - start) / start
        }));

    const bestYear = Math.max(...annualReturnsPct.map(r => r.returnPct));
    const worstYear = Math.min(...annualReturnsPct.map(r => r.returnPct));

    console.log(`CAGR: ${(annualReturn * 100).toFixed(2)}%`);
    console.log(`Best Year: ${(bestYear * 100).toFixed(2)}%`);
    console.log(`Worst Year: ${(worstYear * 100).toFixed(2)}%`);
    console.log(`Max Drawdown: ${(maxDrawdown * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
    console.log("\n================================== 🏁 END 🏁 =================================\n");

    return { finalValue, annualReturn, bestYear, worstYear, maxDrawdown, sharpeRatio };

}
