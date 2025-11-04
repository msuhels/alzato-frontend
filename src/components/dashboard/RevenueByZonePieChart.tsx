import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PaymentListItem } from '../../services/payments';
import type { StudentListItem } from '../../services/students';
import { formatINR } from '../../lib/currency';

interface RevenueByZonePieChartProps {
  payments: PaymentListItem[];
  studentMap: Map<string, StudentListItem>;
  monthStart?: Date; // if provided, aggregates for that month
  year?: number;     // if provided (and monthStart not provided), aggregates for that year
}

const RevenueByZonePieChart = ({ payments, studentMap, monthStart, year }: RevenueByZonePieChartProps) => {
  const { data, byZoneNet, byZoneReceived, byZonePayout, colors } = useMemo(() => {
    const parseDateLocal = (input: string) => {
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
    const byZoneReceived: Record<string, number> = {};
    const byZonePayout: Record<string, number> = {};
    const byZoneNet: Record<string, number> = {};
    const now = new Date();
    const y = (monthStart ? monthStart.getFullYear() : (year ?? now.getFullYear()));
    const m = monthStart?.getMonth();

    payments.forEach(p => {
      const d = parseDateLocal(p.installment_date);
      // If monthStart provided: filter by that month; else include whole selected year
      if (monthStart) {
        if (d.getFullYear() !== y || d.getMonth() !== m) return;
      } else {
        if (d.getFullYear() !== y) return;
      }
      const student = studentMap.get(String(p.student_id));
      const zone = (student?.zone || 'Unknown').trim() || 'Unknown';
      const isPayout = (p.payment_type || '').toLowerCase() === 'payout';
      const amt = Number(p.amount) || 0;
      if (isPayout) {
        byZonePayout[zone] = (byZonePayout[zone] || 0) + amt;
      } else {
        byZoneReceived[zone] = (byZoneReceived[zone] || 0) + amt;
      }
    });

    // Compute net per zone
    const zones = new Set<string>([...Object.keys(byZoneReceived), ...Object.keys(byZonePayout)]);
    zones.forEach(zone => {
      const net = (byZoneReceived[zone] || 0) - (byZonePayout[zone] || 0);
      byZoneNet[zone] = net;
    });

    const data = Object.entries(byZoneNet)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Curated, high-contrast palette with deterministic mapping
    const hash = (str: string) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
      return Math.abs(h);
    };
    const palette = [
      '#6D28D9', '#7C3AED', '#3B82F6', '#1E40AF', '#0EA5E9', '#38BDF8',
      '#F97316', '#F59E0B', '#EF4444', '#DC2626', '#A855F7', '#9333EA',
      '#10B981', '#059669', '#14B8A6', '#0D9488', '#F43F5E', '#BE185D'
    ];
    const colors = data.map(d => palette[hash(d.name) % palette.length]);

    return { data, byZoneNet, byZoneReceived, byZonePayout, colors };
  }, [payments, studentMap, monthStart, year]);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const name = p.name as string;
        const received = byZoneReceived[name] || 0;
        const payout = byZonePayout[name] || 0;
        const net = byZoneNet[name] || 0;
        return `${name}<br/>Net: ${formatINR(net)}<br/>Received: ${formatINR(received)}<br/>Payout: -${formatINR(payout)}`;
      },
    },
    legend: {
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: '#4B5563' },
      formatter: (name: string) => {
        const value = byZoneNet[name] || 0;
        return `${name} - ${formatINR(value).replace(/\\.00$/, '')}`;
      },
    },
    series: [
      {
        name: 'Revenue by Zone',
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: {
          scale: true,
          scaleSize: 8,
          label: { show: true, fontSize: 18, fontWeight: 'bold' }
        },
        labelLine: { show: false },
        data,
        itemStyle: { borderColor: '#fff', borderWidth: 2, shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.08)' },
      },
    ],
    color: colors,
  };

  return <ReactECharts option={option} style={{ height: '340px' }} />;
};

export default RevenueByZonePieChart;


