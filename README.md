# News Article Summarizer and Translator

This application provides a robust solution for searching, summarizing, translating, and generating multimedia content (video and image posts) from news articles. It features a React-based frontend for user interaction and a Node.js backend that orchestrates various Python-based NLP and media processing tasks.

##  Demonstration
![Demonstration](https://github.com/user-attachments/assets/c7fc0e46-cc3b-4dea-acb2-e41fdfe2322c)

https://github.com/user-attachments/assets/919379e1-c888-4a65-badf-6b3719fa2997

## News Url summerization

https://github.com/user-attachments/assets/57328545-3da6-4b25-ac21-511228e5e9ef


## News artice summerization from api
https://github.com/user-attachments/assets/bc1e0ff8-b634-4bc6-9368-460b5ae41565

## Translation in Hindi and Marathi
![Screenshot 2025-06-22 230005](https://github.com/user-attachments/assets/da6e839d-d3d4-4cf7-bdd3-72d23b95df02)

![Screenshot 2025-06-22 230037](https://github.com/user-attachments/assets/a12d7ddd-e271-4bb0-ad3b-b1e0a60bfb9d)

![Screenshot 2025-06-22 230103](https://github.com/user-attachments/assets/62141eff-132c-4ab3-9c24-fe3de2fb2d46)

## Table of Contents

- Features
- Technologies Used
- Prerequisites
- Setup and Installation
  - Cloning the Repository
  - Backend Setup (Node.js & Python)
  - Frontend Setup (React)
- Usage
- Troubleshooting
- License

## Features

- News Article Search: Search for articles using keywords (via News API).
- Direct URL Processing: Input a URL to extract and summarize its content.
- Article Summarization: Leverages Hugging Face Transformers for concise summaries.
- Multi-language Translation: Translates summaries to Hindi and Marathi.
- Video Generation: Creates narrated video summaries with text overlays.
- Shareable Image Posts: Generates summary-based social media images.
- Text-to-Speech (TTS): Audio playback of summaries in supported languages.

## Technologies Used

### Frontend:

- React

- CSS (Responsive Design)

### Backend:

- Node.js (Express)
- Python (NLP and Media Processing)

### Libraries:

- newspaper3k, transformers, torch, gTTS, pydub, Pillow, ffmpeg-python, googletrans, opencv-python, nltk, scipy, etc.

### External Tools & APIs:

- News API – for fetching news.
- FFmpeg – required for audio/video generation.

## Prerequisites

Ensure the following are installed:

- Git
- Node.js & npm (or Yarn)
- Python 3.8+
- Conda (Anaconda/Miniconda recommended)
- FFmpeg

### FFmpeg Installation:

- Windows: Download from https://ffmpeg.org/download.html, extract and add `bin` to system PATH.
- macOS: `brew install ffmpeg`
- Linux: `sudo apt update && sudo apt install ffmpeg`

## Setup and Installation

### Cloning the Repository

```bash
git clone <repository_url>
cd <repository_name>
```

### Backend Setup (Node.js & Python)

```bash
cd backend
npm install
# or
yarn install
```
#### Adding Api Key
```bash
NEWS_API_KEY=#add your news api key from news api here
```
make a .env file in backend folder and the key
#### Python Environment Setup (Conda)

```bash
conda create -n venv_nlp python=3.9
conda activate venv_nlp
pip install -r requirements.txt
```

Ensure your `requirements.txt` includes necessary libraries.

#### FFmpeg Path Setup

Update the path in `backend/nlp_service.py`:

```python
FFMPEG_BIN_PATH = r"C:\path\to\ffmpeg\bin"
# or
FFMPEG_BIN_PATH = "/usr/local/bin"
```

#### Start Backend

```bash
node server.js
```

### Frontend Setup (React)

```bash
cd ../frontend
npm install
# or
yarn install
npm start
```

## Usage

- Search news by keywords.
- Paste article URL to summarize directly.
- View summaries, translations, videos, and image posts.
- Listen to TTS audio and download media.

## Troubleshooting

| Issue                                            | Solution                             |
| ------------------------------------------------ | ------------------------------------ |
| `handleSelectArticleAndSummarize is not defined` | Ensure it's defined in News.jsx      |
| FFmpeg not found                                 | Check `FFMPEG_BIN_PATH`              |
| No Audio in Video                                | Check gTTS, pydub, and FFmpeg        |
| Failed to fetch news                             | Verify `NEWS_API_KEY`                |
| Python Errors                                    | Check backend logs                   |
| CORS Errors                                      | Ensure CORS is configured in Express |

## License

This project is open-source and available under the MIT License.
