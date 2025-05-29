import React from "react";

const Header = () => {
  return (
    <header className="header-container">
      <div className="header-content">
        <h1 className="app-title">NewsManiac</h1>
        <nav>
          <ul className="nav-links">
            <li>
              <a href="#" className="nav-item">
                Home
              </a>
            </li>
            <li>
              <a href="#" className="nav-item">
                Categories
              </a>
            </li>
            <li>
              <a href="#" className="nav-item">
                About Us
              </a>
            </li>
            <li>
              <a href="#" className="nav-item">
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
