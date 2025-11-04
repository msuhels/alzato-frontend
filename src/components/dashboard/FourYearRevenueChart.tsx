import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { formatINR } from '../../lib/currency';

type RevenueItem = { date: string; amount: number };

interface FourYearRevenueChartProps {
  payments: RevenueItem[];
  payouts?: RevenueItem[];
  onYearSelect?: (year: number) => void;
}

const FourYearRevenueChart = ({ payments, payouts = [], onYearSelect }: FourYearRevenueChartProps) => {
  const { years, data } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear];

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

    const receivedByYear: Record<number, number> = Object.fromEntries(years.map(y => [y, 0]));
    const payoutByYear: Record<number, number> = Object.fromEntries(years.map(y => [y, 0]));

    payments.forEach(p => {
      const d = parseDateLocal(p.date);
      const y = d.getFullYear();
      if (!receivedByYear.hasOwnProperty(y)) return;
      receivedByYear[y] += p.amount || 0;
    });
    payouts.forEach(p => {
      const d = parseDateLocal(p.date);
      const y = d.getFullYear();
      if (!payoutByYear.hasOwnProperty(y)) return;
      payoutByYear[y] += p.amount || 0;
    });

    const data = years.map(y => Math.max(0, (receivedByYear[y] || 0) - (payoutByYear[y] || 0)));
    return { years, data };
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
      },
    },
    grid: { left: '2%', right: '2%', bottom: '6%', containLabel: true },
    xAxis: [{
      type: 'category',
      data: years.map(String),
      axisTick: { alignWithLabel: true },
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' },
      triggerEvent: true,
    }],
    yAxis: [{
      type: 'value',
      axisLabel: { formatter: (v: number) => formatINR(v).replace(/\.00$/, ''), color: '#6B7280' },
      splitLine: { lineStyle: { color: '#E5E7EB' } },
    }],
    series: [{
      name: 'Net Revenue',
      type: 'bar',
      barWidth: '45%',
      data,
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(109,40,217,0.9)' },
            { offset: 1, color: 'rgba(109,40,217,0.4)' },
          ],
        },
        shadowBlur: 6,
        shadowColor: 'rgba(109,40,217,0.25)',
      },
      emphasis: { focus: 'series' },
    }],
  } as const;

  const onEvents = {
    click: (params: any) => {
      if (!onYearSelect) return;
      let index: number | undefined = params?.dataIndex;
      if ((index == null || index === -1) && params?.componentType === 'xAxis') {
        const label = params?.value;
        const i = years.map(String).indexOf(label);
        if (i !== -1) index = i;
      }
      if (index == null || index === -1) return;
      const y = years[index];
      if (typeof y === 'number') onYearSelect(y);
    },
  } as any;

  return <ReactECharts option={option} onEvents={onEvents} style={{ height: '300px' }} />;
};

export default FourYearRevenueChart;


