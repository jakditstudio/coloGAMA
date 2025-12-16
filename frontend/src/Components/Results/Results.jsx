import { useState, useEffect } from 'react';
import './Results.css';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, 
LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

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
        } else {
            setError("No capture data available. Please capture new images.");
        }
    }, [location.state]);

    const loadLatestResults = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8000/history');
            
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
            
            const data = await response.json();

            // For now, we'll need to modify this to get the actual capture data
            // This is a placeholder - you might want to store the last capture data
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
            const response = await fetch('http://localhost:8000/capture', {
                method: 'POST', 
            });
            if (!response.ok) throw new Error(`Error: ${response.statusText}`);
            const data = await response.json();
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

  return (
    <div className="results-container">
      <h2>Colorimetry Results</h2>
      
      <button 
        onClick={handleCapture} 
        disabled={loading}
        className="capture-button"
      >
        {loading ? "Processing..." : "Start Capture"}
      </button>

      {error && <p className="error">{error}</p>}

      {captureData && (
        <div className="results-content">
          <div className="capture-selector">
            <h3>Select Capture:</h3>
            {captureData.captures.map((capture, index) => (
              <button
                key={index}
                onClick={() => setSelectedCapture(index)}
                className={selectedCapture === index ? "active" : ""}
              >
                Capture {capture.capture_number}
              </button>
            ))}
          </div>

          {captureData.captures[selectedCapture] && (
            <div className="capture-details">
              <div className="image-section">
                <h3>Captured Image</h3>
                <img
                  src={`http://localhost:8000${captureData.captures[selectedCapture].image_url}`}
                  alt={`Capture ${selectedCapture + 1}`}
                  className="captured-image"
                />
              </div>

              <div className="rgb-values">
                <h3>RGB Values</h3>
                <div className="rgb-display">
                  <div className="rgb-value red">
                    <span className="label">R:</span>
                    <span className="value">{captureData.captures[selectedCapture].rgb_values.R}</span>
                  </div>
                  <div className="rgb-value green">
                    <span className="label">G:</span>
                    <span className="value">{captureData.captures[selectedCapture].rgb_values.G}</span>
                  </div>
                  <div className="rgb-value blue">
                    <span className="label">B:</span>
                    <span className="value">{captureData.captures[selectedCapture].rgb_values.B}</span>
                  </div>
                </div>
                
                <div 
                  className="color-preview" 
                  style={{
                    backgroundColor: `rgb(${captureData.captures[selectedCapture].rgb_values.R}, ${captureData.captures[selectedCapture].rgb_values.G}, ${captureData.captures[selectedCapture].rgb_values.B})`
                  }}
                ></div>
              </div>

              <div className="histogram-section">
                <h3>Histogram</h3>
                {getChartData(captureData.captures[selectedCapture]) && (
                  <Line 
                    data={getChartData(captureData.captures[selectedCapture])} 
                    options={chartOptions} 
                  />
                )}
              </div>
            </div>
          )}

          <div className="pdf-download">
            <a 
              href={captureData.pdf_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="download-button"
            >
              Download PDF Report
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
