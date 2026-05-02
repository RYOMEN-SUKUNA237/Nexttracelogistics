import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import Reveal from '../components/ui/Reveal';
import {
  ArrowLeft, ArrowRight, CheckCircle, Zap, Globe, Shield, Clock, Eye,
  BarChart3, DollarSign, Leaf, Box, ShieldCheck, MapPin, Truck, FileCheck,
  Package, Headphones, Bell, Lock, Ruler, Users, TrendingUp, RotateCcw,
  Thermometer, Phone, Mail, Send, ChevronRight, Loader2, Heart, PawPrint
} from 'lucide-react';
import { serviceDetails, ServiceDetail as ServiceDetailType } from '../data/serviceDetails';
import { quotes } from '../services/api';

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-6 h-6" />,
  Globe: <Globe className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  Eye: <Eye className="w-6 h-6" />,
  BarChart3: <BarChart3 className="w-6 h-6" />,
  DollarSign: <DollarSign className="w-6 h-6" />,
  Container: <Box className="w-6 h-6" />,
  Leaf: <Leaf className="w-6 h-6" />,
  Box: <Box className="w-6 h-6" />,
  ShieldCheck: <ShieldCheck className="w-6 h-6" />,
  MapPin: <MapPin className="w-6 h-6" />,
  Truck: <Truck className="w-6 h-6" />,
  FileCheck: <FileCheck className="w-6 h-6" />,
  Package: <Package className="w-6 h-6" />,
  Headphones: <Headphones className="w-6 h-6" />,
  Bell: <Bell className="w-6 h-6" />,
  Lock: <Lock className="w-6 h-6" />,
  Ruler: <Ruler className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  RotateCcw: <RotateCcw className="w-6 h-6" />,
  Thermometer: <Thermometer className="w-6 h-6" />,
  Heart: <Heart className="w-6 h-6" />,
  PawPrint: <PawPrint className="w-6 h-6" />,
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

/* ─── HERO SECTION ──────────────────────────────────────────────── */
const HeroSection: React.FC<{ service: ServiceDetailType }> = ({ service }) => {
  const navigate = useNavigate();

  return (
    <section className="relative w-full min-h-[50vh] lg:min-h-[60vh] overflow-hidden flex items-center">
      <div className="absolute inset-0">
        <img
          src={service.heroImage}
          alt={service.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f]/95 via-[#0a192f]/80 to-[#0a192f]/50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        <Reveal direction="left" delay={0.1} width="100%">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors mb-6 text-sm font-medium group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          <div className="inline-block px-4 py-1.5 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30 mb-4">
            Our Services
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-4">
            {service.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed max-w-2xl mb-8">
            {service.tagline}
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#contact-cta"
              onClick={(e) => { e.preventDefault(); document.getElementById('contact-cta')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="px-8 py-3.5 bg-blue-600 text-white font-medium hover:bg-blue-500 transition-all shadow-lg hover:shadow-blue-600/25 rounded-sm flex items-center gap-2"
            >
              Get a Quote <ArrowRight size={16} />
            </a>
            <a
              href="#overview"
              onClick={(e) => { e.preventDefault(); document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="px-8 py-3.5 border-2 border-white/30 text-white font-medium hover:bg-white/10 transition-all rounded-sm"
            >
              Learn More
            </a>
          </div>
        </Reveal>

        {/* Stats row */}
        <Reveal direction="bottom" delay={0.4} width="100%">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10">
            {service.stats.map((stat, i) => (
              <div key={i}>
                <p className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs sm:text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
};

/* ─── OVERVIEW SECTION ──────────────────────────────────────────── */
const OverviewSection: React.FC<{ service: ServiceDetailType }> = ({ service }) => (
  <section id="overview" className="py-16 sm:py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal direction="left" delay={0.1}>
          <div className="relative">
            <img
              src={service.galleryImages[0]?.src || service.heroImage}
              alt={service.title}
              className="w-full h-[350px] sm:h-[450px] object-cover rounded-sm shadow-xl"
            />
            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 bg-[#0a192f] text-white p-4 sm:p-6 rounded-sm shadow-xl">
              <p className="text-3xl sm:text-4xl font-bold">{service.stats[0]?.value}</p>
              <p className="text-xs sm:text-sm text-gray-300">{service.stats[0]?.label}</p>
            </div>
          </div>
        </Reveal>

        <Reveal direction="right" delay={0.2}>
          <div className="space-y-5">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full">
              Overview
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] leading-tight">
              {service.overviewTitle}
            </h2>
            {service.overviewParagraphs.map((p, i) => (
              <p key={i} className="text-gray-600 leading-relaxed">{p}</p>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

/* ─── BENEFITS SECTION ──────────────────────────────────────────── */
const BenefitsSection: React.FC<{ service: ServiceDetailType }> = ({ service }) => (
  <section className="py-16 sm:py-24 bg-[#f8f9fb] overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            Key Advantages
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">{service.whyChooseTitle}</h2>
          <p className="text-gray-600">{service.whyChooseIntro}</p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {service.benefits.map((benefit, i) => (
          <Reveal key={benefit.title} direction="bottom" delay={i * 0.08}>
            <motion.div
              whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
              transition={{ duration: 0.3 }}
              className="bg-white p-6 sm:p-8 rounded-sm border border-gray-100 h-full flex flex-col group"
            >
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 mb-5 group-hover:from-[#0a192f] group-hover:to-blue-800 group-hover:text-white transition-all duration-300">
                {iconMap[benefit.icon] || <CheckCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-[#0a192f] mb-2">{benefit.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed flex-1">{benefit.description}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── SERVICE TYPES SECTION ─────────────────────────────────────── */
const ServiceTypesSection: React.FC<{ service: ServiceDetailType }> = ({ service }) => (
  <section className="py-16 sm:py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            What We Offer
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">{service.serviceTypesTitle}</h2>
          <p className="text-gray-600">{service.serviceTypesIntro}</p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {service.serviceTypes.map((st, i) => (
          <Reveal key={st.title} direction="bottom" delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-sm overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-500 group h-full flex flex-col"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={st.image}
                  alt={st.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f]/70 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-lg font-bold text-white">{st.title}</h3>
                </div>
              </div>
              <div className="p-6 flex-1">
                <p className="text-gray-500 text-sm leading-relaxed">{st.description}</p>
              </div>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── PROCESS SECTION ───────────────────────────────────────────── */
const ProcessSection: React.FC<{ service: ServiceDetailType }> = ({ service }) => (
  <section className="py-16 sm:py-24 bg-[#0a192f] text-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30 mb-4">
            Our Process
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{service.processTitle}</h2>
          <p className="text-gray-400">{service.processIntro}</p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {service.processSteps.map((step, i) => (
          <Reveal key={step.step} direction="bottom" delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -4, borderColor: 'rgba(59, 130, 246, 0.5)' }}
              transition={{ duration: 0.3 }}
              className="relative bg-[#112240] p-6 sm:p-8 rounded-sm border border-gray-700/50 h-full group"
            >
              <div className="absolute -top-4 left-6 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-600/30">
                {step.step}
              </div>
              <h3 className="text-lg font-bold text-white mt-3 mb-3 group-hover:text-blue-300 transition-colors">
                {step.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── GALLERY SECTION ───────────────────────────────────────────── */
const GallerySection: React.FC<{ service: ServiceDetailType }> = ({ service }) => (
  <section className="py-16 sm:py-24 bg-[#f8f9fb] overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <Reveal direction="bottom">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
            In Action
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-4">{service.title} Operations</h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {service.galleryImages.map((img, i) => (
          <Reveal key={i} direction={i === 0 ? 'left' : i === 2 ? 'right' : 'bottom'} delay={i * 0.15}>
            <div className="relative group overflow-hidden rounded-sm cursor-pointer h-64 sm:h-72">
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-[#0a192f]/0 group-hover:bg-[#0a192f]/40 transition-colors duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-white text-sm font-medium">{img.alt}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

/* ─── CTA SECTION ───────────────────────────────────────────────── */
const CTASection: React.FC<{ service: ServiceDetailType }> = ({ service }) => {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ full_name: '', company: '', email: '', phone: '', details: '' });
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const res = await quotes.submit({
        full_name: form.full_name.trim(),
        company: form.company.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        service_type: service.title,
        details: form.details.trim() || undefined,
      });
      if (res.error) throw new Error(res.error);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact-cta" className="py-16 sm:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal direction="left" delay={0.1}>
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full">
                Get Started
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] leading-tight">
                {service.ctaTitle}
              </h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                {service.ctaDescription}
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0a192f] text-sm">Call Us</h4>
                    <p className="text-sm text-gray-500">+1 (307) 200-8344</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-sm flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#0a192f] text-sm">Email Us</h4>
                    <p className="text-sm text-gray-500">nexttracelogistics@gmail.com</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 border-2 border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all rounded-sm flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Back to Home
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal direction="right" delay={0.2}>
            <div className="bg-[#0a192f] rounded-sm p-6 sm:p-8 shadow-2xl">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 space-y-4"
                >
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Quote Request Submitted!</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Thank you for your interest in our {service.title} services. Our team will review your request and get back to you within 2 business hours.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ full_name: '', company: '', email: '', phone: '', details: '' }); }}
                    className="mt-4 px-6 py-2.5 text-sm font-medium text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-400 rounded-sm transition-all"
                  >
                    Submit Another Request
                  </button>
                </motion.div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-6">Request a Free {service.title} Quote</h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Full Name *</label>
                        <input
                          type="text"
                          placeholder="John Smith"
                          value={form.full_name}
                          onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                          required
                          className="w-full px-4 py-3 bg-[#112240] border border-gray-700 rounded-sm text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Company</label>
                        <input
                          type="text"
                          placeholder="Your Company"
                          value={form.company}
                          onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                          className="w-full px-4 py-3 bg-[#112240] border border-gray-700 rounded-sm text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Email *</label>
                        <input
                          type="email"
                          placeholder="john@company.com"
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          required
                          className="w-full px-4 py-3 bg-[#112240] border border-gray-700 rounded-sm text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Phone</label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={form.phone}
                          onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full px-4 py-3 bg-[#112240] border border-gray-700 rounded-sm text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Shipment Details</label>
                      <textarea
                        rows={4}
                        placeholder={`Tell us about your ${service.title.toLowerCase()} requirements...`}
                        value={form.details}
                        onChange={(e) => setForm(f => ({ ...f, details: e.target.value }))}
                        className="w-full px-4 py-3 bg-[#112240] border border-gray-700 rounded-sm text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>
                    {error && (
                      <p className="text-red-400 text-xs font-medium bg-red-500/10 px-3 py-2 rounded-sm">{error}</p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-6 py-3.5 bg-blue-600 text-white font-medium hover:bg-blue-500 transition-all rounded-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                      ) : (
                        <><Send className="w-4 h-4" /> Submit Request</>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

/* ─── OTHER SERVICES SECTION ────────────────────────────────────── */
const OtherServicesSection: React.FC<{ currentSlug: string }> = ({ currentSlug }) => {
  const others = serviceDetails.filter(s => s.slug !== currentSlug).slice(0, 3);

  return (
    <section className="py-16 sm:py-20 bg-[#f8f9fb] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal direction="bottom">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
              Explore More
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0a192f]">Other Services You May Need</h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {others.map((s, i) => (
            <Reveal key={s.slug} direction="bottom" delay={i * 0.1}>
              <Link to={`/services/${s.slug}`} className="block group">
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-sm overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-500 h-full"
                >
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={s.heroImage}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f]/60 to-transparent" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-[#0a192f] mb-2 group-hover:text-blue-600 transition-colors flex items-center justify-between">
                      {s.title}
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">{s.tagline}</p>
                  </div>
                </motion.div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── MAIN PAGE ─────────────────────────────────────────────────── */
const ServiceDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const service = serviceDetails.find(s => s.slug === slug);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (!service) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl font-bold text-[#0a192f] mb-4">Service Not Found</h1>
          <p className="text-gray-500 mb-8">The service you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-[#0a192f] text-white font-medium hover:bg-[#112d57] transition-all rounded-sm flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <HeroSection service={service} />
      <OverviewSection service={service} />
      <BenefitsSection service={service} />
      <ServiceTypesSection service={service} />
      <ProcessSection service={service} />
      <GallerySection service={service} />
      <CTASection service={service} />
      <OtherServicesSection currentSlug={service.slug} />
    </Layout>
  );
};

export default ServiceDetailPage;
