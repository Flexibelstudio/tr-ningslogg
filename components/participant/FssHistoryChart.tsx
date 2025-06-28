import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { FLEXIBEL_PRIMARY_COLOR } from '../../constants';

// Chart.js components are already registered in StrengthHistoryChart, but it's safe to do it again.
Chart.register(...registerables);

interface FssDataPoint {
  date: string;
  score: number;
}

interface FssHistoryChartProps {
  history: FssDataPoint[];
}

export const FssHistoryChart: React.FC<FssHistoryChartProps> = ({ history }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current || history.length < 2) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      return;
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData = sortedHistory.map(stat => ({
        x: new Date(stat.date).getTime(),
        y: stat.score
    }));

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
            label: 'FSS',
            data: chartData,
            borderColor: FLEXIBEL_PRIMARY_COLOR,
            backgroundColor: FLEXIBEL_PRIMARY_COLOR.replace('1', '0.2'),
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1,
            fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false, // Hide legend as there's only one dataset
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
                        label += context.parsed.y.toLocaleString('sv-SE');
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
            // FSS is usually around 80, so starting at zero can make the graph flat.
            // Let chart.js decide the best start value.
            // beginAtZero: false, 
            title: {
              display: true,
              text: 'Poäng',
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [history]);
  
  // This component will only be rendered if history.length > 1, so no need for this check here, but it's good practice.
  if (history.length < 2) {
    return null;
  }

  return (
    <div className="relative h-48 w-full mt-4">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};