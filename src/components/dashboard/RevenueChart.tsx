import React, { useMemo } from 'react';
import { formatINR } from '../../lib/currency';
import ReactECharts from 'echarts-for-react';
interface RevenueItem { date: string; amount: number }
<<<<<<< HEAD
interface RevenueChartProps { payments: RevenueItem[]; payouts?: RevenueItem[]; onMonthSelect?: (monthStart: Date) => void }

const RevenueChart = ({ payments, payouts = [], onMonthSelect }: RevenueChartProps) => {
  const { labels, data, keys } = useMemo(() => {
    const parseDateLocal = (input: string) => {
      // Ensure month bucketing is done in local time to avoid UTC shifts
      // Accepts formats like YYYY-MM-DD or full ISO strings
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(input);
      if (m) {
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        return new Date(year, month - 1, day);
      }
      const d = new Date(input);
      if (Number.isNaN(d.getTime())) return new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // 1) Aggregate received and payout amounts by month key
    const receivedByKey: Record<string, number> = {};
    const payoutByKey: Record<string, number> = {};
=======
interface RevenueChartProps { payments: RevenueItem[]; onMonthSelect?: (monthStart: Date) => void }

const RevenueChart = ({ payments, onMonthSelect }: RevenueChartProps) => {
  const { labels, data, keys } = useMemo(() => {
    const monthlyRevenue: { [key: string]: number } = {};
    const labels: string[] = [];
    const keys: string[] = [];
    // Initialize last 6 months, oldest to newest
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short' });
      monthlyRevenue[monthKey] = 0;
      labels.push(monthLabel);
      keys.push(monthKey);
    }
>>>>>>> a7da6da89d3c2635f5fc6948ca3a58127d47ccba
    payments.forEach(p => {
      const d = parseDateLocal(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      receivedByKey[key] = (receivedByKey[key] || 0) + (p.amount || 0);
    });
    payouts.forEach(p => {
      const d = parseDateLocal(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      payoutByKey[key] = (payoutByKey[key] || 0) + (p.amount || 0);
    });
<<<<<<< HEAD

    // 2) Determine the last 6 calendar months window
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    // 3) Choose months within the window that actually have activity (>0)
    const unionKeys = Array.from(new Set([...Object.keys(receivedByKey), ...Object.keys(payoutByKey)]));
    const presentKeys = unionKeys.filter(k => {
      const [y, m] = k.split('-').map(n => Number(n));
      const d = new Date(y, m - 1, 1);
      const net = (receivedByKey[k] || 0) - (payoutByKey[k] || 0);
      return d >= windowStart && d <= windowEnd && net !== 0;
    });

    // 4) If no data in window, fall back to the empty 6-month window (zeros)
    const finalKeys: string[] = presentKeys.length > 0 ? presentKeys : (() => {
      const arr: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      return arr;
    })();

    // 5) Sort chronologically
    finalKeys.sort((a, b) => {
      const [ya, ma] = a.split('-').map(n => Number(n));
      const [yb, mb] = b.split('-').map(n => Number(n));
      return new Date(ya, ma - 1, 1).getTime() - new Date(yb, mb - 1, 1).getTime();
    });

    // 6) Labels; include year suffix only if duplicate month names exist
    const monthName = (k: string) => {
      const [y, m] = k.split('-').map(n => Number(n));
      return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' });
    };
    const names = finalKeys.map(monthName);
    const hasDup = new Set(names).size !== names.length;
    const labels = finalKeys.map(k => {
      const [y] = k.split('-').map(n => Number(n));
      const base = monthName(k);
      return hasDup ? `${base} '${String(y).slice(-2)}` : base;
    });

    // 6) Net amounts per month (received - payout)
    const data = finalKeys.map(k => (receivedByKey[k] || 0) - (payoutByKey[k] || 0));
    const keys = finalKeys;

    return { labels, data, keys };
  }, [payments, payouts]);
=======
    return { labels, data: Object.values(monthlyRevenue), keys };
  }, [payments]);
>>>>>>> a7da6da89d3c2635f5fc6948ca3a58127d47ccba

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#111827',
      borderColor: '#111827',
      textStyle: { color: '#F9FAFB' },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        return `${p.axisValueLabel}<br/>${formatINR(p.value)}`;
      }
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '6%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'category',
        data: labels,
        triggerEvent: true,
        axisTick: { alignWithLabel: true },
        axisLine: { lineStyle: { color: '#E5E7EB' } },
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
        name: 'Net Revenue',
        type: 'bar',
        barWidth: '45%',
        data: data,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(109,40,217,0.9)' },
              { offset: 1, color: 'rgba(109,40,217,0.4)' },
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(109,40,217,0.25)'
        },
        emphasis: { focus: 'series' }
      }
    ]
  };

  const onEvents = {
    click: (params: any) => {
      if (!onMonthSelect) return;
<<<<<<< HEAD
      let index: number | undefined = params?.dataIndex;
      // Also support clicking on the x-axis label (month name)
      if ((index == null || index === -1) && params?.componentType === 'xAxis') {
        const label = params?.value;
        const i = labels.indexOf(label);
        if (i !== -1) index = i;
      }
      if (index == null || index === -1) return;
=======
      const index: number = params?.dataIndex;
      if (index == null) return;
>>>>>>> a7da6da89d3c2635f5fc6948ca3a58127d47ccba
      const key = keys[index];
      if (!key) return;
      const [year, month] = key.split('-').map(n => Number(n));
      const monthStart = new Date(year, month - 1, 1);
      onMonthSelect(monthStart);
    }
  } as any;

  return <ReactECharts option={option} onEvents={onEvents} style={{ height: '300px' }} />;
};

export default RevenueChart;
