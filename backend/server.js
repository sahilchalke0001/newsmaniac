// backend/server.js
const express = require("express");
const { spawn } = require("child_process"); // <--- This is the correct declaration
const cors = require("cors");
const axios = require("axios"); // For making HTTP requests to external APIs
const path = require("path"); // Import the 'path' module

const app = express();
const PORT = 3001; // Node.js backend will run on port 3001

// --- News API Configuration ---
const NEWS_API_KEY = "8a1a97d2a3a4431fac26c9ba27ca277c"; // YOUR NEWS API KEY
const NEWS_API_URL = "https://newsapi.org/v2/everything";

app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON request bodies

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- IMPORTANT: Path to your Python executable within the Conda environment ---
// Please double-check this path.
// Example: 'C:\\Users\\Sahil\\anaconda3\\envs\\venv_nlp\\python.exe' if your env is under anaconda installs
// or 'C:\\Users\\Sahil\\Desktop\\newsmania\\backend\\venv_nlp\\python.exe' if your env is within the project folder
const PYTHON_EXECUTABLE =
  "C:\\Users\\Sahil\\Desktop\\newsmania\\backend\\venv_nlp\\python.exe";

// Endpoint 1: Search News Articles
app.post("/search_news", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Search query is required." });
  }

  try {
    const response = await axios.get(NEWS_API_URL, {
      params: {
        q: query,
        apiKey: NEWS_API_KEY,
        language: "en", // Focusing on English news for consistent summarization
        sortBy: "relevancy",
        pageSize: 100, // <--- CHANGED THIS TO 100 FOR MAXIMUM ARTICLES
      },
    }); // Filter out articles without content or URL for better processing later

    const articles = response.data.articles
      .filter(
        (article) =>
          article.url && article.title && article.description && article.content
      )
      .map((article) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source.name,
        image: article.urlToImage,
        publishedAt: article.publishedAt,
      }));

    res.json({ articles });
  } catch (error) {
    console.error(
      "Error fetching news from News API:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      error: "Failed to fetch news from API.",
      details: error.response ? error.response.data : error.message,
    });
  }
});

// Endpoint 2: Process a specific Article URL (Summarize, Translate, and Generate Video)
app.post("/process_article", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ error: "Article URL is required for processing." });
  }

  const pythonProcess = spawn(PYTHON_EXECUTABLE, ["nlp_service.py"], {
    cwd: __dirname,
  });

  let pythonOutput = "";
  let pythonError = "";

  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    pythonError += data.toString();
    console.error(`Python stderr: ${data.toString()}`); // Good! Keep this for Python debugging
  });

  pythonProcess.on("close", (code) => {
    if (code === 0) {
      try {
        const result = JSON.parse(pythonOutput);
        // ADD THIS LINE TO LOG THE JSON RESULT
        console.log(
          "Python script returned JSON:",
          JSON.stringify(result, null, 2)
        );
        res.json(result);
      } catch (e) {
        console.error("Error parsing Python output:", e, pythonOutput);
        res.status(500).json({
          error: "Failed to parse Python script output.",
          details: pythonError,
        });
      }
    } else {
      console.error(`Python script exited with code ${code}`);
      let errorMessage = "An error occurred during article processing.";
      try {
        const errorDetails = JSON.parse(pythonError.trim());
        errorMessage = errorDetails.error || errorMessage;
      } catch (e) {
        errorMessage = pythonError || errorMessage;
      }
      res.status(500).json({ error: errorMessage, details: pythonError });
    }
  });

  pythonProcess.stdin.write(JSON.stringify({ url }));
  pythonProcess.stdin.end();
});

// Start the Node.js server
app.listen(PORT, () => {
  console.log(`Node.js backend listening at http://localhost:${PORT}`);
});
