import React, { useState } from "react";
import Header from "./components/Header/Header"; // Import the Header component
import "./index.css"; // Make sure your main CSS is imported here
import Footer from "./components/Footer/Footer";
import News from "./components/News/News";

function App() {
  // State to hold the currently selected category
  const [currentCategory, setCurrentCategory] = useState(""); // Initialize with empty or a default category

  // Handler function to be called by Header when a category is selected
  const handleCategorySelect = (category) => {
    console.log("App.jsx: Category selected:", category);
    setCurrentCategory(category);
  };

  return (
    <div className="app-layout">
      {/* Pass the handleCategorySelect function to the Header */}
      <Header onCategorySelect={handleCategorySelect} />

      {/* Main content area */}
      <main className="main-content-area">
        <div className="content-card">
          {/* You can remove this welcome message or keep it */}
          {!currentCategory && ( // Only show welcome if no category is selected yet
            <>
              <p className="content-text">
                This site helps you summarize news articles and create engaging
                posts and reels for social media.
              </p>
            </>
          )}
          {/* Pass the currentCategory to the News component */}
          <News selectedCategory={currentCategory} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
