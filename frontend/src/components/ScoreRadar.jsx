
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Radar } from "react-chartjs-2";
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

function toRadarData(scores) {
  const { Depth=70, Metrics=60, Structure=65, Clarity=80 } = scores || {};
  return {
    labels: ["Depth", "Metrics", "Structure", "Clarity"],
    datasets: [
      {
        label: "Score",
        data: [Depth, Metrics, Structure, Clarity],
        fill: true,
      },
    ],
  };
}

const ScoreRadar = forwardRef(function ScoreRadar({ scores }, ref) {
  const chartRef = useRef(null);

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      const chart = chartRef.current;
      if (!chart) return null;
      return chart.canvas.toDataURL("image/png", 1.0);
    }
  }));

  const data = toRadarData(scores);
  const options = {
    responsive: true,
    scales: {
      r: {
        suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 20, showLabelBackdrop: false }
      }
    },
    plugins: { legend: { display: false } }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8, fontWeight: 900 }}>Scorecard (Radar)</h3>
      <Radar ref={chartRef} data={data} options={options} />
    </div>
  );
});

export default ScoreRadar;
