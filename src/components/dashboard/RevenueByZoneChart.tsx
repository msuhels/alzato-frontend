import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PaymentListItem } from '../../services/payments';
import type { StudentListItem } from '../../services/students';
import { formatINR } from '../../lib/currency';

interface RevenueByZoneChartProps {
  payments: PaymentListItem[];
  studentMap: Map<string, StudentListItem>;
  monthStart: Date; // Filter payments to this month
}

const RevenueByZoneChart = ({ payments, studentMap, monthStart }: RevenueByZoneChartProps) => {
  const { zones, amounts, labels } = useMemo(() => {
    const zoneTotals: Record<string, number> = {};
    const targetYear = monthStart.getFullYear();
    const targetMonth = monthStart.getMonth();

    payments.forEach(p => {
      const d = new Date(p.installment_date);
      if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonth) return;
      const student = studentMap.get(String(p.student_id));
      const zone = (student?.zone || 'Unknown').trim() || 'Unknown';
      zoneTotals[zone] = (zoneTotals[zone] || 0) + (p.amount || 0);
    });
    const entries = Object.entries(zoneTotals).sort((a, b) => b[1] - a[1]);
    const zones = entries.map(([zone]) => zone);
    const amounts = entries.map(([, total]) => total);
    const labels = entries.map(([zone, total]) => `${zone} - ${formatINR(total).replace(/\.00$/, '')}`);
    return { zones, amounts, labels };
  }, [payments, studentMap]);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => `${params[0].axisValue}<br/>${formatINR(params[0].value)}`,
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        data: labels,
        axisTick: { alignWithLabel: true },
        axisLine: { show: false },
        axisLabel: { color: '#6B7280' },
      },
    ],
    yAxis: [
      {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatINR(value).replace(/\.00$/, ''),
          color: '#6B7280',
        },
        splitLine: { lineStyle: { color: '#E5E7EB' } },
      },
    ],
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        barWidth: '40%',
        data: amounts,
        itemStyle: { color: '#6D28D9', borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

export default RevenueByZoneChart;


