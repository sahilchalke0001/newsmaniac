// src/components/News.jsx
import React, { useState, useEffect, useRef } from "react";
import "./News.css"; // For custom CSS styles for the News component

const News = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null); // Stores the selected article object from search results (News API)
  const [processedArticleDetails, setProcessedArticleDetails] = useState(null); // Stores the full response from /process_article
  const [message, setMessage] = useState({ type: "", text: "" }); // For warnings, errors, info
  const [activeTab, setActiveTab] = useState("english"); // 'english', 'hindi', 'marathi'

  const audioPlayedRef = useRef(false);

  // Function to handle fetching and processing the article
  const handleSearchNews = async () => {
    if (!searchQuery) {
      setMessage({ type: "warning", text: "Please enter a search query." });
      return;
    }

    setLoading(true);
    setSearchResults([]); // Clear previous search results
    setSelectedArticle(null); // Clear selected article
    setProcessedArticleDetails(null); // Clear processed article details
    setMessage({ type: "", text: "" }); // Clear previous messages
    setActiveTab("english"); // Reset tab

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
          text: `Found ${data.articles.length} articles. Click on an article to summarize and generate video.`,
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
    setSelectedArticle(article); // Keep the original article data for display
    setLoading(true);
    setProcessedArticleDetails(null); // Clear previous processed data
    setMessage({ type: "", text: "" }); // Clear previous messages
    setActiveTab("english"); // Reset tab to English

    try {
      const response = await fetch("http://localhost:3001/process_article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: article.url }),
      });

      if (!response.ok) {
        // If the response is not OK, try to parse JSON error or fall back to text
        const errorBody = await response.text();
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorBody);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use the raw text as the error message
          errorMessage = errorBody || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Store the entire data object from the backend response
      setProcessedArticleDetails(data);

      if (data.error) {
        // Check if the backend returned an error in its JSON
        setMessage({ type: "error", text: `Processing error: ${data.error}` });
        setProcessedArticleDetails(null); // Clear processed data on error
      } else if (!data.summary) {
        setMessage({
          type: "warning",
          text: "Could not generate summary for this article. Content might be insufficient or malformed.",
        });
      } else if (!data.video_path) {
        setMessage({
          type: "info",
          text: "Article summarized, but video generation failed or was not possible for this article.",
        });
      } else {
        setMessage({
          type: "success",
          text: "Article processed successfully and video generated!",
        });
      }
    } catch (error) {
      console.error("Error processing article:", error);
      setMessage({ type: "error", text: `Processing error: ${error.message}` });
      setProcessedArticleDetails(null); // Clear processed data on error
    } finally {
      setLoading(false);
    }
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

  const getActiveSummaryText = () => {
    if (processedArticleDetails) {
      if (activeTab === "english") return processedArticleDetails.summary;
      if (activeTab === "hindi") return processedArticleDetails.trans_hindi;
      if (activeTab === "marathi") return processedArticleDetails.trans_marathi;
    }
    return "";
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
      {searchResults.length > 0 &&
        !selectedArticle &&
        !loading && ( // Only show if not loading and no article selected
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
                      Summarize & Translate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Loading Spinner for Processing */}
      {loading &&
        selectedArticle && ( // Show loading spinner only when processing a selected article
          <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
            <p>
              Processing article and generating video. This might take a
              moment...
            </p>
          </div>
        )}

      {/* Selected Article Content Display and Summaries/Translations/Video */}
      {selectedArticle && processedArticleDetails && !loading && (
        <div className="selected-article-section">
          <h2 className="section-subheader">Processed Article Details</h2>
          <p>
            <strong>Title:</strong>{" "}
            {processedArticleDetails.title || selectedArticle.title}
          </p>
          {/* Use image from processed details if available, otherwise from selectedArticle */}
          {(processedArticleDetails.top_image || selectedArticle.image) && (
            <img
              src={processedArticleDetails.top_image || selectedArticle.image}
              alt={processedArticleDetails.title || selectedArticle.title}
              className="article-image"
            />
          )}
          {!(processedArticleDetails.top_image || selectedArticle.image) && (
            <div className="info-message">
              No main image found for this article.
            </div>
          )}
          <p>
            <strong>Source:</strong> {selectedArticle.source}
          </p>
          <p>
            <strong>Published:</strong>{" "}
            {new Date(
              processedArticleDetails.publish_date ||
                selectedArticle.publishedAt
            ).toLocaleDateString()}
          </p>
          {processedArticleDetails.authors &&
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
            >
              Read Full Article
            </a>
          </p>

          {/* Display Summary & Translations */}
          {processedArticleDetails.summary && (
            <div className="summary-translation-section">
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
                {activeTab === "hindi" && (
                  <div className="translation-box info-box">
                    <p>{processedArticleDetails.trans_hindi}</p>
                  </div>
                )}
                {activeTab === "marathi" && (
                  <div className="translation-box info-box">
                    <p>{processedArticleDetails.trans_marathi}</p>
                  </div>
                )}
              </div>

              {/* Audio Controls */}
              <div className="audio-controls-section">
                <h3 className="section-subheader-small">Audio Playback</h3>
                <button
                  className="audio-button play"
                  onClick={() => speakSummary(getActiveSummaryText())}
                >
                  ▶️ Play Current Tab
                </button>
                <button className="audio-button stop" onClick={stopSummary}>
                  ⏹️ Stop Audio
                </button>
              </div>
            </div>
          )}

          {/* Video Display */}
          {processedArticleDetails.video_path && (
            <div className="video-section">
              <h3 className="section-subheader">Generated Video:</h3>
              <video
                controls
                width="100%"
                // FIX: Apply the replace method for URL compatibility
                src={`http://localhost:3001/${processedArticleDetails.video_path.replace(
                  /\\/g,
                  "/"
                )}`}
                type="video/mp4"
                className="generated-video"
              >
                Your browser does not support the video tag.
              </video>
              <p className="video-url">
                Direct Video URL:{" "}
                <a
                  // FIX: Apply the replace method for URL compatibility
                  href={`http://localhost:3001/${processedArticleDetails.video_path.replace(
                    /\\/g,
                    "/"
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* FIX: Apply the replace method for URL display */}
                  {`http://localhost:3001/${processedArticleDetails.video_path.replace(
                    /\\/g,
                    "/"
                  )}`}
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sidebar Info */}
      <div className="sidebar-info">
        <h3>About</h3>
        <p>This application uses:</p>
        <ul>
          <li>News API for article search</li>
          <li>Hugging Face Transformers for summarization</li>
          <li>Newspaper3k for article content extraction</li>
          <li>Googletrans for translations</li>
          <li>gTTS for text-to-speech audio generation</li>
          <li>OpenCV, Pillow, and FFmpeg for video creation</li>
        </ul>
        <p className="note-warning">
          Note: Translation reliability depends on Google Translate's web
          interface stability. Video generation requires a summary and an image
          from the article.
        </p>
      </div>
    </div>
  );
};

export default News;
