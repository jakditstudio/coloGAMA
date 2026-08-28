import { NavLink } from "react-router-dom";
// import logo from "../../assets/logo.png";

const navItems = [
  { to: "/dashboard", icon: "photo_camera", label: "Capture" },
  { to: "/results", icon: "analytics", label: "Results" },
  { to: "/history", icon: "history", label: "History" },
];

const linkClasses = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-3 rounded-lg min-h-11 transition-colors ${
    isActive
      ? "bg-primary-container text-white"
      : "text-slate-body hover:bg-secondary/40"
  }`;

const SideNav = () => (
  <>
    {/* Desktop sidebar */}
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-surface-dim border-r border-border h-screen sticky top-0 p-4">
      {/* <img src={logo} alt="coloGAMA" className="h-10 mb-8 px-2" /> */}
      <Link to="/" className="text-2xl font-semibold text-primary tracking-tight mb-8 px-2">
        <span className="text-primary-container">colo</span>GAMA
      </Link>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClasses} end={item.to === "/"}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>

    {/* Mobile/touch bottom nav */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around py-2 z-20">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 min-h-11 min-w-11 rounded-lg ${
              isActive ? "text-primary-container" : "text-slate-body"
            }`
          }
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="text-xs">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  </>
);

export default SideNav;