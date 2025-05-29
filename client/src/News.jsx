// src/components/News.jsx
import React, { useState, useEffect, useRef } from "react";
import "./News.css"; // For custom CSS styles for the News component

const News = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [articleData, setArticleData] = useState(null); // Stores processed data from backend
  const [summary, setSummary] = useState("");
  const [transHindi, setTransHindi] = useState("");
  const [transMarathi, setTransMarathi] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" }); // For warnings, errors, info

  const audioPlayedRef = useRef(false); // To prevent multiple audio plays if component re-renders

  // Function to handle fetching and processing the article
  const processArticle = async () => {
    if (!url) {
      setMessage({ type: "warning", text: "Please enter a valid URL." });
      return;
    }

    setLoading(true);
    setArticleData(null);
    setSummary("");
    setTransHindi("");
    setTransMarathi("");
    setMessage({ type: "", text: "" }); // Clear previous messages

    try {
      // Make a POST request to your Node.js backend API
      // The default Node.js backend port is often 3001, but can be configured
      const response = await fetch("http://localhost:3001/process_article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process article.");
      }

      const data = await response.json();
      setArticleData(data.article_data);
      setSummary(data.summary);
      setTransHindi(data.trans_hindi);
      setTransMarathi(data.trans_marathi);

      if (!data.article_data.text) {
        setMessage({
          type: "warning",
          text: "No content found for this article.",
        });
      }
    } catch (error) {
      console.error("Error processing article:", error);
      setMessage({ type: "error", text: `Processing error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Function for text-to-speech
  const speakSummary = () => {
    if (summary && "speechSynthesis" in window) {
      // Cancel any ongoing speech before starting new one
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance();
      msg.text = summary;
      window.speechSynthesis.speak(msg);
      audioPlayedRef.current = true;
    } else if (!summary) {
      setMessage({ type: "warning", text: "No summary available to play." });
    } else {
      setMessage({
        type: "info",
        text: "Text-to-speech not supported in this browser.",
      });
    }
  };

  const stopSummary = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      audioPlayedRef.current = false;
    }
  };

  // Cleanup for speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="news-app-container">
      <h1 className="news-app-title">
        📰 News Article Summarizer & Translator
      </h1>
      <hr className="news-app-hr" />

      {/* URL Input Section */}
      <div className="input-section">
        <input
          type="text"
          className="url-input"
          placeholder="Enter News Article URL:"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          className="process-button"
          onClick={processArticle}
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Process Article"}
        </button>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Article Content Display */}
      {articleData && articleData.title && (
        <div className="article-display-section">
          <h2 className="section-subheader">Original Content</h2>
          <p>
            <strong>Title:</strong> {articleData.title}
          </p>

          {articleData.top_image && (
            <img
              src={articleData.top_image}
              alt={articleData.title}
              className="article-image"
            />
          )}
          {!articleData.top_image &&
            articleData.images &&
            articleData.images.length > 0 && (
              <img
                src={articleData.images[0]}
                alt={articleData.title}
                className="article-image"
              />
            )}
          {!articleData.top_image &&
            (!articleData.images || articleData.images.length === 0) && (
              <div className="info-message">
                No main image found for this article.
              </div>
            )}

          <p>
            <strong>Published:</strong> {articleData.publish_date || "N/A"}
          </p>
          <p>
            <strong>Authors:</strong>{" "}
            {(articleData.authors && articleData.authors.join(", ")) || "N/A"}
          </p>
        </div>
      )}

      {/* Summary and Translation Display */}
      {summary && (
        <div className="summary-section">
          <h2 className="section-subheader">English Summary</h2>
          <div className="summary-box success-box">
            <p>{summary}</p>
          </div>

          <h2 className="section-subheader">Translations</h2>
          <div className="translation-columns">
            <div className="translation-column">
              <h4>Hindi</h4>
              <div className="translation-box info-box">
                <p>{transHindi}</p>
              </div>
            </div>
            <div className="translation-column">
              <h4>Marathi</h4>
              <div className="translation-box info-box">
                <p>{transMarathi}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Controls */}
      {summary && (
        <div className="audio-controls-section">
          <h2 className="section-subheader">Audio Summary</h2>
          <button className="audio-button play" onClick={speakSummary}>
            ▶️ Play Summary
          </button>
          <button className="audio-button stop" onClick={stopSummary}>
            ⏹️ Stop Summary
          </button>
        </div>
      )}

      {/* Sidebar Info (can be integrated into the main layout or a true sidebar) */}
      <div className="sidebar-info">
        <h3>About</h3>
        <p>This application uses:</p>
        <ul>
          <li>Hugging Face Transformers for summarization</li>
          <li>Newspaper3k for article extraction</li>
          <li>Googletrans for translations</li>
          <li>Web Speech API for audio playback</li>
        </ul>
        <p className="note-warning">
          Note: Translation reliability depends on Google Translate's web
          interface stability.
        </p>
      </div>
    </div>
  );
};

export default News;
