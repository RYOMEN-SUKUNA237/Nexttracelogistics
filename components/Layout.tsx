import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Phone, Mail, MapPin, Facebook, Twitter, Linkedin, Instagram, ChevronUp } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
const logoImg = '/icon.jpg';

interface LayoutProps {
  children: React.ReactNode;
}

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'About Us', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Track & Trace', href: '#track' },
  { label: 'Projects', href: '#projects' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact Us', href: '#contact' },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowTop(window.scrollY > 600);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToSection = (href: string) => {
    if (href.startsWith('/')) {
      navigate(href);
      setMobileOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    const id = href.replace('#', '');
    
    // Close mobile menu immediately for better UX
    setMobileOpen(false);
    
    // Small delay to ensure menu starts closing before scroll
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        // Use scrollIntoView with options for better mobile support
        el.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      } else if (window.location.pathname !== '/') {
        // Navigate to home page first, then scroll after render
        navigate('/');
        setTimeout(() => {
          const target = document.getElementById(id);
          if (target) {
            target.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }, 400);
      }
    }, 150);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Info Bar */}
      <div className="hidden lg:block bg-[#0a192f] text-gray-300 text-xs py-2">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> +1 (307) 200-8344</span>
            <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> nexttracelogistics@gmail.com</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Atlanta, GA</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors"><Facebook className="w-3.5 h-3.5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Twitter className="w-3.5 h-3.5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-3.5 h-3.5" /></a>
            <a href="#" className="hover:text-white transition-colors"><Instagram className="w-3.5 h-3.5" /></a>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100'
            : 'bg-white border-b border-gray-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 lg:h-20 flex items-center justify-between">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); scrollToSection('#home'); }}
            className="text-xl lg:text-2xl font-bold text-[#0a192f] tracking-tight flex items-center gap-2 flex-shrink-0"
          >
            <img src={logoImg} alt="Logo" className="w-8 h-8 object-cover rounded-sm" />
            <span>NEXT TRACE</span>
          </a>

          {/* Desktop Links */}
          <div className="hidden xl:flex items-center space-x-6 text-sm font-medium text-gray-600">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                className="hover:text-[#0a192f] transition-colors relative group whitespace-nowrap"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          {/* CTA + Hamburger */}
          <div className="flex items-center gap-3">
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); scrollToSection('#contact'); }}
              className="hidden lg:flex px-5 py-2.5 bg-[#0a192f] text-white text-sm font-medium hover:bg-[#112d57] transition-all rounded-sm items-center gap-2 group"
            >
              Get a Quote
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="xl:hidden p-2 text-[#0a192f] hover:bg-gray-100 rounded-sm transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="xl:hidden overflow-hidden bg-white border-t border-gray-100"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-1">
                {navLinks.map((link, i) => (
                  <motion.button
                    key={link.label}
                    onClick={() => scrollToSection(link.href)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="block w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:text-[#0a192f] hover:bg-gray-50 rounded-sm transition-colors"
                  >
                    {link.label}
                  </motion.button>
                ))}
                <div className="pt-3 border-t border-gray-100 mt-2">
                  <button
                    onClick={() => scrollToSection('#contact')}
                    className="block w-full text-center px-5 py-3 bg-[#0a192f] text-white text-sm font-medium rounded-sm hover:bg-[#112d57] transition-colors"
                  >
                    Get a Quote
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 z-50 w-12 h-12 bg-[#0a192f] text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="bg-[#0a192f] text-white"
      >
        {/* Main Footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src={logoImg} alt="Logo" className="w-8 h-8 object-cover rounded-sm" />
                <span className="text-xl font-bold">NEXT TRACE</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Engineering global connectivity through precision logistics and unrivaled security since 2010.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Next Trace Logistics — your trusted partner for every mile.
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"><Facebook className="w-4 h-4" /></a>
                <a href="#" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"><Linkedin className="w-4 h-4" /></a>
                <a href="#" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"><Instagram className="w-4 h-4" /></a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-5 text-white text-sm uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                {navLinks.slice(0, 4).map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                      className="hover:text-white transition-colors hover:translate-x-1 inline-block"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold mb-5 text-white text-sm uppercase tracking-wider">Our Services</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('#services'); }} className="hover:text-white transition-colors">Air Freight</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('#services'); }} className="hover:text-white transition-colors">Ocean Freight</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('#services'); }} className="hover:text-white transition-colors">Land Transport</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('#services'); }} className="hover:text-white transition-colors">Express Courier</a></li>
                <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection('#services'); }} className="hover:text-white transition-colors">Warehousing</a></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold mb-5 text-white text-sm uppercase tracking-wider">Contact Us</h4>
              <ul className="space-y-4 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                  <span>Atlanta, GA</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 flex-shrink-0 text-blue-400" />
                  <span>+1 (307) 200-8344</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 flex-shrink-0 text-blue-400" />
                  <span>nexttracelogistics@gmail.com</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Next Trace Logistics. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default Layout;