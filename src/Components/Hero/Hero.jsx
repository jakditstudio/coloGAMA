import React from 'react'
import './Hero.css'
import arrow from '../../assets/arrow.png'

const Hero = () => {
  return (
    <div className='hero container'>
      <div className="hero-text">
        <h1>Explore Your Color</h1>
        <p>This project focused on developing an image processing system for RGB color-based chemical identification, involving hardware design, software development, and system integration on a Raspberry Pi.</p>
        <a href="../Cam/Cam.jsx" target='blank'><button className='btn-utama'>Get Started <img src={arrow} alt="" /></button></a>
      </div>
    </div>
  )
}

export default Hero
