import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const TopNav = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 h-20 flex items-center ${
        scrolled ? "bg-[#0A0514]/90 backdrop-blur-md shadow-sm border-b border-white/10" : ""
      }`}>
        <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop w-full flex justify-between items-center">
        <Link to="/" className="text-2xl text-pure-white tracking-tight flex items-center gap-2">
          <span className="text-secondary">colo</span>GAMA
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/dashboard" className="text-sm font-semibold text-pure-white hover:text-secondary transition-colors">
            Capture
          </Link>
          <Link to="/results" className="text-sm font-semibold text-secondary-fixed-dim hover:text-pure-white transition-colors">
            Results
          </Link>
          <Link to="/history" className="text-sm font-semibold text-secondary-fixed-dim hover:text-pure-white transition-colors">
            History
          </Link>
        </div>
      </div>
    </nav>
    );
};

export default TopNav;