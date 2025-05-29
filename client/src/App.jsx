import React from "react";
import Header from "./components/Header"; // Import the Header component
import "./index.css"; // Make sure your main CSS is imported here
import Footer from "./components/Footer";
import News from "./components/News";

function App() {
  return (
    <div className="app-layout">
      {" "}
      {/* Use a class for overall layout if needed */}
      <Header /> {/* Use the Header component here */}
      {/* Main content area */}
      <main className="main-content-area">
        <div className="content-card">
          <h2 className="content-title">Welcome to NewsManiac!</h2>
          <p className="content-text">
            This is the main content of your news application.
          </p>
          <News />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
