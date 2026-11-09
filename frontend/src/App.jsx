import SideNav from './Components/SideNav/SideNav'
import Hero from './Components/Hero/Hero'
import Dashboard from './Components/Dashboard/Dashboard'
import Footer from './Components/Footer/Footer'
import History from './Components/NavBar/History/History'
import Results from './Components/Results/Results'
import { BrowserRouter as Router, Route, Routes, Outlet } from 'react-router-dom';

const AppShell = () => (
  <div className="flex min-h-screen bg-surface">
    <SideNav />
    <div className="flex-1 flex flex-col pb-20 md:pb-0">
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  </div>
);

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hero />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/results" element={<Results />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;