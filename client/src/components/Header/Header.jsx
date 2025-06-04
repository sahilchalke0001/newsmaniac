import React, { useState } from "react";
import "./Header.css"; // Custom CSS file

const Header = ({ onCategorySelect }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleDropdown = (e) => {
    e.preventDefault();
    setShowDropdown((prev) => !prev);
  };

  const handleCategorySelected = (category, e) => {
    e.preventDefault();
    setShowDropdown(false);
    onCategorySelect(category);
  };

  return (
    <header className="header-container">
      <div className="header-content">
        <h1 className="app-title">NewsManiac</h1>
        <nav>
          <ul className="nav-links">
            <li className="nav-item dropdown">
              <span className="nav-link" onClick={toggleDropdown}>
                Categories ▾
              </span>
              {showDropdown && (
                <ul className="dropdown-menu">
                  <li>
                    <a
                      href="#"
                      className="dropdown-item"
                      onClick={(e) => handleCategorySelected("AI", e)}
                    >
                      AI
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="dropdown-item"
                      onClick={(e) => handleCategorySelected("Sports", e)}
                    >
                      Sports
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="dropdown-item"
                      onClick={(e) => handleCategorySelected("Healthcare", e)}
                    >
                      Healthcare
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="dropdown-item"
                      onClick={(e) => handleCategorySelected("Finance", e)}
                    >
                      Finance
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="dropdown-item"
                      onClick={(e) => handleCategorySelected("Environment", e)}
                    >
                      Environment
                    </a>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
