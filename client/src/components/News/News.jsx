// src/components/News.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import "./News.css";

const News = ({ selectedCategory }) => {
  // State for the search query, can be set by typing or by selectedCategory prop
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

  // Effect to update searchQuery state when selectedCategory prop changes
  useEffect(() => {
    if (selectedCategory) {
      setSearchQuery(selectedCategory);
      // The actual search will be triggered by the useEffect watching handleSearchNews (which depends on searchQuery)
    } else {
      // Optional: Clear search if no category is selected.
      // Depending on desired behavior, you might want to clear searchQuery or load default news.
      // For now, if selectedCategory is null/undefined, searchQuery remains as is or its last value.
      // If you want to clear it:
      // setSearchQuery("");
    }
  }, [selectedCategory]);

  // Memoized function to handle the news search API call
  const handleSearchNews = useCallback(async () => {
    if (!searchQuery) {
      // Avoid searching if searchQuery is empty.
      // Optionally, set a message or clear results.
      // setMessage({ type: "info", text: "Enter a query or select a category to search." });
      // setSearchResults([]); // Clear previous results if query is cleared
      // setSelectedArticle(null);
      return;
    }

    setLoading(true);
    setSearchResults([]);
    setSelectedArticle(null);
    setSummary("");
    setTransHindi("");
    setTransMarathi("");
    setVideoPaths({});
    setMessage({ type: "", text: "" });
    setActiveTab("english");

    try {
      const response = await fetch("http://localhost:3001/search_news", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery }), // Uses the current searchQuery state
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
  }, [
    searchQuery,
    setLoading,
    setSearchResults,
    setSelectedArticle,
    setSummary,
    setTransHindi,
    setTransMarathi,
    setVideoPaths,
    setMessage,
    setActiveTab,
  ]);
  // Dependencies for useCallback: searchQuery and all state setters it uses.
  // State setters are stable, so searchQuery is the primary changing dependency here.

  // Effect to trigger search when handleSearchNews function reference changes
  // (which happens when its dependency 'searchQuery' changes)
  useEffect(() => {
    if (searchQuery) {
      // Only trigger if there's a searchQuery
      handleSearchNews();
    } else {
      // If searchQuery is cleared (e.g. by selectedCategory becoming null and clearing it),
      // you might want to clear results here.
      setSearchResults([]);
      setSelectedArticle(null);
      setMessage({ type: "", text: "" });
    }
  }, [handleSearchNews]); // Depends on the memoized handleSearchNews

  // Function to handle article selection and summarization (existing logic)
  const handleSelectArticleAndSummarize = async (article) => {
    setSelectedArticle(article);
    setLoading(true);
    setSummary("");
    setTransHindi("");
    setTransMarathi("");
    setVideoPaths({});
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
      setVideoPaths(data.video_paths || {});

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
        // Update message only if it's not already an error/warning from summary
        if (
          !message.text ||
          message.type === "success" ||
          message.type === "info"
        ) {
          setMessage({
            type: "info",
            text:
              message.text +
              (message.text ? " " : "") +
              "Video generation failed or no image/summary available for video.",
          });
        }
      }
    } catch (error) {
      console.error("Error processing article:", error);
      setMessage({ type: "error", text: `Processing error: ${error.message}` });
      setSelectedArticle(null);
    } finally {
      setLoading(false);
    }
  };

  // Function to get active video URL (existing logic)
  const getActiveVideoUrl = () => {
    if (activeTab === "english" && videoPaths.english)
      return videoPaths.english;
    if (activeTab === "hindi" && videoPaths.hindi) return videoPaths.hindi;
    if (activeTab === "marathi" && videoPaths.marathi)
      return videoPaths.marathi;
    return null;
  };

  // Cleanup for speech synthesis on component unmount (existing logic)
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Manual search trigger for the button, uses the memoized handleSearchNews
  // This is effectively what the useEffect already does, but good to have for explicit button click
  // if the useEffect for handleSearchNews were to be removed or changed.
  // For now, the button click will call handleSearchNews, which is the same function
  // the useEffect calls.
  const manualSearchTrigger = () => {
    handleSearchNews();
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
          placeholder="Enter news search query (e.g., 'artificial intelligence') or select a category"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} // Updates searchQuery, which triggers the effect
          onKeyPress={(e) => {
            if (e.key === "Enter") manualSearchTrigger(); // Use manualSearchTrigger or handleSearchNews
          }}
        />
        <button
          className="search-button"
          onClick={manualSearchTrigger} // Use manualSearchTrigger or handleSearchNews
          disabled={loading}
        >
          {loading && !selectedArticle
            ? "Searching..."
            : loading && selectedArticle
            ? "Processing..."
            : "Search News"}
        </button>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Loading indicator specifically for search results loading (not article processing) */}
      {loading && !selectedArticle && searchResults.length === 0 && (
        <div className="loading-spinner-search"></div>
      )}

      {/* Search Results Display */}
      {!loading && searchResults.length > 0 && !selectedArticle && (
        <div className="search-results-section">
          <h2 className="section-subheader">
            Search Results for "{searchQuery}"
          </h2>
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
                    onError={(e) => {
                      e.target.style.display = "none";
                    }} // Hide if image fails to load
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
          <button
            className="back-to-results-button"
            onClick={() => {
              setSelectedArticle(null);
              setMessage({ type: "", text: "" }); /* Keep searchResults */
            }}
          >
            &larr; Back to Search Results
          </button>
          <h2 className="section-subheader">Selected Article</h2>
          <p>
            <strong>Title:</strong> {selectedArticle.title}
          </p>
          {selectedArticle.image && (
            <img
              src={selectedArticle.image}
              alt={selectedArticle.title}
              className="article-image"
              onError={(e) => {
                e.target.style.display = "none";
              }} // Hide if image fails to load
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

          {/* Loading spinner for article processing */}
          {loading && <div className="loading-spinner"></div>}

          {summary &&
            !loading && ( // Only show tabs if summary exists and not loading
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
                  {transHindi && (
                    <button
                      className={`tab-button ${
                        activeTab === "hindi" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("hindi")}
                    >
                      Hindi
                    </button>
                  )}
                  {transMarathi && (
                    <button
                      className={`tab-button ${
                        activeTab === "marathi" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("marathi")}
                    >
                      Marathi
                    </button>
                  )}
                </div>

                <div className="tab-content">
                  {activeTab === "english" && (
                    <div className="summary-box success-box">
                      <p>{summary}</p>
                    </div>
                  )}
                  {activeTab === "hindi" && transHindi && (
                    <div className="translation-box info-box">
                      <p>{transHindi}</p>
                    </div>
                  )}
                  {activeTab === "marathi" && transMarathi && (
                    <div className="translation-box info-box">
                      <p>{transMarathi}</p>
                    </div>
                  )}

                  <h3 className="section-subheader-small">
                    Video Summary (
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)})
                  </h3>
                  <div className="video-player-container">
                    {getActiveVideoUrl() ? (
                      <video
                        controls
                        src={getActiveVideoUrl()}
                        className="summary-video"
                        key={getActiveVideoUrl()} // Add key to force re-render on src change
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="info-message">
                        Video not available for this language/article.
                        {activeTab === "english" &&
                          !summary &&
                          " (Requires summary)"}
                        {activeTab === "english" &&
                          summary &&
                          !selectedArticle.image &&
                          " (Requires article image)"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          {/* Message if summary processing failed but article is selected */}
          {!summary && !loading && selectedArticle && (
            <div className="info-message">
              Summary processing might have failed or is unavailable for this
              article.
            </div>
          )}
        </div>
      )}

      {/* Sidebar Info (existing) */}
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
