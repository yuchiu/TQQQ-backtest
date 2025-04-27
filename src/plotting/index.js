import { plot } from 'nodeplotlib';

export const storePortfolioData = ({
    dailyPortfolio,
    rowData,
    holdingShares,
    cumulativeSoldAmount,
    cumulativeInvested,
}) => {
    const { Date: date, Close: closeStr } = rowData;
    const close = parseFloat(closeStr);

    const portfolioValue = holdingShares * close;
    const cashValue = cumulativeSoldAmount; // <<< ADD this
    const totalValue = portfolioValue + cashValue;

    dailyPortfolio.push({
        date,
        portfolioValue,
        cashValue,
        totalValue,
        cumulativeInvested,
    });
}


export function plotPortfolio(dailyPortfolio) {
    // === 1. Downsample to month-end data ===
    const monthlyPortfolio = [];
    let lastMonth = null;

    for (let i = 0; i < dailyPortfolio.length; i++) {
        const point = dailyPortfolio[i];
        const date = new Date(point.date);
        const month = date.getFullYear() + '-' + (date.getMonth() + 1); // 'YYYY-M'

        if (month !== lastMonth) {
            monthlyPortfolio.push(point);
            lastMonth = month;
        } else {
            // Keep updating to latest point in the month
            monthlyPortfolio[monthlyPortfolio.length - 1] = point;
        }
    }

    const dates = monthlyPortfolio.map(d => d.date);
    const portfolioValues = monthlyPortfolio.map(d => d.portfolioValue);
    const cashValues = monthlyPortfolio.map(d => d.cashValue);
    const totalValues = monthlyPortfolio.map(d => d.totalValue);
    const investedValues = monthlyPortfolio.map(d => d.cumulativeInvested);

    // === 2. Calculate Annual Returns ===
    const annualReturns = {};
    monthlyPortfolio.forEach((point) => {
        const year = new Date(point.date).getFullYear();
        if (!annualReturns[year]) {
            annualReturns[year] = {
                startValue: point.totalValue,
                endValue: point.totalValue,
            };
        }
        annualReturns[year].endValue = point.totalValue;
    });

    // const years = Object.keys(annualReturns);
    // const returns = years.map(year => {
    //     const { startValue, endValue } = annualReturns[year];
    //     return ((endValue - startValue) / startValue) * 100;
    // });

    // === 3. Plot the monthly smoothed portfolio ===
    plot([
        {
            x: dates,
            y: portfolioValues,
            type: 'scatter',
            mode: 'lines',
            name: '仅TQQQ持股市值', // Portfolio Value Only
            line: { color: 'light-blue' }
        },
        {
            x: dates,
            y: cashValues,
            type: 'scatter',
            mode: 'lines',
            name: '兑现现金（已卖出）', // Cumulative Cashed Out
            line: { color: 'orange' }
        },
        {
            x: dates,
            y: totalValues,
            type: 'scatter',
            mode: 'lines',
            name: '总价值（TQQQ持股市值 + 已兑现现金）', // Total Value (Portfolio + Cashed Out)
            line: { color: 'green' }
        },
        {
            x: dates,
            y: investedValues,
            type: 'scatter',
            mode: 'lines',
            name: '累计投入本金', // 'Cumulative Invested Principal'
            line: { color: 'gray' } // Dotted line for principal
        },
        // {
        //     x: years,
        //     y: returns,
        //     type: 'bar',
        //     name: 'Annual Returns',
        //     marker: { color: 'orange' },
        //     xaxis: 'x2',
        //     yaxis: 'y2',
        // },
    ],
        {
            grid: { rows: 2, columns: 1, pattern: 'independent' },
            width: 500,
            height: 1200,
            margin: { t: 200, l: 70, r: 50, b: 70 },
            title: ' ',
            xaxis: { title: '时间' },
            yaxis: { title: '市值（美元）' }, // Portfolio Value ($)
            // xaxis2: { title: '年份' },
            // yaxis2: { title: '年度收益率 (%)' },
            legend: {
                orientation: 'h',
                y: 1.02,
                x: 0.5,
                xanchor: 'center',
                yanchor: 'bottom',
            }
        }
    );
}
