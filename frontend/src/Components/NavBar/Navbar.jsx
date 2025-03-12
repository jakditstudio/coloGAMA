import React, { useState }from 'react'
import './Navbar.css'
import logo from '../../assets/logo.png'
import menu_icon from '../../assets/menu-icon.png'
import { Link } from 'react-router-dom';

const Navbar = () => {
    const [mobileMenu, setMobileMenu] = useState(false);
    const toggleMenu = () =>{
        mobileMenu ? setMobileMenu(false) : setMobileMenu(true);
    }
  return (
    <nav className='container'>
      <img src={logo} alt="" className='logo'/>
      <ul className={mobileMenu?'':'hide-mobile-menu'}>
        <li><Link to="/">Capture</Link></li>
        {/* <li><a href="#">Procedure</a></li> */}
        <li><Link to="/history">History</Link></li>
        {/* <li><a href="#">Contact</a></li> */}
           </ul>
           <img src={menu_icon} alt="" className='menu-icon' onClick={toggleMenu}/>
    </nav>
  )
}

export default Navbar
