import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerCapture } from '../../service/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // state variables for handling live feed
  const [feedError, setFeedError] = useState(null);
  const [feedLoaded, setFeedLoaded] = useState(false);

  const handleFeedError = () => {
    setFeedError(true);
    setFeedLoaded(false);
  };
  
  const handleFeedLoad = () => {
    setFeedError(false);
    setFeedLoaded(true);
  };

  const handleRunColometry = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await triggerCapture();
      localStorage.setItem('latestCapture', JSON.stringify(data));
      navigate('/results', { state: { captureData: data } });
    } catch (err) {
      console.error("Error capturing image", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-margin-mobile md:p-margin-desktop flex flex-col items-center justify-center gap-gutter">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-gutter">
        {/* Camera Preview */}
        <div className="flex-1 bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-4 border border-border flex flex-col relative aspect-[4/3] md:aspect-auto md:min-h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-heading">Live Feed</h2>
            <span className="bg-surface-container text-primary text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success inline-block" /> Live
            </span>
          </div>
          <div className="flex-1 bg-surface-dim rounded-lg overflow-hidden relative flex items-center justify-center border border-dashed border-outline-variant">
            <div className="z-10 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-2">linked_camera</span>
              <p className="text-on-surface-variant">Camera Feed Offline</p>
              <p className="text-sm text-slate-body mt-1">Connect device to begin</p>
            </div>
            <img
              src="/api/stream"
              alt="Live Camera Feed"
              className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-500 ${feedLoaded && !feedError ? 'opacity-100' : 'opacity-0'}`}
              onError={handleFeedError}
              onLoad={handleFeedLoad}
            />
          </div>
        </div>

        {/* Controls & Status */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          <div className="bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-6 border border-border flex flex-col items-center text-center">
            <button
              onClick={handleRunColometry}
              disabled={loading}
              className="pulse-ring w-32 h-32 rounded-full bg-primary-container text-on-primary-container flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 mb-4 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-4xl">photo_camera</span>
            </button>
            <h3 className="text-xl font-semibold text-slate-heading mb-1">
              {loading ? "Capturing..." : "START CAPTURE"}
            </h3>
            <p className="text-sm text-slate-body">Initiate colorimetric analysis</p>
            {error && (
              <p className="text-error bg-error/10 border border-error/30 rounded-lg px-4 py-2 text-sm mt-4">
                {error}
              </p>
            )}
          </div>

          {/* System Status — static/decorative, no backend endpoint provides this today */}
          <div className="bg-pure-white rounded-xl shadow-[0_4px_10px_rgba(0,0,0,0.12)] p-6 border border-border flex-1">
            <h3 className="text-xs font-semibold text-slate-heading mb-4 uppercase tracking-wider">System Status</h3>
            <div className="flex flex-col gap-4">
              {[
                { icon: "developer_board", label: "Hardware", status: "Ready", color: "text-primary" },
                { icon: "lightbulb", label: "Lighting", status: "Optimized", color: "text-warning" },
                { icon: "wifi", label: "Connection", status: "Active", color: "text-chart-blue" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-surface-dim border border-border">
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                    <span className="text-on-surface">{s.label}</span>
                  </div>
                  <span className="bg-success-bg text-success-text text-xs font-medium px-2 py-1 rounded-full">{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;