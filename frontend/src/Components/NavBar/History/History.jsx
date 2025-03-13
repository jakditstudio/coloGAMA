import { useState, useEffect } from "react";
import "./History.css";

const History = () => {
  const [files, setFiles] = useState({ pdfs: [], images: [], histograms: [] });
  const [selectedType, setSelectedType] = useState("pdfs");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/history")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFiles(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setError("Failed to load reports");
        setFiles({ pdfs: [], images: [], histograms: [] });
      });
  }, []);

  const handleOptionClick = (type) => {
    setSelectedType(type);
    if (files[type].length === 0) {
      setError(`No ${type} found`);
    } else {
      setError(null);
    }
  };

  return (
    <div className="history">
      <h2>Saved Reports</h2>
      <div className="options">
        <button
          className={`option-button ${selectedType === "pdfs" ? "active" : ""}`}
          onClick={() => handleOptionClick("pdfs")}
        >
          PDF
        </button>
        <button
          className={`option-button ${
            selectedType === "images" ? "active" : ""
          }`}
          onClick={() => handleOptionClick("images")}
        >
          Images
        </button>
        <button
          className={`option-button ${
            selectedType === "histograms" ? "active" : ""
          }`}
          onClick={() => handleOptionClick("histograms")}
        >
          Histogram
        </button>
      </div>

      <div className={`file-container ${selectedType}`}>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <ul>
            {files[selectedType].map((file, index) => (
              <li key={index}>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default History;
