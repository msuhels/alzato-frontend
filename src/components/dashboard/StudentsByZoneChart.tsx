import React from 'react';
import ReactECharts from 'echarts-for-react';
interface ZoneStudent { zone?: string }
interface StudentsByZoneChartProps { students: ZoneStudent[] }

const StudentsByZoneChart = ({ students }: StudentsByZoneChartProps) => {
  const processData = () => {
    const zoneCounts = students.reduce((acc, student) => {
      const key = student.zone || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(zoneCounts).map(([name, value]) => ({ name, value }));
  };

  const data = processData();

  const legendFormatter = (name: string) => {
    const item = data.find(d => d.name === name);
    return item ? `${name} (${item.value})` : name;
  };

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center',
      formatter: legendFormatter,
      textStyle: {
        color: '#4B5563'
      }
    },
    series: [
      {
        name: 'Students by Zone',
        type: 'pie',
        radius: ['45%', '65%'],
        center: ['70%', '50%'],
        avoidLabelOverlap: true,
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold',
            formatter: '{b}: {c}',
          }
        },
        labelLine: {
          show: false,
        },
        data: data,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2
        }
      }
    ],
    color: ['#F97316', '#1E3A8A', '#6D28D9', '#10B981', '#EF4444']
  };

  return <ReactECharts option={option} style={{ height: '260px' }} />;
};

export default StudentsByZoneChart;
