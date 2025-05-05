import { plot } from 'nodeplotlib';
import { START_DATE, END_DATE } from '../index.js';

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


export function plotPortfolio(dailyPortfolio, summaryStats) {
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

    const { finalValue, multiple, maxDrawdown, sharpeRatio, totalInvested, annualReturn } = summaryStats;

    // const years = Object.keys(annualReturns);
    // const returns = years.map(year => {
    //     const { startValue, endValue } = annualReturns[year];
    //     return ((endValue - startValue) / startValue) * 100;
    // });

    // === 3. Plot the monthly smoothed portfolio ===

    plot([
        {
            x: dates,
            y: investedValues,
            type: 'scatter',
            mode: 'lines',
            name: '累计投入',
            line: { color: '#AAAAAA', dash: 'dot', width: 2 },
        },
        {
            x: dates,
            y: portfolioValues,
            type: 'scatter',
            mode: 'lines',
            name: 'TQQQ持仓', // Portfolio Value Only
            line: { color: '#1f77b4', width: 2 }
        },
        {
            x: dates,
            y: cashValues,
            type: 'scatter',
            mode: 'lines',
            name: '累计卖出', // Cumulative Cashed Out
            line: { color: '#ff7f0e', width: 2 }
        },
        {
            x: dates,
            y: totalValues,
            type: 'scatter',
            mode: 'lines',
            name: '总资产（TQQQ持仓 + 累计卖出）', // Total Value (Portfolio + Cashed Out)
            line: { color: '#2ca02c', width: 2 }
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
            grid: {
                // rows: 2,
                rows: 1,
                columns: 1,
                pattern: 'independent',
            },
            width: 500,
            height: 750,
            margin: { t: 200, l: 70, r: 50, b: 200 },
            title: '',
            annotations: [
                // Main Title (bold, big)
                {
                    text: `TQQQ 动态定投回测`,
                    font: { size: 24, color: 'black' },
                    showarrow: false,
                    align: 'center',
                    x: 0.5,
                    y: 1.35, // higher up
                    xref: 'paper',
                    yref: 'paper',
                    xanchor: 'center',
                    yanchor: 'top'
                },
                // Sub-title (date range, medium size)
                {
                    text: `（${START_DATE.replace(/-/g, '/')} – ${END_DATE.replace(/-/g, '/')}）`,
                    font: { size: 16, color: 'gray' },
                    showarrow: false,
                    align: 'center',
                    x: 0.5,
                    y: 1.25, // slightly lower
                    xref: 'paper',
                    yref: 'paper',
                    xanchor: 'center',
                    yanchor: 'top'
                },
                // Metrics Title Row
                {
                    text: `&nbsp;&nbsp;&nbsp;&nbsp;本金 ｜ 总资产 ｜ 涨幅倍数 ｜ 年化收益 ｜ 最大跌幅 ｜ Sharpe&nbsp;`,
                    font: { size: 13, color: 'black' },
                    showarrow: false,
                    align: 'center',
                    x: 0.5,
                    y: 1.16,
                    xref: 'paper',
                    yref: 'paper',
                    xanchor: 'center',
                    yanchor: 'top'
                },
                // Metrics Value Row
                {
                    text: `$${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}｜$${finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}｜${multiple.toFixed(1)}倍｜${(annualReturn * 100).toFixed(2)}%｜${(maxDrawdown * 100).toFixed(2)}%｜${sharpeRatio.toFixed(2)}`,
                    font: { size: 13, color: 'black' },
                    showarrow: false,
                    align: 'center',
                    x: 0.5,
                    y: 1.1,
                    xref: 'paper',
                    yref: 'paper',
                    xanchor: 'center',
                    yanchor: 'top'
                }
            ],
            xaxis: {
                title: {
                    text: '时间',
                    font: { size: 16, color: 'black' }
                },
                tickfont: { size: 14 }
            },
            yaxis: {
                title: {
                    text: '市值',
                    font: { size: 16, color: 'black' },
                },
                tickfont: { size: 14, family: 'Arial', color: '#333' }
            },
            // xaxis2: { title: '年份' },
            // yaxis2: { title: '年度收益率 (%)' },
            legend: {
                orientation: 'h',
                y: -0.45,
                x: 0.25,
                xanchor: 'center',
                yanchor: 'bottom',
                font: { size: 13 }
            },
            layout: {
                xaxis: {
                    gridcolor: '#eee'
                },
                yaxis: {
                    gridcolor: '#eee'
                }
            }
        }
    );
}
