import { Link } from 'react-router-dom';
import TopNav from '../TopNav/TopNav';
import Footer from '../Footer/Footer';
import heroImage from '../../assets/main1.jpg';

const Hero = () => {
  return (
    <div className="bg-surface">
      <TopNav />

      {/* Hero section */}
      <header className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden bg-[#0A0514]">
        <div className="absolute inset-0 z-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 hero-gradient" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto mt-20">
          <h1 className="text-5xl md:text-6xl font-bold text-pure-white mb-6 drop-shadow-lg">
            Explore Your Color
          </h1>
          <p className="text-lg text-secondary-fixed-dim max-w-2xl mx-auto mb-10 leading-relaxed">
            Advanced image processing system for precise RGB color-based chemical identification.
            Integrating hardware design and sophisticated software on a robust, portable architecture.
          </p>
          <Link
            to="/dashboard"
            className="bg-primary-container text-pure-white px-8 py-4 rounded-lg font-semibold flex items-center gap-3 hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_14px_rgba(124,58,237,0.4)] min-h-11"
          >
            START CAPTURE
            <span className="material-symbols-outlined">arrow_outward</span>
          </Link>
        </div>
      </header>

      {/* Features section */}
      <section className="py-24 bg-surface relative z-20 -mt-10 rounded-t-[40px]">
        <div className="max-w-container mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-slate-heading mb-4">Laboratory-Grade Precision</h2>
            <p className="text-slate-body max-w-2xl mx-auto">
              Seamlessly transition from capture to complex analytical results with our high-contrast, data-focused dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {[
              { icon: "photo_camera", title: "High-Fidelity Capture", body: "Utilize optimized camera settings to capture uncompressed colorimetric data, ensuring the highest accuracy for chemical reaction analysis." },
              { icon: "analytics", title: "RGB Extraction", body: "Our proprietary algorithms isolate and extract precise Red, Green, and Blue values from your samples, plotting them instantly on interactive histograms." },
              { icon: "history", title: "Audit Trail", body: "Maintain a secure, searchable history of all analyses. Export detailed PDF reports outlining visual data, timestamps, and confidence metrics." },
            ].map((f) => (
              <div key={f.title} className="bg-pure-white rounded-xl p-8 shadow-[0px_4px_10px_rgba(0,0,0,0.05)] border border-border hover:shadow-[0px_10px_30px_rgba(124,58,237,0.1)] transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-primary">{f.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-3">{f.title}</h3>
                <p className="text-slate-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Hero;