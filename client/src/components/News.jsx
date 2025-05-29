// src/components/News.jsx
import React, { useState, useEffect, useRef } from "react";
import "./News.css";

const News = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [summary, setSummary] = useState("");
  const [transHindi, setTransHindi] = useState("");
  const [transMarathi, setTransMarathi] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("english"); // 'english', 'hindi', 'marathi'
  const [videoPaths, setVideoPaths] = useState({}); // Stores URLs to generated videos

  // Cleanup for speech synthesis on component unmount (still good practice)
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSearchNews = async () => {
    if (!searchQuery) {
      setMessage({ type: "warning", text: "Please enter a search query." });
      return;
    }

    setLoading(true);
    setSearchResults([]);
    setSelectedArticle(null);
    setSummary("");
    setTransHindi("");
    setTransMarathi("");
    setVideoPaths({}); // Clear video paths
    setMessage({ type: "", text: "" });
    setActiveTab("english");

    try {
      const response = await fetch("http://localhost:3001/search_news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to search news.");
      }

      const data = await response.json();
      if (data.articles.length === 0) {
        setMessage({
          type: "info",
          text: "No articles found for your query. Try a different one.",
        });
      } else {
        setSearchResults(data.articles);
        setMessage({
          type: "success",
          text: `Found ${data.articles.length} articles.`,
        });
      }
    } catch (error) {
      console.error("Error searching news:", error);
      setMessage({ type: "error", text: `Search error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArticleAndSummarize = async (article) => {
    setSelectedArticle(article);
    setLoading(true);
    setSummary("");
    setTransHindi("");
    setTransMarathi("");
    setVideoPaths({}); // Clear video paths
    setMessage({ type: "", text: "" });
    setActiveTab("english");

    try {
      const response = await fetch("http://localhost:3001/process_article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: article.url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process article.");
      }

      const data = await response.json();
      setSummary(data.summary);
      setTransHindi(data.trans_hindi);
      setTransMarathi(data.trans_marathi);
      setVideoPaths(data.video_paths || {}); // Set video paths

      if (!data.summary) {
        setMessage({
          type: "warning",
          text: "Could not generate summary for this article. Content might be insufficient or malformed.",
        });
      }
      if (
        !data.video_paths ||
        Object.values(data.video_paths).every((v) => !v)
      ) {
        setMessage({
          type: "info",
          text: "Video generation failed or no image/summary available for video.",
        });
      }
    } catch (error) {
      console.error("Error processing article:", error);
      setMessage({ type: "error", text: `Processing error: ${error.message}` });
      setSelectedArticle(null);
    } finally {
      setLoading(false);
    }
  };

  const getActiveVideoUrl = () => {
    if (activeTab === "english" && videoPaths.english)
      return videoPaths.english;
    if (activeTab === "hindi" && videoPaths.hindi) return videoPaths.hindi;
    if (activeTab === "marathi" && videoPaths.marathi)
      return videoPaths.marathi;
    return null;
  };

  return (
    <div className="news-app-container">
      <h1 className="news-app-title">
        📰 News Article Summarizer & Translator
      </h1>
      <hr className="news-app-hr" />

      {/* Search Input Section */}
      <div className="input-section">
        <input
          type="text"
          className="search-input"
          placeholder="Enter news search query (e.g., 'artificial intelligence')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") handleSearchNews();
          }}
        />
        <button
          className="search-button"
          onClick={handleSearchNews}
          disabled={loading}
        >
          {loading ? "Searching..." : "Search News"}
        </button>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Search Results Display */}
      {searchResults.length > 0 && !selectedArticle && (
        <div className="search-results-section">
          <h2 className="section-subheader">Search Results</h2>
          <div className="articles-list">
            {searchResults.map((article, index) => (
              <div
                key={index}
                className="article-card"
                onClick={() => handleSelectArticleAndSummarize(article)}
              >
                {article.image && (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="article-card-image"
                  />
                )}
                <div className="article-card-content">
                  <h3>{article.title}</h3>
                  <p className="article-card-description">
                    {article.description}
                  </p>
                  <p className="article-card-meta">
                    Source: {article.source} | Published:{" "}
                    {new Date(article.publishedAt).toLocaleDateString()}
                  </p>
                  <button className="summarize-button">
                    Summarize & Generate Video
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Article Content Display and Summaries/Translations/Videos */}
      {selectedArticle && (
        <div className="selected-article-section">
          <h2 className="section-subheader">Selected Article</h2>
          <p>
            <strong>Title:</strong> {selectedArticle.title}
          </p>
          {selectedArticle.image && (
            <img
              src={selectedArticle.image}
              alt={selectedArticle.title}
              className="article-image"
            />
          )}
          {!selectedArticle.image && (
            <div className="info-message">
              No main image found for this article.
            </div>
          )}
          <p>
            <strong>Source:</strong> {selectedArticle.source}
          </p>
          <p>
            <strong>Published:</strong>{" "}
            {new Date(selectedArticle.publishedAt).toLocaleDateString()}
          </p>
          <p>
            <a
              href={selectedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read Full Article
            </a>
          </p>

          {loading && <div className="loading-spinner"></div>}

          {summary && (
            <div className="summary-translation-video-section">
              <div className="tabs">
                <button
                  className={`tab-button ${
                    activeTab === "english" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("english")}
                >
                  English Summary
                </button>
                <button
                  className={`tab-button ${
                    activeTab === "hindi" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("hindi")}
                >
                  Hindi
                </button>
                <button
                  className={`tab-button ${
                    activeTab === "marathi" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("marathi")}
                >
                  Marathi
                </button>
              </div>

              <div className="tab-content">
                {/* Text Summaries */}
                {activeTab === "english" && (
                  <div className="summary-box success-box">
                    <p>{summary}</p>
                  </div>
                )}
                {activeTab === "hindi" && (
                  <div className="translation-box info-box">
                    <p>{transHindi}</p>
                  </div>
                )}
                {activeTab === "marathi" && (
                  <div className="translation-box info-box">
                    <p>{transMarathi}</p>
                  </div>
                )}

                {/* Video Player */}
                <h3 className="section-subheader-small">
                  Video Summary (Current Tab)
                </h3>
                <div className="video-player-container">
                  {getActiveVideoUrl() ? (
                    <video
                      controls
                      src={getActiveVideoUrl()}
                      className="summary-video"
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="info-message">
                      Video not available for this language/article (requires an
                      image and summary).
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sidebar Info */}
      <div className="sidebar-info">
        <h3>About</h3>
        <p>This application uses:</p>
        <ul>
          <li>
            News API for article search (free tier limited to 10 articles)
          </li>
          <li>Hugging Face Transformers for summarization</li>
          <li>Newspaper3k for article content extraction</li>
          <li>Googletrans for translations</li>
          <li>gTTS and MoviePy for video generation</li>
          <li>
            Web Speech API for audio playback (removed client-side buttons)
          </li>
        </ul>
        <p className="note-warning">
          Note: Video generation can take time. Ensure `ffmpeg` is installed and
          in your system's PATH on the backend server.
        </p>
      </div>
    </div>
  );
};

export default News;
