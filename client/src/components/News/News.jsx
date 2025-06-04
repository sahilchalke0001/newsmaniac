// src/components/News.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import "./News.css"; // Re-import the CSS file

const News = ({ selectedCategory }) => {
  // State for the search query, can be set by typing or by selectedCategory prop
  const [searchQuery, setSearchQuery] = useState("");
  // New state for direct URL input
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null); // Stores the original article object from search results (News API)
  const [processedArticleDetails, setProcessedArticleDetails] = useState(null); // Stores the full response from /process_article endpoint
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState("english"); // 'english', 'hindi', 'marathi'

  const audioPlayedRef = useRef(false);

  // Effect to update searchQuery state when selectedCategory prop changes
  useEffect(() => {
    if (selectedCategory) {
      setSearchQuery(selectedCategory);
      setUrlInput(""); // Clear URL input when category is selected
    } else {
      // If selectedCategory is cleared, also clear search results and selected article
      setSearchQuery(""); // Clear the search bar
      setSearchResults([]);
      setSelectedArticle(null);
      setProcessedArticleDetails(null);
      setMessage({ type: "", text: "" });
    }
  }, [selectedCategory]);

  // Memoized function to handle the news search API call
  const handleSearchNews = useCallback(async () => {
    if (!searchQuery) {
      setMessage({
        type: "info",
        text: "Enter a query or select a category to search.",
      });
      setSearchResults([]);
      setSelectedArticle(null);
      setProcessedArticleDetails(null);
      return;
    }

    setLoading(true);
    setSearchResults([]);
    setSelectedArticle(null);
    setProcessedArticleDetails(null); // Clear processed details on new search
    setMessage({ type: "", text: "" });
    setActiveTab("english");
    setUrlInput(""); // Clear URL input when performing a search

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
          text: `Found ${data.articles.length} articles. Click on an article to summarize and generate video.`,
        });
      }
    } catch (error) {
      console.error("Error searching news:", error);
      setMessage({ type: "error", text: `Search error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, [searchQuery]); // Dependencies for useCallback: searchQuery. State setters are stable.

  // New function to handle direct URL summarization
  const handleSummarizeUrl = useCallback(async () => {
    if (!urlInput) {
      setMessage({ type: "info", text: "Please enter a URL to summarize." });
      setSelectedArticle(null);
      setProcessedArticleDetails(null);
      return;
    }

    // Basic URL validation
    try {
      new URL(urlInput);
    } catch (_) {
      setMessage({
        type: "error",
        text: "Invalid URL format. Please enter a valid URL.",
      });
      return;
    }

    setLoading(true);
    setSearchResults([]); // Clear search results when summarizing a URL
    setSelectedArticle(null); // Clear previous selected article
    setProcessedArticleDetails(null); // Clear previous processed data
    setMessage({ type: "", text: "" });
    setActiveTab("english");
    setSearchQuery(""); // Clear search query when summarizing a URL

    try {
      const response = await fetch("http://localhost:3001/process_article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: urlInput }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorBody);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorBody || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProcessedArticleDetails(data); // Store the entire processed data

      if (data.error) {
        setMessage({
          type: "error",
          text: `Backend processing error: ${data.error}`,
        });
        setProcessedArticleDetails(null); // Clear processed data on backend error
      } else if (!data.summary) {
        setMessage({
          type: "warning",
          text: "Could not generate summary for this URL. Content might be insufficient or malformed.",
        });
      } else if (!data.video_path) {
        // Check for video_path directly from the backend response
        setMessage({
          type: "info",
          text: "Article summarized, but video generation failed or no image/summary available for video.",
        });
      } else {
        setMessage({
          type: "success",
          text: "Article processed successfully and video generated!",
        });
      }

      // Set a dummy selected article for display purposes if successful
      if (data.summary) {
        setSelectedArticle({
          title: data.title || "Summarized Article", // Use title from backend or a default
          url: urlInput,
          image: data.top_image,
          source: "Direct URL",
          publishedAt: data.publish_date || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error processing URL:", error);
      setMessage({ type: "error", text: `Processing error: ${error.message}` });
      setSelectedArticle(null); // Clear selected article on processing error
      setProcessedArticleDetails(null); // Clear processed data on processing error
    } finally {
      setLoading(false);
    }
  }, [urlInput]); // Dependency for useCallback: urlInput

  // Effect to trigger search when searchQuery changes (either from typing or category selection)
  useEffect(() => {
    if (searchQuery && !urlInput) {
      // Only search if searchQuery is present and no URL input
      handleSearchNews();
    } else if (!searchQuery && !urlInput) {
      // If both are cleared, clear results and selected article
      setSearchResults([]);
      setSelectedArticle(null);
      setProcessedArticleDetails(null);
      setMessage({ type: "", text: "" });
    }
  }, [searchQuery, handleSearchNews, urlInput]); // Depend on searchQuery, urlInput, and the memoized handleSearchNews

  // Function to get the URL for the video, ensuring correct path format
  const getActiveVideoUrl = () => {
    if (processedArticleDetails && processedArticleDetails.video_path) {
      // Replace backslashes with forward slashes for URL compatibility
      return `http://localhost:3001/${processedArticleDetails.video_path.replace(
        /\\/g,
        "/"
      )}`;
    }
    return null;
  };

  // Function to get the summary text for the active tab
  const getActiveSummaryText = () => {
    if (processedArticleDetails) {
      if (activeTab === "english") return processedArticleDetails.summary;
      if (activeTab === "hindi") return processedArticleDetails.trans_hindi;
      if (activeTab === "marathi") return processedArticleDetails.trans_marathi;
    }
    return "";
  };

  // Function for text-to-speech
  const speakSummary = (textToSpeak) => {
    if (textToSpeak && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance();
      msg.text = textToSpeak;
      window.speechSynthesis.speak(msg);
      audioPlayedRef.current = true;
    } else if (!textToSpeak) {
      setMessage({
        type: "warning",
        text: "No text available to play in the current tab.",
      });
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
          disabled={loading} // Disable while loading
        />
        <button
          className="search-button"
          onClick={handleSearchNews}
          disabled={loading}
        >
          {loading && !selectedArticle && searchQuery
            ? "Searching..."
            : "Search News"}
        </button>
      </div>
      <br></br>
      {/* URL Input Section */}
      <div className="input-section">
        <input
          type="text"
          className="search-input" // Reusing search-input style
          placeholder="Paste article URL here (e.g., https://example.com/article)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") handleSummarizeUrl();
          }}
          disabled={loading} // Disable while loading
        />
        <button
          className="search-button" // Reusing search-button style
          onClick={handleSummarizeUrl}
          disabled={loading}
        >
          {loading && !selectedArticle && urlInput
            ? "Processing URL..."
            : "Summarize URL"}
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
              setProcessedArticleDetails(null); // Clear processed details when going back
              setMessage({ type: "", text: "" }); /* Keep searchResults */
              setSearchQuery(""); // Clear search query when going back
              setUrlInput(""); // Clear URL input when going back
            }}
          >
            &larr; Back to Main Options
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
          {/* Display Authors from processed data if available */}
          {processedArticleDetails?.authors &&
            processedArticleDetails.authors.length > 0 && (
              <p>
                <strong>Authors:</strong>{" "}
                {processedArticleDetails.authors.join(", ")}
              </p>
            )}
          <p>
            <a
              href={selectedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              className="read-full-article-link"
            >
              Read Full Article
            </a>
          </p>

          {/* Loading spinner for article processing */}
          {loading && <div className="loading-spinner"></div>}

          {processedArticleDetails &&
            processedArticleDetails.summary &&
            !loading && (
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
                  {processedArticleDetails.trans_hindi && (
                    <button
                      className={`tab-button ${
                        activeTab === "hindi" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("hindi")}
                    >
                      Hindi
                    </button>
                  )}
                  {processedArticleDetails.trans_marathi && (
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
                      <p>{processedArticleDetails.summary}</p>
                    </div>
                  )}
                  {activeTab === "hindi" &&
                    processedArticleDetails.trans_hindi && (
                      <div className="translation-box info-box">
                        <p>{processedArticleDetails.trans_hindi}</p>
                      </div>
                    )}
                  {activeTab === "marathi" &&
                    processedArticleDetails.trans_marathi && (
                      <div className="translation-box info-box">
                        <p>{processedArticleDetails.trans_marathi}</p>
                      </div>
                    )}

                  {/* Audio Controls */}
                  <div className="audio-controls-section">
                    <h3 className="section-subheader-small">Audio Playback</h3>
                    <button
                      className="audio-button play-button"
                      onClick={() => speakSummary(getActiveSummaryText())}
                    >
                      ▶️ Play Current Tab
                    </button>
                    <button
                      className="audio-button stop-button"
                      onClick={stopSummary}
                    >
                      ⏹️ Stop Audio
                    </button>
                  </div>

                  <h3 className="section-subheader-small">
                    Video Summary (
                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)})
                  </h3>
                  <div className="video-player-container">
                    {getActiveVideoUrl() ? (
                      <>
                        {" "}
                        {/* Use a fragment to group video and download button */}
                        <video
                          controls
                          src={getActiveVideoUrl()}
                          className="summary-video"
                          key={getActiveVideoUrl()} // Add key to force re-render on src change
                        >
                          Your browser does not support the video tag.
                        </video>
                        <a
                          href={getActiveVideoUrl()}
                          download={`summary_video_${activeTab}.mp4`} // Suggested filename
                          className="download-button" // Apply download-button class
                        >
                          ⬇️ Download Video
                        </a>
                      </>
                    ) : (
                      <div className="info-message">
                        Video not available for this language/article.
                        {/* More specific messages based on processed data */}
                        {!processedArticleDetails.summary &&
                          " (Requires summary)"}
                        {processedArticleDetails.summary &&
                          !processedArticleDetails.top_image &&
                          " (Requires article image)"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          {/* Message if summary processing failed but article is selected */}
          {(!processedArticleDetails || !processedArticleDetails.summary) &&
            !loading &&
            selectedArticle && (
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
          <li>gTTS and ffmpeg-python for video generation</li>{" "}
          {/* Updated text */}
          <li>
            Web Speech API for audio playback (Play/Stop buttons are
            client-side) {/* Updated text */}
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
