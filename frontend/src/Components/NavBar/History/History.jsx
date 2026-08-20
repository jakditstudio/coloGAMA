import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { getHistory } from "../../../service/api";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// set pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
// pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

const History = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all"); // all, pdf, image, histogram

  const [viewModal, setViewModal] = useState(null); // for viewing images/histograms, files

  // pdf viewer state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    getHistory()
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
        setError(err.message);
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
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // i think i should adjust the logic here, becaause today is yesterday (gets rounded up to 1 day), and yesterday is also 1 day (rounded up from 0.5 days)
    
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
   setViewModal(item);
   setPageNumber(1);
   setNumPages(null);
   setUseFallback(false);
  };

  const closeModal = () => {
    setViewModal(null);
    setPageNumber(1);
    setNumPages(null);
    setUseFallback(false);
  }

  const handleDownload = (item) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // pdf viewer handlers
  const onDocumentLoadSuccess = ({numPages}) => {
    setNumPages(numPages);
    setUseFallback(false);
  }

  const onDocumentLoadError = (error) => {
    console.error("Error loading PDF:", error);
    setUseFallback(true); // switch to iframe fallback
  }

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }

  const previousPage = () => {
    changePage(-1);
  }
  const nextPage = () => {
    changePage(1);
  }

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-container mx-auto">
        <div className="text-slate-body">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-container mx-auto">
        <p className="text-error bg-error/10 border border-error/30 rounded-lg px-4 py-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-container mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-heading">Capture History</h1>
        <p className="text-slate-body">View and download your previous colorimetry captures</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { key: "all", label: `All Files (${historyData.length})` },
          { key: "pdf", label: `PDFs (${historyData.filter(i => i.type === "PDF").length})` },
          { key: "image", label: `Images (${historyData.filter(i => i.type === "Image").length})` },
          { key: "histogram", label: `Histograms (${historyData.filter(i => i.type === "Histogram").length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setSelectedFilter(f.key)}
            className={`px-4 py-2 rounded-full min-h-11 text-sm font-medium ${
              selectedFilter === f.key ? "bg-primary-container text-white" : "bg-surface-dim text-slate-body"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 text-sm font-semibold text-slate-heading">Type</th>
              <th className="p-4 text-sm font-semibold text-slate-heading">File Name</th>
              <th className="p-4 text-sm font-semibold text-slate-heading">Date</th>
              <th className="p-4 text-sm font-semibold text-slate-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredData().length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-body">
                  No files found
                </td>
              </tr>
            ) : (
              getFilteredData().map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${badgeClass[item.type]}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="p-4 text-on-surface">{item.name}</td>
                  <td className="p-4 text-slate-body">{formatDate(item.timestamp)}</td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => handleView(item)}
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-primary-container"
                      aria-label="View"
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/40 text-primary-container"
                      aria-label="Download"
                    >
                      <span className="material-symbols-outlined">download</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold text-slate-heading">{viewModal.name}</h3>
              <button onClick={closeModal} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-secondary/40" aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              {viewModal.type === "PDF" ? (
                <div>
                  {!useFallback ? (
                    <>
                      <Document
                        file={viewModal.url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={<div className="text-slate-body">Loading PDF with PDF.js...</div>}
                        error={<div className="text-error">PDF.js viewer failed. Switching to browser viewer...</div>}
                      >
                        <Page
                          pageNumber={pageNumber}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          width={Math.min(window.innerWidth * 0.8, 800)}
                        />
                      </Document>
                      {numPages && (
                        <div className="flex items-center justify-center gap-4 mt-4">
                          <button
                            disabled={pageNumber <= 1}
                            onClick={previousPage}
                            className="min-h-11 px-4 rounded-lg bg-surface-dim text-slate-body disabled:opacity-40"
                          >
                            ← Previous
                          </button>
                          <span className="text-sm text-slate-body">Page {pageNumber} of {numPages}</span>
                          <button
                            disabled={pageNumber >= numPages}
                            onClick={nextPage}
                            className="min-h-11 px-4 rounded-lg bg-surface-dim text-slate-body disabled:opacity-40"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-body mb-2">Using browser's built-in PDF viewer</p>
                      <iframe
                        src={`${viewModal.url}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                        title={viewModal.name}
                        className="w-full h-[70vh] rounded-lg border border-border"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setUseFallback(!useFallback)}
                    className="min-h-11 mt-4 px-4 rounded-lg bg-surface-dim text-slate-body text-sm"
                  >
                    {useFallback ? "Try PDF.js Viewer" : "Use Browser Viewer"}
                  </button>
                </div>
              ) : (
                <img src={viewModal.url} alt={viewModal.name} className="w-full rounded-lg" />
              )}
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => handleDownload(viewModal)}
                className="min-h-11 px-6 rounded-lg bg-primary-container text-white font-medium flex items-center gap-2"
              >
                <span className="material-symbols-outlined">download</span>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;