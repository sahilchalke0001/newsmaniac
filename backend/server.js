// backend/server.js
const express = require("express");
const { spawn } = require("child_process");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- IMPORTANT: Update this line with the correct path to your Python executable ---
// For Conda environment on Windows, like C:\Users\Sahil\Desktop\newsmania\backend\venv_nlp
const PYTHON_EXECUTABLE =
  "C:\\Users\\Sahil\\Desktop\\newsmania\\backend\\venv_nlp\\python.exe";

app.post("/process_article", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  // --- Spawn Python child process ---
  const pythonProcess = spawn(PYTHON_EXECUTABLE, ["nlp_service.py"], {
    cwd: __dirname, // Set current working directory to 'backend' folder
  });

  let pythonOutput = "";
  let pythonError = "";

  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    pythonError += data.toString();
    console.error(`Python stderr: ${data.toString()}`); // Log Python errors to console
  });

  pythonProcess.on("close", (code) => {
    if (code === 0) {
      // Python script exited successfully
      try {
        const result = JSON.parse(pythonOutput);
        res.json(result);
      } catch (e) {
        console.error("Error parsing Python output:", e, pythonOutput);
        res
          .status(500)
          .json({
            error: "Failed to parse Python script output.",
            details: pythonError,
          });
      }
    } else {
      // Python script exited with an error
      console.error(`Python script exited with code ${code}`);
      let errorMessage = "An error occurred during article processing.";
      try {
        const errorDetails = JSON.parse(pythonError.trim());
        errorMessage = errorDetails.error || errorMessage;
      } catch (e) {
        // If Python error isn't JSON, just use the raw error
        errorMessage = pythonError || errorMessage;
      }
      res.status(500).json({ error: errorMessage, details: pythonError });
    }
  });

  // Send the URL to the Python script via stdin
  pythonProcess.stdin.write(JSON.stringify({ url }));
  pythonProcess.stdin.end(); // Close stdin to signal end of input to Python script
});

app.listen(PORT, () => {
  console.log(`Node.js backend listening at http://localhost:${PORT}`);
});
