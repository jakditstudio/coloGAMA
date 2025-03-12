import React, { useState, useEffect } from "react";
import './History.css';

const History = () => {
    const [pdfs, setPdfs] = useState([]);
    const [error, setError] = useState(null);  //  <---  ADD THIS LINE

    useEffect(() => {
        fetch("http://localhost:8000/history")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                setPdfs(data);
                if (data.length === 0) {
                    setError("No reports found.");
                } else {
                    setError(null); // Clear any previous error
                }
            })
            .catch((err) => {
                console.error("Error fetching data history: ", err);
                setError("Failed to load reports.");
                setPdfs([]); // Clear any existing PDFs to avoid displaying old data
            });
    }, []);

    
    const handleOptionClick = (option) => {

        console.log(`${option} button clicked`);

        // Implement additional logic here based on the button clicked

    };
    
    return (
        <div className="history">
            <h2>Saved Reports</h2>
            <div className="options">

                <button className="option-button" onClick={() => handleOptionClick('PDF')}>

                    PDF

                </button>

                <button className="option-button" onClick={() => handleOptionClick('Images')}>

                    Images

                </button>

                <button className="option-button" onClick={() => handleOptionClick('Histogram')}>

                    Histogram

                </button>

            </div>
            {error ? (  // Display error message if it exists
                <p className="error">{error}</p>
            ) : (
                <ul>
                    {pdfs.map((file, index) => (
                        <li key={index}>
                            <a
                                href={`http://localhost:8000/history/${file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {file}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default History;
