import { useState, useEffect } from "react";
import "./History.css";

const History = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, pdf, image, histogram

  useEffect(() => {
    fetch("http://localhost:8000/history")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Transform the data into a flat table format
        const tableData = [];
        
        // Add PDFs
        data.pdfs.forEach((file, index) => {
          tableData.push({
            id: `pdf-${index}`,
            type: "PDF",
            name: file.name,
            url: file.url,
            timestamp: extractTimestamp(file.name),
          });
        });

        // Add Images
        data.images.forEach((file, index) => {
          tableData.push({
            id: `img-${index}`,
            type: "Image",
            name: file.name,
            url: file.url,
            timestamp: extractTimestamp(file.name),
          });
        });

        // Add Histograms
        data.histograms.forEach((file, index) => {
          tableData.push({
            id: `hist-${index}`,
            type: "Histogram",
            name: file.name,
            url: file.url,
            timestamp: extractTimestamp(file.name),
          });
        });

        // Sort by timestamp (newest first)
        tableData.sort((a, b) => b.timestamp - a.timestamp);

        setHistoryData(tableData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setError("Failed to load history");
        setLoading(false);
      });
  }, []);

  const extractTimestamp = (filename) => {
    // Extract timestamp from filename (format: name_YYYYMMDD_HHMMSS.ext)
    const match = filename.match(/(\d{8}_\d{6})/);
    if (match) {
      const dateStr = match[1];
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(9, 11);
      const minute = dateStr.substring(11, 13);
      const second = dateStr.substring(13, 15);
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
    return new Date();
  };

  const formatDate = (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFilteredData = () => {
    if (selectedFilter === "all") return historyData;
    return historyData.filter(item => item.type.toLowerCase() === selectedFilter);
  };

  const handleView = (item) => {
    if (item.type === "PDF") {
      window.open(item.url, "_blank");
    } else {
      // Open image/histogram in modal or new tab
      window.open(item.url, "_blank");
    }
  };

  const handleDownload = (item) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h1>Capture History</h1>
        <p>View and download your previous colorimetry captures</p>
      </div>

      <div className="filter-tabs">
        <button
          className={selectedFilter === "all" ? "active" : ""}
          onClick={() => setSelectedFilter("all")}
        >
          All Files ({historyData.length})
        </button>
        <button
          className={selectedFilter === "pdf" ? "active" : ""}
          onClick={() => setSelectedFilter("pdf")}
        >
          PDFs ({historyData.filter(i => i.type === "PDF").length})
        </button>
        <button
          className={selectedFilter === "image" ? "active" : ""}
          onClick={() => setSelectedFilter("image")}
        >
          Images ({historyData.filter(i => i.type === "Image").length})
        </button>
        <button
          className={selectedFilter === "histogram" ? "active" : ""}
          onClick={() => setSelectedFilter("histogram")}
        >
          Histograms ({historyData.filter(i => i.type === "Histogram").length})
        </button>
      </div>

      <div className="table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>File Name</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredData().length === 0 ? (
              <tr>
                <td colSpan="4" className="no-data">
                  No files found
                </td>
              </tr>
            ) : (
              getFilteredData().map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`badge badge-${item.type.toLowerCase()}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="file-name">{item.name}</td>
                  <td>{formatDate(item.timestamp)}</td>
                  <td className="actions">
                    <button
                      className="action-btn view-btn"
                      onClick={() => handleView(item)}
                      title="View"
                    >
                      👁️ View
                    </button>
                    <button
                      className="action-btn download-btn"
                      onClick={() => handleDownload(item)}
                      title="Download"
                    >
                      ⬇️ Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default History;