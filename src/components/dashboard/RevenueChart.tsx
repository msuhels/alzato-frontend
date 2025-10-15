import React from 'react';
import { formatINR } from '../../lib/currency';
import ReactECharts from 'echarts-for-react';
interface RevenueItem { date: string; amount: number }
interface RevenueChartProps { payments: RevenueItem[] }

const RevenueChart = ({ payments }: RevenueChartProps) => {
  const processData = () => {
    const monthlyRevenue: { [key: string]: number } = {};
    const monthLabels: string[] = [];
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      monthlyRevenue[monthKey] = 0;
      if (!monthLabels.includes(monthLabel)) {
          monthLabels.push(monthLabel);
      }
    }

    payments.forEach(p => {
      const paymentDate = new Date(p.date);
      const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey in monthlyRevenue) {
        monthlyRevenue[monthKey] += p.amount;
      }
    });

    return {
      labels: monthLabels,
      data: Object.values(monthlyRevenue),
    };
  };

  const { labels, data } = processData();

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => formatINR(params[0].value)
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        data: labels,
        axisTick: { alignWithLabel: true },
        axisLine: { show: false },
        axisLabel: { color: '#6B7280' }
      }
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
            formatter: (value: number) => formatINR(value).replace(/\.00$/, ''),
            color: '#6B7280'
        },
        splitLine: {
            lineStyle: {
                color: '#E5E7EB'
            }
        }
      }
    ],
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        barWidth: '40%',
        data: data,
        itemStyle: {
          color: '#6D28D9',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

export default RevenueChart;
