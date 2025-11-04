import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatINR } from '../../lib/currency';

type RevenueItem = { date: string; amount: number };

interface YearlyRevenueChartProps {
  payments: RevenueItem[];
  payouts?: RevenueItem[];
  onMonthSelect?: (monthStart: Date) => void;
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const YearlyRevenueChart = ({ payments, payouts = [], onMonthSelect }: YearlyRevenueChartProps) => {
  const { labels, netData, keys } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();

    const parseDateLocal = (input: string) => {
      const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(input);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        return new Date(y, mo - 1, d);
      }
      const d = new Date(input);
      if (Number.isNaN(d.getTime())) return new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const receivedByMonth: number[] = Array(12).fill(0);
    const payoutByMonth: number[] = Array(12).fill(0);

    payments.forEach(p => {
      const d = parseDateLocal(p.date);
      if (d.getFullYear() !== year) return;
      const mi = d.getMonth();
      receivedByMonth[mi] += p.amount || 0;
    });
    payouts.forEach(p => {
      const d = parseDateLocal(p.date);
      if (d.getFullYear() !== year) return;
      const mi = d.getMonth();
      payoutByMonth[mi] += p.amount || 0;
    });

    const netData = receivedByMonth.map((v, i) => Math.max(0, v - payoutByMonth[i]));
    const labels = monthLabels;
    const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    return { labels, netData, keys };
  }, [payments, payouts]);

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
    grid: { left: '2%', right: '2%', bottom: '6%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        data: labels,
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
        splitLine: { lineStyle: { color: '#E5E7EB' } }
      }
    ],
    series: [
      {
        name: 'Net Revenue',
        type: 'bar',
        barWidth: '45%',
        data: netData,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(29,78,216,0.9)' },
              { offset: 1, color: 'rgba(29,78,216,0.35)' }
            ]
          },
          shadowBlur: 6,
          shadowColor: 'rgba(29,78,216,0.25)'
        },
        emphasis: { focus: 'series' }
      }
    ]
  };

  const onEvents = {
    click: (params: any) => {
      if (!onMonthSelect) return;
      let index: number | undefined = params?.dataIndex;
      if ((index == null || index === -1) && params?.componentType === 'xAxis') {
        const label = params?.value;
        const i = labels.indexOf(label);
        if (i !== -1) index = i;
      }
      if (index == null || index === -1) return;
      const key = keys[index];
      if (!key) return;
      const [yearStr, monthStr] = key.split('-');
      const monthStart = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      onMonthSelect(monthStart);
    }
  };

  return <ReactECharts option={option} onEvents={onEvents} style={{ height: '300px' }} />;
};

export default YearlyRevenueChart;


