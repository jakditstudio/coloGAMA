import { useState } from 'react';
import './Hero.css';
import arrow from '../../assets/arrow.png';
// import { Link } from 'react-router-dom'; // Import Link

const Hero = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRunColometry = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:8000/capture", {
        method: "POST", // Corrected to a string
      });

      if (response.ok) {
        const data = await response.json();
        alert("Image has been captured");
        // You can also handle the data returned from the API here if needed
      } else {
        alert("Capture failed!");
      }
    } catch (error) {
      console.error("Error capturing image", error);
      alert("An error occurred while capturing the image.");
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
      </div>
    </div>
  );
};

export default Hero;