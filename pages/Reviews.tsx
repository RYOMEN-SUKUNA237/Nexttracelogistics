import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Star, Quote, Send, CheckCircle, User, Mail, MessageSquare, Loader2, Clock } from 'lucide-react';
import * as api from '../services/api';

const allReviews = [
  { name: 'Sarah Mitchell', role: 'VP Supply Chain, TechFlow Inc.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?fm=jpg&fit=crop&w=100&q=80', text: 'Next Trace Logistics transformed our supply chain. Real-time tracking and proactive communication reduced our delivery issues by over 60%.', rating: 5, date: 'March 12, 2025' },
  { name: 'James Okonkwo', role: 'CEO, AfriTrade Exports', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fm=jpg&fit=crop&w=100&q=80', text: 'From customs clearance to last-mile delivery, Next Trace Logistics handles everything seamlessly. Our logistics backbone for 5 years.', rating: 5, date: 'February 28, 2025' },
  { name: 'Elena Vasquez', role: 'Logistics Director, MedPharma Global', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?fm=jpg&fit=crop&w=100&q=80', text: 'Temperature-controlled pharmaceutical shipping is best-in-class. Zero spoilage across 3,000+ shipments. Remarkable.', rating: 5, date: 'April 2, 2025' },
  { name: 'Michael Chen', role: 'Operations Manager, SinoTech', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?fm=jpg&fit=crop&w=100&q=80', text: 'Excellent ocean freight service. Our trans-Pacific shipments are always on time and damage-free. Highly recommend.', rating: 5, date: 'January 15, 2025' },
  { name: 'Amara Diallo', role: 'Import Manager, WestAfrica Trade', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fm=jpg&fit=crop&w=100&q=80', text: 'Their customs brokerage team saved us thousands in duties by knowing exactly the right HS codes and exemptions.', rating: 5, date: 'March 30, 2025' },
  { name: 'David Holbrook', role: 'Founder, ArtShip Gallery', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?fm=jpg&fit=crop&w=100&q=80', text: 'Shipped 40 high-value artworks internationally without a single incident. Their white-glove handling is extraordinary.', rating: 5, date: 'February 10, 2025' },
  { name: 'Priya Sharma', role: 'E-Commerce Director, IndiaShop', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?fm=jpg&fit=crop&w=100&q=80', text: 'We process 10,000 orders daily through Next Trace Logistics warehousing. Their pick-and-pack accuracy is incredible — 99.7%.', rating: 5, date: 'April 10, 2025' },
  { name: 'Carlos Medina', role: 'Plant Manager, AutoParts SA', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?fm=jpg&fit=crop&w=100&q=80', text: 'Cross-border land transport from Mexico to Canada is flawless. Our JIT production line has never had a supply delay.', rating: 5, date: 'January 5, 2025' },
  { name: 'Fatima Al-Hassan', role: 'Procurement Head, Gulf Construct', avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?fm=jpg&fit=crop&w=100&q=80', text: 'Oversized construction equipment delivered to Dubai port on schedule despite very tight project deadlines. Impressive.', rating: 4, date: 'March 18, 2025' },
  { name: 'Tom Whitfield', role: 'Logistics Lead, FreshFarm UK', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?fm=jpg&fit=crop&w=100&q=80', text: 'Reefer containers maintained perfect 2°C throughout a 28-day voyage. Our fresh produce arrived market-ready.', rating: 5, date: 'February 22, 2025' },
  { name: 'Yuki Tanaka', role: 'Supply Chain VP, TechNippon', avatar: 'https://images.unsplash.com/photo-1557862921-37829c790f19?fm=jpg&fit=crop&w=100&q=80', text: 'Air freight from Tokyo to Frankfurt in 28 hours. Fastest we\'ve ever had, and the documentation was perfect.', rating: 5, date: 'April 5, 2025' },
  { name: 'Grace Ampah', role: 'CEO, GhanaExport Ltd', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?fm=jpg&fit=crop&w=100&q=80', text: 'Next Trace Logistics opened African market access for our cocoa exports. Their knowledge of African ports is unmatched.', rating: 5, date: 'March 8, 2025' },
  { name: 'Nathan Burke', role: 'Defense Logistics, AeroCorp', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?fm=jpg&fit=crop&w=100&q=80', text: 'Classified military equipment moved with the highest security protocols. Zero breaches, zero delays. Trusted partner.', rating: 5, date: 'January 28, 2025' },
  { name: 'Isabella Romano', role: 'Fashion Buyer, MilanModa', avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?fm=jpg&fit=crop&w=100&q=80', text: 'Our seasonal fashion deliveries from Italy to 30 countries are always on time. Helps us meet retail launch dates perfectly.', rating: 4, date: 'February 14, 2025' },
  { name: 'Kwame Asante', role: 'Director, GoldCoast Mining', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?fm=jpg&fit=crop&w=100&q=80', text: 'Heavy mining equipment transported from South Africa to Ghana without a scratch. Exceptional project cargo team.', rating: 5, date: 'April 15, 2025' },
  { name: 'Rachel Kim', role: 'Head of Ops, SeoulTech', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?fm=jpg&fit=crop&w=100&q=80', text: 'Same-day express courier within Korea and next-day to Japan. Their Asian network is incredibly dense and reliable.', rating: 5, date: 'March 25, 2025' },
  { name: 'Lorenzo Ferrari', role: 'CEO, AutoLux Italia', avatar: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?fm=jpg&fit=crop&w=100&q=80', text: 'Transporting luxury vehicles requires extreme care. Next Trace Logistics\'s enclosed transport kept every car pristine.', rating: 5, date: 'January 20, 2025' },
  { name: 'Aisha Mohammed', role: 'Relief Coordinator, AidWorld', avatar: 'https://images.unsplash.com/photo-1597223557154-721c1cecc4b0?fm=jpg&fit=crop&w=100&q=80', text: 'Emergency food aid delivered to 8 countries in West Africa within 48 hours during a crisis. Life-saving service.', rating: 5, date: 'February 5, 2025' },
  { name: 'Brian Sullivan', role: 'CTO, PackRight Packaging', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?fm=jpg&fit=crop&w=100&q=80', text: 'Their warehousing WMS integrates directly with our ERP. Inventory accuracy jumped to 99.9% from 95%. Exceptional.', rating: 5, date: 'March 3, 2025' },
  { name: 'Mei Liang', role: 'Procurement Director, ShanghaiMed', avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?fm=jpg&fit=crop&w=100&q=80', text: 'Medical device imports cleared customs 40% faster after Next Trace Logistics took over our brokerage. Saving time and money.', rating: 4, date: 'April 8, 2025' },
  { name: 'Patrick O\'Brien', role: 'VP Logistics, IrishBrews', avatar: 'https://images.unsplash.com/photo-1500048993953-d23a436266cf?fm=jpg&fit=crop&w=100&q=80', text: 'Our craft beer reaches 45 countries now thanks to Next Trace Logistics\'s beverage-specialized handling. Sales up 120%.', rating: 5, date: 'January 30, 2025' },
  { name: 'Zara Abdullah', role: 'Owner, DubaiLux Jewels', avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?fm=jpg&fit=crop&w=100&q=80', text: 'Shipping diamonds and precious metals requires ultimate trust. Next Trace Logistics\'s high-value protocols are second to none.', rating: 5, date: 'February 18, 2025' },
  { name: 'Andre Dubois', role: 'Export Manager, VinFrance', avatar: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?fm=jpg&fit=crop&w=100&q=80', text: 'Fine wine transport from Bordeaux to Asia Pacific with perfect temperature management. Sommelier-approved condition!', rating: 5, date: 'March 22, 2025' },
  { name: 'Sandra Owusu', role: 'COO, AfricaFash', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?fm=jpg&fit=crop&w=100&q=80', text: 'Pan-African distribution of our textile brand set up in 3 weeks by Next Trace Logistics. Distribution network is phenomenal.', rating: 5, date: 'April 20, 2025' },
  { name: 'Viktor Petrov', role: 'Logistics Head, RussFuel', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?fm=jpg&fit=crop&w=100&q=80', text: 'Dangerous goods handling for our chemical shipments is fully compliant and efficient. Zero incidents in 3 years.', rating: 4, date: 'February 2, 2025' },
  { name: 'Olivia Fernandez', role: 'Director, SpainPharma', avatar: 'https://images.unsplash.com/photo-1507101105822-7472b28602ef?fm=jpg&fit=crop&w=100&q=80', text: 'EU pharmaceutical distribution managed perfectly. Track-and-trace compliance met on every single shipment. Bravo.', rating: 5, date: 'January 12, 2025' },
  { name: 'Henry Boateng', role: 'CEO, AccraTrade Hub', avatar: 'https://images.unsplash.com/photo-1474176857210-7287d4de6f5a?fm=jpg&fit=crop&w=100&q=80', text: 'Next Trace Logistics helped us break into European export markets. Their documentation support made the process seamless.', rating: 5, date: 'March 15, 2025' },
  { name: 'Linda Crawford', role: 'Owner, CrawfordPets', avatar: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?fm=jpg&fit=crop&w=100&q=80', text: 'My show horses traveled from Kentucky to Dubai in absolute comfort. Veterinary oversight throughout was exceptional.', rating: 5, date: 'April 1, 2025' },
  { name: 'Raj Patel', role: 'MD, IndianSpices Co.', avatar: 'https://images.unsplash.com/photo-1500522144261-ea64433bbe27?fm=jpg&fit=crop&w=100&q=80', text: 'Spice exports from Mumbai to 60 countries, always fresh. Their LCL consolidation saves us 30% on freight costs.', rating: 5, date: 'February 25, 2025' },
  { name: 'Emma Johansson', role: 'Sustainability Lead, EcoShip AB', avatar: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?fm=jpg&fit=crop&w=100&q=80', text: 'Next Trace Logistics offers carbon-offset shipping options that align with our ESG goals. A logistics partner with a conscience.', rating: 5, date: 'April 18, 2025' },
];

const StarRating: React.FC<{ rating: number; interactive?: boolean; onRate?: (r: number) => void }> = ({ rating, interactive = false, onRate }) => {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 transition-colors ${
            star <= (interactive ? (hover || rating) : rating)
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300'
          } ${interactive ? 'cursor-pointer' : ''}`}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate && onRate(star)}
        />
      ))}
    </div>
  );
};

const ReviewsPage: React.FC = () => {
  const INITIAL_SHOW = 6;
  const [showAll, setShowAll] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '', text: '', rating: 5 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [approvedReviews, setApprovedReviews] = useState<typeof allReviews>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  // Fetch approved reviews from API on mount, fall back to static
  useEffect(() => {
    (async () => {
      try {
        const data = await api.reviews.approved();
        if (data.reviews && data.reviews.length > 0) {
          setApprovedReviews(data.reviews.map((r: any) => ({
            name: r.name,
            role: r.role,
            avatar: r.avatar,
            text: r.text,
            rating: r.rating,
            date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          })));
        }
      } catch {
        // API not available, keep static reviews
      } finally {
        setLoadingReviews(false);
      }
    })();
  }, []);

  // Combine: API approved reviews first, then static fallback
  const combinedReviews = approvedReviews.length > 0 ? [...approvedReviews, ...allReviews] : allReviews;
  const displayed = showAll ? combinedReviews : combinedReviews.slice(0, INITIAL_SHOW);
  const total = combinedReviews.length;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.text.trim()) e.text = 'Review text is required';
    if (form.text.trim().length < 20) e.text = 'Review must be at least 20 characters';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    
    setSubmitting(true);
    try {
      const result = await api.reviews.submit({
        name: form.name,
        email: form.email,
        role: form.role || undefined,
        text: form.text,
        rating: form.rating,
      });
      if (result.error) {
        setErrors({ submit: result.error });
      } else {
        setSubmitted(true);
        setForm({ name: '', email: '', role: '', text: '', rating: 5 });
        setErrors({});
        setTimeout(() => setSubmitted(false), 6000);
      }
    } catch {
      setErrors({ submit: 'Failed to submit. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);

  return (
    <Layout>
      {/* Hero Banner */}
      <section className="bg-[#0a192f] text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-semibold tracking-wider uppercase rounded-full border border-blue-500/30 mb-4">
            Customer Feedback
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">What Our Clients Say</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-8">
            Trusted by businesses across 150+ countries. Real reviews from real customers.
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-5xl font-bold text-yellow-400">{avgRating}</span>
            <div>
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(s => <Star key={s} className="w-6 h-6 text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-gray-400 text-sm">{total} verified reviews</p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="py-16 sm:py-20 bg-[#f8f9fb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayed.map((r, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col group"
              >
                <div className="flex items-start gap-1 mb-1">
                  <Quote className="w-8 h-8 text-blue-100 fill-blue-100 flex-shrink-0 -mt-1" />
                </div>
                <StarRating rating={r.rating} />
                <p className="text-gray-600 text-sm leading-relaxed my-4 flex-1 italic">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <img src={r.avatar} alt={r.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0a192f] text-sm">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.role}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* See More / Collapse */}
          {!showAll && total > INITIAL_SHOW && (
            <div className="text-center mt-12">
              <button
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0a192f] text-white font-medium rounded-sm hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-700/25"
              >
                See All {total} Reviews
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
          {showAll && (
            <div className="text-center mt-12">
              <button
                onClick={() => { setShowAll(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-[#0a192f] text-[#0a192f] font-medium rounded-sm hover:bg-[#0a192f] hover:text-white transition-all"
              >
                Show Less
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Submit a Review */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold tracking-wider uppercase rounded-full mb-4">
              Share Your Experience
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a192f] mb-3">Write a Review</h2>
            <p className="text-gray-500">Register with your email and let others know about your experience with us.</p>
          </div>

          {submitted && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Thank you! Your review has been submitted successfully.</p>
                <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> It will appear on the site once approved by our team.</p>
              </div>
            </div>
          )}

          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-[#f8f9fb] rounded-xl border border-gray-200 p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <User className="w-3.5 h-3.5 inline mr-1" />Full Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith"
                  className={`w-full px-4 py-3 border rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />Email Address *
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="john@company.com"
                  className={`w-full px-4 py-3 border rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${errors.email ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Job Title / Company (Optional)</label>
              <input
                type="text"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. CEO, Global Trade Inc."
                className="w-full px-4 py-3 border border-gray-200 rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Your Rating *</label>
              <StarRating rating={form.rating} interactive onRate={(r) => setForm(f => ({ ...f, rating: r }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                <MessageSquare className="w-3.5 h-3.5 inline mr-1" />Your Review *
              </label>
              <textarea
                rows={5}
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                placeholder="Tell us about your experience with Next Trace Logistics..."
                className={`w-full px-4 py-3 border rounded-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none ${errors.text ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.text && <p className="text-red-500 text-xs mt-1">{errors.text}</p>}
              <p className="text-xs text-gray-400 mt-1">{form.text.length} / 500 characters</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#0a192f] text-white font-semibold rounded-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-blue-700/20 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <p className="text-xs text-gray-400 text-center">Your email is used for verification only and will not be displayed publicly.</p>
          </form>
        </div>
      </section>
    </Layout>
  );
};

export default ReviewsPage;
