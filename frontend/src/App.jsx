import React from 'react'
import Navbar from './Components/NavBar/Navbar'
import Hero from './Components/Hero/Hero'
import Footer from './Components/Footer/Footer'
import History from './Components/NavBar/History/History'
import Results from './Components/Results/Results' 

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const App = () => {
  return (
    <Router>
      <div>
        <Navbar />
        <Routes>
            <Route path="/" element={<Hero />} /> {/* Default route */}
            <Route path="/history" element={<History />} /> {/* Route for History */}
            <Route path="/results" element={<Results />} /> {/* Route for Results */}
          </Routes>
          <Footer />
      </div>
    </Router>
  );
};

export default App;
