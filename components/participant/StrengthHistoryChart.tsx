import React, { useEffect, useRef } from 'react';
import { UserStrengthStat, LiftType } from '../../types';
import { Chart, registerables } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
Chart.register(...registerables);

interface StrengthHistoryChartProps {
  history: UserStrengthStat[];
}

interface ChartDataPoint {
  x: number; // ISO Date string converted to timestamp
  y: number;
}

const LIFT_CHART_CONFIG: { lift: keyof UserStrengthStat, label: string, color: string }[] = [
    { lift: 'bodyweightKg', label: 'Kroppsvikt', color: 'rgba(107, 114, 128, 0.7)' },
    { lift: 'squat1RMaxKg', label: 'Knäböj', color: 'rgba(239, 68, 68, 0.7)' },
    { lift: 'benchPress1RMaxKg', label: 'Bänkpress', color: 'rgba(59, 130, 246, 0.7)' },
    { lift: 'deadlift1RMaxKg', label: 'Marklyft', color: 'rgba(139, 92, 246, 0.7)' },
    { lift: 'overheadPress1RMaxKg', label: 'Axelpress', color: 'rgba(249, 115, 22, 0.7)' },
];

export const StrengthHistoryChart: React.FC<StrengthHistoryChartProps> = ({ history }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || history.length < 2) {
      // Don't render a chart for less than 2 data points
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy previous chart instance before creating a new one
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    
    const sortedHistory = [...history].sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime());

    const datasets = LIFT_CHART_CONFIG.map(config => {
        const data: ChartDataPoint[] = sortedHistory
            .map(stat => ({
                x: new Date(stat.lastUpdated).getTime(),
                y: stat[config.lift] as number | undefined
            }))
            .filter((point): point is ChartDataPoint => point.y !== undefined && point.y > 0);

        return {
            label: config.label,
            data: data,
            borderColor: config.color,
            backgroundColor: config.color.replace('0.7', '0.2'),
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1,
            fill: false,
        };
    }).filter(dataset => dataset.data.length > 0); // Only include datasets with data

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
                title: function(tooltipItems) {
                    if (tooltipItems.length > 0) {
                        const date = new Date(tooltipItems[0].parsed.x);
                        return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
                    }
                    return '';
                },
                label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                        label += ': ';
                    }
                    if (context.parsed.y !== null) {
                        label += context.parsed.y.toLocaleString('sv-SE') + ' kg';
                    }
                    return label;
                }
            }
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              tooltipFormat: 'yyyy-MM-dd',
              displayFormats: {
                day: 'd MMM yy'
              }
            },
            title: {
              display: true,
              text: 'Datum',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Vikt (kg)',
            },
          },
        },
      },
    });

    // Cleanup function
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [history]);
  
  if (history.length < 2) {
    return (
        <div className="text-center p-4 bg-gray-100 rounded-md">
            <p className="text-gray-600">Spara minst två mätpunkter för att se din utvecklingsgraf här.</p>
        </div>
    );
  }

  return (
    <div className="relative h-64 sm:h-80 w-full">
      <canvas ref={chartRef}></canvas>
    </div>
  );
<<<<<<< HEAD
};
=======
};
>>>>>>> origin/staging
