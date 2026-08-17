import { useState } from 'react';
import './Hero.css';
import arrow from '../../assets/arrow.png';
import { Link, useNavigate } from 'react-router-dom';
import { triggerCapture } from '../../service/api';

const Hero = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleRunColometry = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await triggerCapture();

      // save to local storage
      localStorage.setItem('latestCapture', JSON.stringify(data));

      navigate('/results', { state: { captureData: data } });
    } catch (err) {
      console.error("Error capturing image", err);
      setError(err.message);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  return (
    <div className='hero container'>
      <div className="hero-text">
        <h1>Explore Your Color</h1>
        <p>This project focused on developing an image processing system for RGB color-based chemical identification,
          involving hardware design, software development, and system integration on a Raspberry Pi.</p>
        {/* Use Link instead of anchor tag */}
        <button className='btn-utama' onClick={handleRunColometry} disabled={loading}>
          {loading ? "Capturing..." : "CAPTURE COLOR"} <img src={arrow} alt="" />
        </button>
        {error && <p className="error-banner">{error}</p>}
      </div>
    </div>
  );
};

export default Hero;