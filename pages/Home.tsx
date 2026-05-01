import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Reveal from '../components/ui/Reveal';
import { 
  Search, Globe, Ship, Truck, Box, ShieldCheck, MapPin, Plane, Package, 
  Warehouse, Clock, CheckCircle, Users, Award, ArrowRight, ChevronDown, ChevronUp,
  Star, Quote, Phone, Mail, Send, Target, TrendingUp, Shield, Zap, PawPrint
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_TOKEN, initMapbox, getRouteWithFallback, interpolateAlongRoute, ROUTE_STYLE } from '../utils/mapbox';

/* ──────────────────────────── HERO ──────────────────────────── */
const HeroSection: React.FC = () => (
  <section id="home" className="relative w-full min-h-[90vh] lg:min-h-screen overflow-hidden flex items-center">
    {/* Background Image */}
    <div className="absolute inset-0">
      <img 
        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=2000&q=80"
        alt="Global logistics"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f]/95 via-[#0a192f]/80 to-[#0a192f]/40" />
    </div>

    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-0 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <Reveal direction="left" delay={0.2} width="100%">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-block px-4 py-1.5 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30">
              Trusted by 500+ Global Brands
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight tracking-tight">
              Delivering the World with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                Precision & Care.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-xl">
              From air freight to last-mile delivery, we engineer seamless logistics solutions 
              that connect businesses across 150+ countries with speed and reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a href="#track" onClick={(e) => { e.preventDefault(); document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' }); }} className="px-8 py-4 bg-blue-600 text-white font-medium hover:bg-blue-500 transition-all shadow-lg hover:shadow-blue-600/25 rounded-sm text-center">
                Track Your Shipment
              </a>
              <a href="#services" onClick={(e) => { e.preventDefault(); document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }); }} className="px-8 py-4 border-2 border-white/30 text-white font-medium hover:bg-white/10 transition-all rounded-sm text-center">
                Explore Services
              </a>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-6 border-t border-white/10">
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white">150+</p>
                <p className="text-xs sm:text-sm text-gray-400">Countries Served</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white">50K+</p>
                <p className="text-xs sm:text-sm text-gray-400">Shipments / Month</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white">99.8%</p>
                <p className="text-xs sm:text-sm text-gray-400">On-Time Delivery</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal direction="right" delay={0.5} className="hidden lg:block">
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=800&q=80"
              alt="Shipping containers"
              className="w-full h-[500px] object-cover rounded-sm shadow-2xl"
            />
            <div className="absolute -bottom-6 -left-6 bg-white p-5 rounded-sm shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0a192f]">Live Tracking Active</p>
                  <p className="text-xs text-gray-500">2,341 shipments in transit</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

/* ──────────────────────────── ABOUT ──────────────────────────── */
const AboutSection: React.FC = () => (
  <section id="about" className="py-16 sm:py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal direction="left" delay={0.1}>
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=800&q=80"
              alt="Logistics warehouse operations"
              className="w-full h-[350px] sm:h-[450px] object-cover rounded-sm shadow-xl"
            />
            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 bg-[#0a192f] text-white p-4 sm:p-6 rounded-sm shadow-xl">
              <p className="text-3xl sm:text-4xl font-bold">15+</p>
              <p className="text-xs sm:text-sm text-gray-300">Years of Excellence</p>
            </div>
          </div>
        </Reveal>

        <Reveal direction="right" delay={0.2}>
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full">
              About Next Trace Logistics
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] leading-tight">
              Your Trusted Partner in Global Logistics Solutions
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Founded in 2010, Next Trace Logistics has grown from a regional courier service into a global logistics 
              powerhouse. We combine cutting-edge technology with decades of industry expertise to deliver 
              unmatched supply chain solutions.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our network spans over 150 countries, powered by a team of 5,000+ logistics professionals 
              who are dedicated to moving your goods safely, efficiently, and on time — every time.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#0a192f] text-sm">Our Mission</h4>
                  <p className="text-xs text-gray-500 mt-1">Redefine logistics with innovation and reliability.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#0a192f] text-sm">Our Vision</h4>
                  <p className="text-xs text-gray-500 mt-1">Be the world's most trusted logistics partner.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#0a192f] text-sm">Safety First</h4>
                  <p className="text-xs text-gray-500 mt-1">ISO 9001 & 14001 certified operations.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-[#0a192f] text-sm">Fast & Agile</h4>
                  <p className="text-xs text-gray-500 mt-1">Real-time tracking & adaptive routing.</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

/* ──────────────────────────── SERVICES ──────────────────────────── */
const services = [
  {
    slug: 'air-freight',
    icon: <Plane className="w-8 h-8" />,
    title: 'Air Freight',
    image: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?fm=jpg&fit=crop&w=600&q=80',
    description: 'Time-critical global air cargo solutions with same-day, next-day, and scheduled services across 500+ airports worldwide.',
    features: ['Express & Priority Options', 'Charter Services Available', 'Temperature-Controlled Cargo', 'Dangerous Goods Handling'],
  },
  {
    slug: 'ocean-freight',
    icon: <Ship className="w-8 h-8" />,
    title: 'Ocean Freight',
    image: 'https://images.unsplash.com/photo-1524522173746-f628baad3644?fm=jpg&fit=crop&w=600&q=80',
    description: 'Full container load (FCL) and less-than-container load (LCL) shipping with optimized routes across all major trade lanes.',
    features: ['FCL & LCL Solutions', 'Reefer Container Services', 'Port-to-Port & Door-to-Door', 'Customs Brokerage Included'],
  },
  {
    slug: 'land-transport',
    icon: <Truck className="w-8 h-8" />,
    title: 'Land Transport',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?fm=jpg&fit=crop&w=600&q=80',
    description: 'Comprehensive road and rail freight services including full truckload, partial loads, and intermodal transportation.',
    features: ['FTL & LTL Services', 'Cross-Border Transport', 'GPS-Tracked Fleet', 'Scheduled & On-Demand'],
  },
  {
    slug: 'express-courier',
    icon: <Package className="w-8 h-8" />,
    title: 'Express Courier',
    image: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?fm=jpg&fit=crop&w=600&q=80',
    description: 'Ultra-fast parcel and document delivery with guaranteed timeframes. Same-day and next-day options for urgent shipments.',
    features: ['Same-Day Delivery', 'Parcel & Document Express', 'Real-Time Notifications', 'Signature on Delivery'],
  },
  {
    slug: 'warehousing',
    icon: <Warehouse className="w-8 h-8" />,
    title: 'Warehousing & Distribution',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=600&q=80',
    description: 'State-of-the-art storage facilities with inventory management, pick & pack, and distribution services across key hubs.',
    features: ['Climate-Controlled Storage', 'Inventory Management', 'Pick, Pack & Ship', 'Returns Processing'],
  },
  {
    slug: 'specialized-cargo',
    icon: <Box className="w-8 h-8" />,
    title: 'Specialized Cargo',
    image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=600&q=80',
    description: 'Expert handling for oversized, fragile, high-value, and hazardous materials with dedicated project logistics teams.',
    features: ['Heavy-Lift & Project Cargo', 'Fine Art & Antiques', 'Pharmaceutical Transport', 'Military & Defense Logistics'],
  },
  {
    slug: 'animal-delivery',
    icon: <PawPrint className="w-8 h-8" />,
    title: 'Animal & Pet Transport',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?fm=jpg&fit=crop&w=600&q=80',
    description: 'Safe, humane, and stress-free transport for pets, livestock, exotic species, and laboratory animals worldwide.',
    features: ['Domestic & International Pets', 'Livestock & Equine Transport', 'IATA LAR Certified', 'Veterinary Oversight'],
  },
];

const ServicesSection: React.FC = () => (
  <section id="services" className="py-16 sm:py-24 bg-[#f8f9fb] overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            What We Offer
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">Comprehensive Logistics Services</h2>
          <p className="text-gray-600">
            End-to-end supply chain solutions tailored to your business. Every mode, every route, every time.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {services.map((service, i) => (
          <Reveal key={service.title} direction="bottom" delay={i * 0.1}>
            <Link to={`/services/${service.slug}`} className="block h-full">
              <div className="bg-white rounded-sm overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-500 group h-full flex flex-col cursor-pointer">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f]/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 w-12 h-12 bg-white rounded-sm flex items-center justify-center text-[#0a192f] shadow-lg">
                    {service.icon}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-[#0a192f] mb-2 group-hover:text-blue-600 transition-colors">{service.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{service.description}</p>
                  <ul className="space-y-2 mb-4">
                    {service.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600 group-hover:gap-3 transition-all">
                    Learn More <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ──────────────────────────── TRACK MAP MINI ──────────────────────────── */
const TrackMiniMap: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || mapRef.current) return;
    initMapbox();

    // Demo route: Dubai → London
    const origin: [number, number] = [55.2708, 25.2048]; // Dubai
    const dest: [number, number] = [-0.1276, 51.5074];   // London

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [27.5, 38.3], // Midpoint roughly over Eastern Mediterranean/Turkey
      zoom: 2.5,
      interactive: false,
      attributionControl: false,
    });

    m.on('load', async () => {
      // Fetch true road route
      const result = await getRouteWithFallback(origin, dest);
      const geometry = result?.geometry || { type: 'LineString', coordinates: [origin, dest] };
      const coords = geometry.coordinates as [number, number][];

      // Route glow
      m.addSource('demo-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry } as any });
      m.addLayer({
        id: 'demo-glow', type: 'line', source: 'demo-route',
        layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
        paint: { 'line-color': ROUTE_STYLE.glowColor, 'line-width': ROUTE_STYLE.glowWidth, 'line-opacity': ROUTE_STYLE.glowOpacity },
      });
      // Route line
      m.addLayer({
        id: 'demo-line', type: 'line', source: 'demo-route',
        layout: { 'line-join': ROUTE_STYLE.lineJoin, 'line-cap': ROUTE_STYLE.lineCap },
        paint: { 'line-color': ROUTE_STYLE.color, 'line-width': ROUTE_STYLE.width, 'line-opacity': ROUTE_STYLE.opacity },
      });

      // Origin dot
      const oEl = document.createElement('div');
      oEl.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`;
      new mapboxgl.Marker({ element: oEl }).setLngLat(origin).addTo(m);

      // Destination dot
      const dEl = document.createElement('div');
      dEl.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`;
      new mapboxgl.Marker({ element: dEl }).setLngLat(dest).addTo(m);

      // Moving parcel marker
      const mEl = document.createElement('div');
      mEl.innerHTML = `
        <div style="position:relative;">
          <div style="width:24px;height:24px;border-radius:50%;background:#3b82f6;opacity:0.25;position:absolute;top:-5px;left:-5px;animation:ping 2s ease-in-out infinite;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.5);position:relative;z-index:1;"></div>
        </div>
      `;
      const marker = new mapboxgl.Marker({ element: mEl }).setLngLat(origin).addTo(m);
      markerRef.current = marker;

      // Animate: cycle 0→100% over 30 seconds, then loop
      let progress = 0;
      const tick = () => {
        progress = (progress + 0.15) % 100;
        const pos = interpolateAlongRoute(coords, progress);
        marker.setLngLat(pos);
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(origin);
      bounds.extend(dest);
      m.fitBounds(bounds, { padding: 50, duration: 0 });
    });

    mapRef.current = m;

    return () => {
      cancelAnimationFrame(animRef.current);
      m.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {MAPBOX_TOKEN ? (
        <div ref={containerRef} className="absolute inset-0 rounded-sm" />
      ) : (
        <>
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path d="M 40 280 Q 200 80 400 180 T 700 120" fill="none" stroke="#0a192f" strokeWidth="3" strokeDasharray="6 6" />
          </svg>
          <div className="absolute top-[45%] left-[65%] transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping absolute" />
            <div className="w-3 h-3 bg-white rounded-full relative z-10 shadow-lg border-2 border-blue-500" />
          </div>
        </>
      )}
      {/* Overlay info */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end z-10 pointer-events-none">
        <div className="bg-[#0a192f]/85 backdrop-blur-md px-3 py-2 rounded-sm border border-gray-700/50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Live Demo</p>
          <p className="font-mono text-xs text-blue-400">Dubai → London</p>
        </div>
        <div className="bg-[#0a192f]/85 backdrop-blur-md p-2 rounded-sm border border-gray-700/50">
          <MapPin className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────── TRACK & TRACE ──────────────────────────── */
const TrackSection: React.FC = () => {
  const [trackId, setTrackId] = useState('');
  const navigate = useNavigate();

  const handleTrack = () => {
    if (!trackId.trim()) return;
    navigate(`/track/${trackId.trim()}`);
  };

  return (
    <section id="track" className="py-16 sm:py-24 bg-[#0a192f] text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal direction="left" delay={0.1}>
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30">
                Real-Time Visibility
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight">Track & Trace Your Shipment Anywhere, Anytime.</h2>
              <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
                Enter your tracking ID below to get instant updates on your shipment's location, 
                estimated delivery time, and full journey history.
              </p>
              
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Tracking ID
                </label>
                <form onSubmit={(e) => { e.preventDefault(); handleTrack(); }} className="relative">
                  <input 
                    type="text" 
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    placeholder="e.g., AT-8842-X9" 
                    className="w-full h-14 sm:h-16 pl-5 sm:pl-6 pr-14 sm:pr-16 bg-[#112240] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-base sm:text-lg font-mono rounded-sm"
                  />
                  <button type="submit" className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center rounded-sm transition-colors">
                    <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-3">You'll be redirected to a detailed tracking dashboard with map, timeline, and courier info.</p>
              </div>

              {/* Demo Status Steps */}
              <div className="space-y-4 pt-4">
                {[
                  { label: 'Order Confirmed', time: 'Jan 15, 10:30 AM', done: true },
                  { label: 'Picked Up', time: 'Jan 15, 02:15 PM', done: true },
                  { label: 'In Transit — Interstate I-80', time: 'Jan 16, 08:00 AM', done: true },
                  { label: 'Customs Clearance', time: 'Estimated Jan 18', done: false },
                  { label: 'Out for Delivery', time: 'Estimated Jan 19', done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${step.done ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`} />
                      {i < 4 && <div className={`w-0.5 h-8 ${step.done ? 'bg-blue-500/50' : 'bg-gray-700'}`} />}
                    </div>
                    <div className="-mt-0.5">
                      <p className={`text-sm font-medium ${step.done ? 'text-white' : 'text-gray-500'}`}>{step.label}</p>
                      <p className="text-xs text-gray-500">{step.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal direction="right" delay={0.3}>
            <div className="relative w-full aspect-square sm:aspect-video lg:aspect-square bg-[#112240] border border-gray-700 rounded-sm shadow-2xl overflow-hidden">
              <TrackMiniMap />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

/* ──────────────────────────── PROJECTS ──────────────────────────── */
const projects = [
  {
    title: 'Trans-Pacific Supply Chain Overhaul',
    category: 'Ocean Freight',
    image: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?fm=jpg&fit=crop&w=600&q=80',
    description: 'Restructured a Fortune 500 company\'s entire Asia-to-US supply chain, reducing transit times by 35%.',
  },
  {
    title: 'Emergency Medical Aid Delivery',
    category: 'Air Freight',
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?fm=jpg&fit=crop&w=600&q=80',
    description: 'Coordinated urgent medical supply airlifts to 12 countries within 72 hours during a crisis response.',
  },
  {
    title: 'Automotive Parts Distribution Network',
    category: 'Land Transport',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&fit=crop&w=600&q=80',
    description: 'Built a just-in-time distribution network for a leading automaker across 8 European countries.',
  },
  {
    title: 'E-Commerce Fulfillment Hub',
    category: 'Warehousing',
    image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=600&q=80',
    description: 'Designed and operated a 200,000 sq ft fulfillment center processing 50,000+ orders daily.',
  },
];

const ProjectsSection: React.FC = () => (
  <section id="projects" className="py-16 sm:py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            Our Portfolio
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">Featured Projects</h2>
          <p className="text-gray-600">
            Real-world case studies showcasing our ability to handle complex logistics challenges at global scale.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {projects.map((project, i) => (
          <Reveal key={project.title} direction={i % 2 === 0 ? 'left' : 'right'} delay={i * 0.1}>
            <div className="relative group overflow-hidden rounded-sm cursor-pointer h-64 sm:h-80">
              <img 
                src={project.image}
                alt={project.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-[#0a192f]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <span className="inline-block px-2 py-1 bg-blue-600/80 text-white text-xs font-medium rounded-sm mb-2">
                  {project.category}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{project.title}</h3>
                <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">{project.description}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ──────────────────────────── TESTIMONIALS (PREVIEW) ──────────────────────────── */
const previewReviews = [
  {
    name: 'Sarah Mitchell',
    role: 'VP Supply Chain, TechFlow Inc.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&fit=crop&w=100&q=80',
    text: 'Next Trace Logistics transformed our supply chain. Real-time tracking and proactive communication have reduced our delivery issues by over 60%.',
    rating: 5,
  },
  {
    name: 'James Okonkwo',
    role: 'CEO, AfriTrade Exports',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&w=100&q=80',
    text: 'From customs clearance to last-mile delivery, Next Trace Logistics handles everything seamlessly. Our logistics backbone for 5 years.',
    rating: 5,
  },
  {
    name: 'Elena Vasquez',
    role: 'Logistics Director, MedPharma Global',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&fit=crop&w=100&q=80',
    text: 'Temperature-controlled pharmaceutical shipping is best-in-class. Zero spoilage across 3,000+ shipments. Remarkable reliability.',
    rating: 5,
  },
];

const TestimonialsSection: React.FC = () => (
  <section id="testimonials" className="py-16 sm:py-24 bg-[#f8f9fb] overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            Client Feedback
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">What Our Clients Say</h2>
          <p className="text-gray-600">
            Trusted by 500+ global businesses. Over 30 verified customer reviews.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {previewReviews.map((t, i) => (
          <Reveal key={t.name} direction="bottom" delay={i * 0.15}>
            <div className="bg-white p-6 sm:p-8 rounded-sm border border-gray-100 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-600 text-sm leading-relaxed flex-1 italic">"{t.text}"</p>
              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-[#0a192f] text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* See All Reviews Button */}
      <Reveal direction="bottom" delay={0.3}>
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-6 py-4 shadow-sm mb-6">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
            </div>
            <span className="text-sm text-gray-600">4.9 / 5 · <strong className="text-[#0a192f]">30+ reviews</strong></span>
          </div>
          <div>
            <Link
              to="/reviews"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0a192f] text-white font-semibold rounded-sm hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-700/25 group"
            >
              See All Reviews
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

/* ──────────────────────────── FAQ ──────────────────────────── */
const faqs = [
  {
    q: 'How do I track my shipment?',
    a: 'Simply enter your unique tracking ID (format: AT-XXXX-XX) in the Track & Trace section above. You\'ll get real-time location updates, estimated delivery times, and full journey history.',
  },
  {
    q: 'What types of cargo do you handle?',
    a: 'We handle everything from standard parcels to specialized cargo including temperature-sensitive pharmaceuticals, oversized industrial equipment, hazardous materials (with proper certification), fine art, and military-grade shipments.',
  },
  {
    q: 'Do you offer international customs brokerage?',
    a: 'Yes. Our in-house customs brokerage team handles all documentation, duties, tariffs, and regulatory compliance for shipments across 150+ countries. This service is included with our ocean and air freight solutions.',
  },
  {
    q: 'What are your delivery timeframes?',
    a: 'Timeframes vary by service: Express Courier offers same-day/next-day delivery, Air Freight averages 1-5 business days internationally, Ocean Freight ranges from 15-45 days depending on the route, and Land Transport is typically 1-7 days within continental regions.',
  },
  {
    q: 'How do you ensure cargo safety?',
    a: 'We employ GPS tracking on all vehicles, tamper-proof seals, climate-controlled containers, 24/7 monitoring centers, and comprehensive insurance coverage. Our operations are ISO 9001 and 14001 certified.',
  },
  {
    q: 'Can I get a custom logistics solution for my business?',
    a: 'Absolutely. Our solutions team works with you to design bespoke supply chain strategies including dedicated fleet, warehousing, distribution networks, and integrated technology solutions. Contact us for a free consultation.',
  },
];

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Reveal direction="bottom">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
              Common Questions
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about our logistics services. Can't find an answer? Contact us directly.
            </p>
          </div>
        </Reveal>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} direction="bottom" delay={i * 0.05}>
              <div className="border border-gray-200 rounded-sm overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-[#0a192f] text-sm sm:text-base pr-4">{faq.q}</span>
                  {openIndex === i
                    ? <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  }
                </button>
                {openIndex === i && (
                  <div className="px-5 sm:px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ──────────────────────────── CONTACT ──────────────────────────── */
const ContactSection: React.FC = () => (
  <section id="contact" className="py-16 sm:py-24 bg-[#0a192f] text-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        <Reveal direction="left" delay={0.1}>
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30">
              Get in Touch
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">Let's Move Your Business Forward.</h2>
            <p className="text-gray-300 leading-relaxed">
              Whether you need a one-time shipment or a full supply chain partner, our team is ready 
              to design a solution that fits your needs perfectly.
            </p>

            <div className="space-y-5 pt-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-sm flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Headquarters</h4>
                  <p className="text-sm text-gray-400 mt-1">Atlanta, GA</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Phone</h4>
                  <p className="text-sm text-gray-400 mt-1">+1 (307) 200-8344</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Email</h4>
                  <p className="text-sm text-gray-400 mt-1">nexttrace.logistics@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-sm flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Working Hours</h4>
                  <p className="text-sm text-gray-400 mt-1">Mon–Fri: 8AM–8PM EST | 24/7 Tracking Support</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <img 
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?fm=jpg&fit=crop&w=600&q=80"
                alt="Office"
                className="w-full h-48 object-cover rounded-sm opacity-60"
              />
            </div>
          </div>
        </Reveal>

        <Reveal direction="right" delay={0.2}>
          <div className="bg-white rounded-sm p-6 sm:p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-[#0a192f] mb-6">Request a Free Quote</h3>
            <form className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                  <input type="text" placeholder="John Smith" className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Company</label>
                  <input type="text" placeholder="Your Company" className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Email</label>
                  <input type="email" placeholder="john@company.com" className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Phone</label>
                  <input type="tel" placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Service Needed</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none bg-white">
                  <option value="">Select a service...</option>
                  <option>Air Freight</option>
                  <option>Ocean Freight</option>
                  <option>Land Transport</option>
                  <option>Express Courier</option>
                  <option>Warehousing & Distribution</option>
                  <option>Specialized Cargo</option>
                  <option>Custom Solution</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Message</label>
                <textarea rows={4} placeholder="Tell us about your shipment needs..." className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm text-gray-800 focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none resize-none" />
              </div>
              <button type="button" className="w-full px-6 py-3.5 bg-[#0a192f] text-white font-medium hover:bg-[#112d57] transition-all rounded-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Send Request
              </button>
            </form>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

/* ──────────────────────────── MAIN HOME ──────────────────────────── */
const Home: React.FC = () => {
  return (
    <Layout>
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <TrackSection />
      <ProjectsSection />
      <TestimonialsSection />
      <FAQSection />
      <ContactSection />
    </Layout>
  );
};

export default Home;