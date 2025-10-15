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

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'center',
      textStyle: {
        color: '#4B5563'
      }
    },
    series: [
      {
        name: 'Students by Zone',
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['70%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '20',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
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

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

export default StudentsByZoneChart;
