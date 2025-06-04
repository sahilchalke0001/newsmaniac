import React from "react";
import "./Footer.css";

const Footer = () => {
  const currentYear = new Date().getFullYear(); // Get the current year dynamically

  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-title">NewsManiac</h3>
          <p className="footer-text">
            Your daily dose of news, curated for you.
          </p>
          <p className="footer-copyright">
            &copy; {currentYear} NewsManiac. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
