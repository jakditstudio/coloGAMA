import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Add this line
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { triggerCapture, getHistory } from '../../service/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const borderColorClass = { "chart-red": "border-chart-red", 
                          "chart-green": "border-chart-green", 
                          "chart-blue": "border-chart-blue" };

const Results = () => {
   const location = useLocation();
    const navigate = useNavigate();
    const [captureData, setCaptureData] = useState(location.state?.captureData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedCapture, setSelectedCapture] = useState(0);

    // Load data from navigation state if available
    useEffect(() => {
        if (location.state?.captureData) {
            setCaptureData(location.state.captureData);
            localStorage.setItem('latestCaptureData', JSON.stringify(location.state.captureData));

        } else {
            const savedData = localStorage.getItem('latestCaptureData');
            if (savedData){
                try {
                    const parsedData = JSON.parse(savedData);
                    setCaptureData(parsedData);
                } catch (error) {
                    console.error("Error parsing saved capture data:", error);
                    setError("Failed to load saved capture data.");
                }
            } else {
                setError("No capture data available. Please capture new images.");
            }
        }
    }, [location.state]);

    // unused function for loading latest results from backend
    const loadLatestResults = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getHistory();
            setError("No capture data available. Please capture new images.");
        } catch (err) {
            console.error("Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCapture = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await triggerCapture();
            // save to local storage
            localStorage.setItem('latestCaptureData', JSON.stringify(data));
            setCaptureData(data);
            setSelectedCapture(0);
        } catch (err) {
            console.error("Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getChartData = (capture) => {
        if (!capture || !capture.histogram_data) return null;

        const labels = Array.from({ length: 256 }, (_, i) => i);

        return {
      labels,
      datasets: [
        {
          label: 'Red Channel',
          data: capture.histogram_data.red,
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderWidth: 2,
        },
        {
          label: 'Green Channel',
          data: capture.histogram_data.green,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderWidth: 2,
        },
        {
          label: 'Blue Channel',
          data: capture.histogram_data.blue,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderWidth: 2,
        },
      ],
    };
  };
    const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'RGB Histogram',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Pixel Intensity',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Pixel Count',
        },
      },
    },
  };
  const selected = captureData?.captures?.[selectedCapture];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-container mx-auto">
      <h2 className="text-2xl font-semibold text-slate-heading mb-6">Colorimetry Results</h2>

      <button
        onClick={handleCapture}
        disabled={loading}
        className="bg-primary-container text-white px-6 py-3 rounded-lg font-medium min-h-11 disabled:opacity-60 mb-4"
      >
        {loading ? "Processing..." : "Start Capture"}
      </button>

      {error && (
        <p className="text-error bg-error/10 border border-error/30 rounded-lg px-4 py-2 text-sm mb-4">
          {error}
        </p>
      )}

      {captureData && (
        <div className="flex flex-col gap-gutter">
          {/* Capture selector thumbnails */}
          <div>
            <h3 className="text-sm font-semibold text-slate-heading mb-2">Select Capture:</h3>
            <div className="flex gap-2 overflow-x-auto">
              {captureData.captures.map((capture, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedCapture(index)}
                  className={`shrink-0 w-16 h-16 rounded-lg border-2 flex items-center justify-center font-medium min-h-11 min-w-11 ${
                    selectedCapture === index
                      ? "border-primary-container bg-primary-container/10 text-primary-container"
                      : "border-border text-slate-body"
                  }`}
                >
                  C{capture.capture_number}
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="grid md:grid-cols-2 gap-gutter">
              {/* Image */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <h3 className="text-lg font-semibold text-slate-heading mb-4">Captured Image</h3>
                <img
                  src={`/api${selected.image_url}`}
                  alt={`Capture ${selectedCapture + 1}`}
                  className="rounded-lg w-full object-cover"
                />
              </div>

              {/* RGB values */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <h3 className="text-lg font-semibold text-slate-heading mb-4">RGB Values</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Red", value: selected.rgb_values.R, color: "chart-red" },
                    { label: "Green", value: selected.rgb_values.G, color: "chart-green" },
                    { label: "Blue", value: selected.rgb_values.B, color: "chart-blue" },
                  ].map((c) => (
                    <div key={c.label} className={`bg-white border-t-4 ${borderColorClass[c.color]} rounded-lg shadow-sm p-4`}>
                      <p className="text-slate-body text-sm">{c.label} Channel</p>
                      <p className="text-2xl font-bold text-slate-heading">{c.value}</p>
                    </div>
                  ))}
                </div>
                <div
                  className="w-full h-16 rounded-lg mt-4"
                  style={{ backgroundColor: `rgb(${selected.rgb_values.R}, ${selected.rgb_values.G}, ${selected.rgb_values.B})` }}
                />
              </div>

              {/* Histogram */}
              <div className="md:col-span-2 bg-white rounded-xl border border-border shadow-sm p-4">
                <h3 className="text-lg font-semibold text-slate-heading mb-4">Histogram</h3>
                {getChartData(selected) && (
                  <Line data={getChartData(selected)} options={chartOptions} />
                )}
              </div>
            </div>
          )}

          {/* PDF download */}
          <div>
            <a
              href={captureData.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary-container text-white px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2 min-h-11"
            >
              <span className="material-symbols-outlined">picture_as_pdf</span>
              Download PDF Report
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;          
