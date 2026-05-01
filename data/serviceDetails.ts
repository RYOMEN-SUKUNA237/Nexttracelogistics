export interface ServiceBenefit {
  icon: string; // lucide icon name
  title: string;
  description: string;
}

export interface ServiceType {
  title: string;
  description: string;
  image: string;
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
}

export interface ServiceStat {
  value: string;
  label: string;
}

export interface ServiceDetail {
  slug: string;
  title: string;
  tagline: string;
  heroImage: string;
  overviewTitle: string;
  overviewParagraphs: string[];
  whyChooseTitle: string;
  whyChooseIntro: string;
  benefits: ServiceBenefit[];
  serviceTypesTitle: string;
  serviceTypesIntro: string;
  serviceTypes: ServiceType[];
  processTitle: string;
  processIntro: string;
  processSteps: ProcessStep[];
  stats: ServiceStat[];
  ctaTitle: string;
  ctaDescription: string;
  galleryImages: { src: string; alt: string }[];
}

export const serviceDetails: ServiceDetail[] = [
  // ─── AIR FREIGHT ─────────────────────────────────────────────────
  {
    slug: 'air-freight',
    title: 'Air Freight',
    tagline: 'Fast, Reliable, and Secure Global Air Cargo Solutions',
    heroImage: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Air Freight?',
    overviewParagraphs: [
      'Air freight is the transportation of goods via aircraft — one of the fastest and most reliable methods for moving cargo across continents. Whether you need to ship high-value electronics, time-sensitive pharmaceuticals, or urgent commercial goods, air freight ensures your shipments arrive swiftly and securely.',
      'At Next Trace Logistics, we leverage strategic partnerships with major airlines and cargo carriers across 500+ airports worldwide, delivering seamless air cargo solutions tailored to your unique requirements. Our advanced tracking infrastructure provides real-time visibility from takeoff to touchdown, giving you complete peace of mind throughout the journey.',
      'With decades of experience managing complex air logistics, our team ensures every shipment is handled with precision — from documentation and customs compliance to final-mile delivery at the destination.',
    ],
    whyChooseTitle: 'Why Choose Air Freight?',
    whyChooseIntro: 'Air freight is the preferred mode of transport for businesses that demand speed, security, and global reach. Here\'s why it stands out:',
    benefits: [
      { icon: 'Zap', title: 'Unmatched Speed', description: 'Air freight delivers goods in days rather than weeks. Ideal for urgent shipments, perishable goods, and time-critical supply chains where every hour matters.' },
      { icon: 'Globe', title: 'Global Connectivity', description: 'Access a vast network of 500+ international airports. Ship to virtually any destination worldwide, from major metropolitan hubs to emerging markets.' },
      { icon: 'Shield', title: 'Superior Security', description: 'Stringent security protocols, tamper-proof handling, and rigorous safety checks minimize risks of damage, theft, or loss during transit.' },
      { icon: 'Thermometer', title: 'Temperature-Controlled', description: 'Specialized climate-controlled cargo holds and containers maintain precise temperatures for pharmaceuticals, biologics, and perishable goods.' },
      { icon: 'BarChart3', title: 'Reduced Inventory Costs', description: 'Faster transit times mean less capital tied up in inventory, reduced warehousing needs, and quicker time-to-market for your products.' },
      { icon: 'Eye', title: 'Real-Time Tracking', description: 'Our proprietary tracking system provides live updates at every stage — from origin pickup through customs clearance to final delivery.' },
    ],
    serviceTypesTitle: 'Our Air Freight Services',
    serviceTypesIntro: 'Next Trace Logistics offers a comprehensive range of air freight solutions designed to meet diverse shipping requirements:',
    serviceTypes: [
      { title: 'Standard Air Freight', description: 'Cost-effective air cargo on scheduled commercial flights. Ideal for general merchandise with transit times of 3–7 business days depending on route and destination. Includes full documentation and customs support.', image: 'https://images.unsplash.com/photo-1436491865332-7a61a109db05?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Express Air Freight', description: 'Priority handling and next-flight-out service for time-critical shipments. Guaranteed delivery within 24–72 hours to major global destinations. Includes dedicated tracking and proactive status updates.', image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Charter Services', description: 'Dedicated aircraft for oversized, high-volume, or mission-critical cargo. Full control over scheduling, routing, and handling. Perfect for project logistics, emergency relief, and specialized shipments.', image: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Temperature-Controlled Shipping', description: 'GDP-compliant cold chain logistics for pharmaceuticals, biologics, perishable foods, and temperature-sensitive materials. Active and passive cooling solutions with continuous monitoring.', image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Consolidation Services', description: 'Share aircraft space with other shippers to reduce costs without sacrificing speed. Ideal for smaller shipments that don\'t require a full unit load device (ULD). Competitive rates with reliable schedules.', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Dangerous Goods Handling', description: 'IATA-certified handling and transport of hazardous materials including chemicals, lithium batteries, and flammable goods. Full regulatory compliance, specialized packaging, and trained personnel.', image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Air Freight Works with Next Trace Logistics',
    processIntro: 'Our streamlined air freight process ensures efficiency and transparency at every stage:',
    processSteps: [
      { step: 1, title: 'Consultation & Booking', description: 'Our logistics consultants assess your requirements, recommend the optimal service tier, and handle all booking coordination with carrier partners.' },
      { step: 2, title: 'Packaging & Documentation', description: 'We ensure your cargo is professionally packaged to airline specifications and prepare all required documentation — airway bills, customs declarations, and certificates of origin.' },
      { step: 3, title: 'Customs Clearance', description: 'Our licensed customs brokers manage all import/export formalities, duty calculations, and regulatory compliance to prevent delays at origin and destination.' },
      { step: 4, title: 'Airport Handling & Loading', description: 'Cargo is transported to the departure airport, inspected, weighed, and securely loaded onto the designated aircraft with full chain-of-custody documentation.' },
      { step: 5, title: 'In-Flight Monitoring', description: 'Real-time GPS tracking and status updates keep you informed throughout the flight. Our operations center monitors every shipment 24/7 for proactive issue resolution.' },
      { step: 6, title: 'Arrival & Final Delivery', description: 'Upon landing, we coordinate customs clearance at destination, deconsolidate cargo if needed, and arrange last-mile delivery directly to your specified address.' },
    ],
    stats: [
      { value: '500+', label: 'Airports Covered' },
      { value: '150+', label: 'Countries Served' },
      { value: '24-72h', label: 'Express Delivery' },
      { value: '99.7%', label: 'On-Time Rate' },
    ],
    ctaTitle: 'Ready to Ship by Air?',
    ctaDescription: 'Get a customized air freight quote tailored to your cargo specifications, timeline, and budget. Our team responds within 2 hours during business days.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?fm=jpg&fit=crop&w=600&q=80', alt: 'Cargo aircraft loading' },
      { src: 'https://images.unsplash.com/photo-1436491865332-7a61a109db05?fm=jpg&fit=crop&w=600&q=80', alt: 'Air freight operations' },
      { src: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?fm=jpg&fit=crop&w=600&q=80', alt: 'Express air cargo' },
    ],
  },

  // ─── OCEAN FREIGHT ───────────────────────────────────────────────
  {
    slug: 'ocean-freight',
    title: 'Ocean Freight',
    tagline: 'Cost-Effective Global Shipping Across Every Major Trade Lane',
    heroImage: 'https://images.unsplash.com/photo-1524522173746-f628baad3644?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Ocean Freight?',
    overviewParagraphs: [
      'Ocean freight is the backbone of international trade, responsible for moving over 80% of the world\'s goods. It involves transporting cargo via container ships across maritime routes, offering the most cost-effective solution for large-volume and heavy shipments.',
      'Next Trace Logistics provides comprehensive ocean freight services — from full container loads (FCL) and less-than-container loads (LCL) to specialized reefer and open-top containers. We maintain strategic partnerships with leading ocean carriers to secure competitive rates and guaranteed space across all major trade lanes.',
      'Our maritime logistics team brings deep expertise in port operations, vessel scheduling, customs brokerage, and multimodal integration, ensuring your cargo moves seamlessly from origin port to final destination.',
    ],
    whyChooseTitle: 'Why Choose Ocean Freight?',
    whyChooseIntro: 'Ocean freight remains the preferred choice for businesses shipping large volumes internationally. Here\'s what makes it indispensable:',
    benefits: [
      { icon: 'DollarSign', title: 'Cost-Effective Shipping', description: 'Ocean freight offers the lowest cost-per-unit for large shipments, making it ideal for bulk commodities, raw materials, and high-volume commercial goods.' },
      { icon: 'Container', title: 'Massive Capacity', description: 'Container ships can carry thousands of TEUs (twenty-foot equivalent units), accommodating everything from small parcels to oversized industrial equipment.' },
      { icon: 'Globe', title: 'Global Trade Lanes', description: 'Access every major port worldwide with direct services, transshipment options, and feeder vessel connections covering even the most remote destinations.' },
      { icon: 'Leaf', title: 'Lower Carbon Footprint', description: 'Per ton-kilometer, ocean freight produces significantly fewer emissions than air transport, making it the most environmentally sustainable shipping method.' },
      { icon: 'Box', title: 'Versatile Container Options', description: 'Standard dry containers, reefer units, flat racks, open tops, and tank containers accommodate virtually any cargo type, size, or temperature requirement.' },
      { icon: 'ShieldCheck', title: 'Comprehensive Insurance', description: 'Full marine cargo insurance protects your goods against loss, damage, and unforeseen events throughout the entire maritime journey.' },
    ],
    serviceTypesTitle: 'Our Ocean Freight Services',
    serviceTypesIntro: 'Next Trace Logistics delivers end-to-end ocean freight solutions tailored to your specific trade requirements:',
    serviceTypes: [
      { title: 'Full Container Load (FCL)', description: 'Exclusive use of 20ft or 40ft containers for your cargo. Best for large-volume shipments requiring dedicated space, reduced handling, and faster port processing. Available in standard, high-cube, and specialized configurations.', image: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5eb19?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Less-than-Container Load (LCL)', description: 'Share container space with other shippers to optimize costs for smaller shipments. We handle consolidation at origin and deconsolidation at destination, providing door-to-door convenience without the full-container price tag.', image: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Reefer Container Services', description: 'Temperature-controlled containers for perishable goods, pharmaceuticals, and chemicals. Precise temperature management from -30°C to +30°C with real-time monitoring and automated alerts throughout the voyage.', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Breakbulk & Project Cargo', description: 'Specialized handling for oversized, heavy-lift, and non-containerized cargo. We arrange vessel chartering, heavy-lift cranes, and engineered logistics solutions for industrial projects, energy sector equipment, and infrastructure components.', image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Port-to-Port & Door-to-Door', description: 'Flexible service scopes from simple port-to-port transportation to comprehensive door-to-door solutions including inland haulage, customs clearance, and final-mile delivery.', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Customs Brokerage & Compliance', description: 'Integrated customs clearance services at both origin and destination ports. Our licensed brokers manage tariff classifications, duty optimization, trade compliance, and all documentation requirements.', image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Ocean Freight Works with Next Trace Logistics',
    processIntro: 'Our ocean freight process is designed for transparency and reliability at every stage:',
    processSteps: [
      { step: 1, title: 'Cargo Assessment & Quotation', description: 'We evaluate your cargo dimensions, weight, commodity type, and destination to recommend the optimal container type and shipping route with a competitive quote.' },
      { step: 2, title: 'Booking & Space Confirmation', description: 'We secure vessel space with preferred carriers, confirm sailing schedules, and provide booking confirmations with detailed ETAs and port pair information.' },
      { step: 3, title: 'Container Loading & Drayage', description: 'Containers are delivered to your facility for loading, or cargo is received at our warehouse for expert stuffing. Inland drayage is coordinated to the departure port.' },
      { step: 4, title: 'Export Customs & Port Operations', description: 'All export documentation is processed, customs declarations filed, and containers cleared for loading onto the designated vessel at the port of origin.' },
      { step: 5, title: 'Ocean Transit & Tracking', description: 'Your cargo sails on the planned route with real-time vessel tracking. Our team monitors progress and proactively communicates any schedule changes or disruptions.' },
      { step: 6, title: 'Import Clearance & Delivery', description: 'At destination, we manage import customs clearance, duty payments, container drayage, and final delivery to your designated facility — completing the door-to-door cycle.' },
    ],
    stats: [
      { value: '200+', label: 'Ports Covered' },
      { value: '80%', label: 'Cost Savings vs Air' },
      { value: '15-45', label: 'Days Transit' },
      { value: '50K+', label: 'TEUs Annually' },
    ],
    ctaTitle: 'Ship Smarter by Sea',
    ctaDescription: 'Request an ocean freight quote and let our maritime experts design the most cost-effective shipping strategy for your cargo.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1524522173746-f628baad3644?fm=jpg&fit=crop&w=600&q=80', alt: 'Container ship at port' },
      { src: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5eb19?fm=jpg&fit=crop&w=600&q=80', alt: 'Container yard operations' },
      { src: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?fm=jpg&fit=crop&w=600&q=80', alt: 'Maritime logistics' },
    ],
  },

  // ─── LAND TRANSPORT ──────────────────────────────────────────────
  {
    slug: 'land-transport',
    title: 'Land Transport',
    tagline: 'Reliable Road & Rail Freight Across Continents',
    heroImage: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Land Transport?',
    overviewParagraphs: [
      'Land transport encompasses the movement of goods by road and rail — the critical connective tissue of global supply chains. Whether it\'s full truckload shipments across national highways, cross-border freight through multiple jurisdictions, or intermodal rail solutions for long-distance corridors, land transport provides flexible and dependable logistics.',
      'Next Trace Logistics operates an extensive ground transportation network featuring GPS-tracked fleets, experienced drivers, and strategically positioned hubs. Our road and rail solutions seamlessly integrate with air and ocean freight to deliver true door-to-door coverage anywhere on the map.',
      'From single-pallet LTL shipments to dedicated full truckloads and multi-country overland routes, our land transport division handles every scenario with professionalism, punctuality, and complete supply chain visibility.',
    ],
    whyChooseTitle: 'Why Choose Land Transport?',
    whyChooseIntro: 'Ground freight is the most versatile and accessible mode of transport. Here\'s why it\'s essential:',
    benefits: [
      { icon: 'MapPin', title: 'Door-to-Door Reach', description: 'Unlike air or ocean, trucks deliver directly to any address — from urban business centers to remote industrial sites — without port or airport transfers.' },
      { icon: 'Clock', title: 'Flexible Scheduling', description: 'On-demand, scheduled, and just-in-time delivery options. Trucks depart when your cargo is ready, not according to fixed sailing or flight schedules.' },
      { icon: 'BarChart3', title: 'Cost-Efficient for Regional', description: 'For distances under 2,000 km, road freight typically offers the best balance of speed and cost, especially for time-sensitive domestic and regional shipments.' },
      { icon: 'Eye', title: 'GPS Fleet Tracking', description: 'Every vehicle in our fleet is equipped with real-time GPS tracking, providing live location updates, ETA calculations, and geofence alerts.' },
      { icon: 'Truck', title: 'Diverse Fleet', description: 'From sprinter vans for small parcels to 53-foot trailers for full loads, flatbeds for heavy machinery, and reefer trucks for temperature-sensitive cargo.' },
      { icon: 'FileCheck', title: 'Cross-Border Expertise', description: 'Our teams manage all customs documentation, transit permits, and regulatory compliance for seamless cross-border movements across multiple countries.' },
    ],
    serviceTypesTitle: 'Our Land Transport Services',
    serviceTypesIntro: 'Next Trace Logistics provides a full spectrum of ground freight solutions for every requirement:',
    serviceTypes: [
      { title: 'Full Truckload (FTL)', description: 'Dedicated truck exclusively for your cargo. Maximum security, faster transit, and no handling between pickup and delivery. Available in dry van, flatbed, refrigerated, and specialized configurations.', image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Less-than-Truckload (LTL)', description: 'Cost-effective shared trucking for shipments that don\'t fill an entire trailer. We consolidate multiple shippers\' cargo on optimized routes, reducing costs while maintaining reliable delivery windows.', image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Cross-Border Freight', description: 'Seamless international road freight across borders with full customs management, bond handling, and regulatory compliance. We cover major trade corridors in North America, Europe, and Asia.', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Intermodal Rail Freight', description: 'Combine the long-haul efficiency of rail with the flexibility of trucking. Our intermodal solutions reduce costs by up to 30% on corridors over 1,000 km while cutting carbon emissions significantly.', image: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Last-Mile Delivery', description: 'The critical final leg from distribution center to end customer. We offer scheduled, same-day, and white-glove delivery services with proof-of-delivery, photo capture, and electronic signatures.', image: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Heavy & Oversized Transport', description: 'Specialized equipment and permits for heavy-lift, out-of-gauge, and oversized cargo. Multi-axle trailers, escort vehicles, route surveys, and regulatory coordination for exceptional loads.', image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Land Transport Works with Next Trace Logistics',
    processIntro: 'Our ground freight operations are built on efficiency and reliability:',
    processSteps: [
      { step: 1, title: 'Route Planning & Optimization', description: 'Our logistics algorithms calculate the fastest and most cost-effective route, accounting for traffic patterns, border crossings, weight restrictions, and delivery windows.' },
      { step: 2, title: 'Fleet Assignment & Dispatch', description: 'The optimal vehicle type is assigned based on your cargo specifications. Drivers receive digital manifests, route instructions, and customer contact details.' },
      { step: 3, title: 'Pickup & Loading', description: 'Our driver arrives at your facility within the scheduled window. Cargo is inspected, loaded, secured, and documented with photographic evidence.' },
      { step: 4, title: 'In-Transit Monitoring', description: 'GPS tracking provides live location updates. Our dispatch center monitors every vehicle 24/7, managing rest stops, fuel, border crossings, and schedule adherence.' },
      { step: 5, title: 'Border & Customs Management', description: 'For cross-border shipments, our customs team pre-clears documentation to minimize border wait times and ensure full regulatory compliance.' },
      { step: 6, title: 'Delivery & Proof of Delivery', description: 'Cargo is delivered to the designated address with electronic proof of delivery, signature capture, and instant delivery confirmation notifications.' },
    ],
    stats: [
      { value: '5,000+', label: 'Fleet Vehicles' },
      { value: '98.5%', label: 'On-Time Delivery' },
      { value: '24/7', label: 'GPS Monitoring' },
      { value: '40+', label: 'Countries by Road' },
    ],
    ctaTitle: 'Move Your Cargo by Land',
    ctaDescription: 'Get a competitive ground freight quote. Whether it\'s a single pallet or a fleet of trucks, we have the capacity and expertise to deliver.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?fm=jpg&fit=crop&w=600&q=80', alt: 'Truck on highway' },
      { src: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?fm=jpg&fit=crop&w=600&q=80', alt: 'Fleet operations' },
      { src: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?fm=jpg&fit=crop&w=600&q=80', alt: 'Rail intermodal' },
    ],
  },

  // ─── EXPRESS COURIER ─────────────────────────────────────────────
  {
    slug: 'express-courier',
    title: 'Express Courier',
    tagline: 'Ultra-Fast Parcel & Document Delivery with Guaranteed Timeframes',
    heroImage: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Express Courier?',
    overviewParagraphs: [
      'Express courier is Next Trace Logistics\'s premium rapid delivery service designed for parcels, documents, and small packages that require guaranteed delivery within strict timeframes. From same-day local deliveries to next-day international shipments, our express service combines speed with the reliability that businesses depend on.',
      'Our express courier network utilizes dedicated vehicle fleets, priority cargo slots on commercial flights, and a network of strategically positioned sorting hubs to move your shipments with unmatched velocity. Every express parcel receives a unique tracking ID with minute-by-minute updates.',
      'Whether you\'re sending critical legal documents, e-commerce orders with tight SLAs, medical samples, or time-sensitive industrial components, our express courier service delivers on your promise to your customers — every single time.',
    ],
    whyChooseTitle: 'Why Choose Express Courier?',
    whyChooseIntro: 'When time is of the essence, express courier is the definitive solution:',
    benefits: [
      { icon: 'Zap', title: 'Same-Day Delivery', description: 'For local and regional shipments, our same-day service ensures your package arrives within hours of pickup. Perfect for urgent documents and critical parts.' },
      { icon: 'Clock', title: 'Guaranteed Timeframes', description: 'We offer firm delivery commitments — 2-hour, 4-hour, same-day, next-day, and 2-day options — with money-back guarantees on selected services.' },
      { icon: 'Bell', title: 'Real-Time Notifications', description: 'Automated SMS and email alerts at every milestone: pickup, in-transit, out-for-delivery, and delivered. Your recipients always know when to expect their package.' },
      { icon: 'FileCheck', title: 'Signature on Delivery', description: 'Electronic proof of delivery with recipient signatures, photo confirmation, and GPS-stamped delivery records for complete accountability.' },
      { icon: 'Package', title: 'Flexible Packaging', description: 'From small envelopes to medium-sized parcels, we provide packaging materials and handle fragile items with extra care and protective wrapping.' },
      { icon: 'Headphones', title: 'Dedicated Support', description: 'Priority customer support with a dedicated account manager for business clients. Real-time issue resolution and proactive delivery management.' },
    ],
    serviceTypesTitle: 'Our Express Courier Services',
    serviceTypesIntro: 'Next Trace Logistics offers tiered express services to match your urgency and budget:',
    serviceTypes: [
      { title: 'Same-Day Rush', description: 'The fastest option for local and metro-area deliveries. Pickup within 60 minutes of booking, delivery within 2–4 hours. Ideal for urgent legal documents, medical samples, and critical business materials.', image: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Next-Day Domestic', description: 'Guaranteed next-business-day delivery to any domestic address. Cutoff time for same-day processing is 6:00 PM local time. Includes tracking, insurance up to $1,000, and proof of delivery.', image: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'International Express', description: 'Priority international delivery in 1–3 business days to major global destinations. Includes customs pre-clearance, duty/tax calculation, and end-to-end tracking across borders.', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'E-Commerce Fulfillment', description: 'Integrated express shipping for online retailers. API integration with major e-commerce platforms, automated label generation, batch processing, and branded tracking pages.', image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Medical & Specimen Courier', description: 'Specialized transport for medical specimens, lab samples, and pharmaceutical products. Temperature-controlled packaging, chain-of-custody documentation, and HIPAA-compliant handling.', image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'White-Glove Delivery', description: 'Premium delivery service with inside placement, unpacking, assembly assistance, and debris removal. Perfect for high-value electronics, furniture, and luxury goods.', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Express Courier Works',
    processIntro: 'Our express process is designed for speed and simplicity:',
    processSteps: [
      { step: 1, title: 'Book Online or By Phone', description: 'Schedule a pickup in seconds via our web portal, mobile app, or dedicated phone line. Select your service tier and delivery timeframe.' },
      { step: 2, title: 'Rapid Pickup', description: 'A courier is dispatched immediately to your location. For same-day rush, pickup happens within 60 minutes. Your package is scanned and entered into our tracking system.' },
      { step: 3, title: 'Priority Processing', description: 'Express parcels receive priority handling at our sorting facilities. Packages are routed via the fastest available transport — dedicated vehicles, priority flight slots, or both.' },
      { step: 4, title: 'Live Tracking Updates', description: 'Track your package in real-time via our web tracker or mobile app. Receive automated notifications at every checkpoint along the journey.' },
      { step: 5, title: 'Out for Delivery', description: 'A local courier picks up your package at the destination hub and heads directly to the delivery address. You receive a notification with the courier\'s live ETA.' },
      { step: 6, title: 'Delivered & Confirmed', description: 'The recipient signs digitally, and you receive instant confirmation with proof-of-delivery — including timestamp, GPS location, and signature image.' },
    ],
    stats: [
      { value: '60min', label: 'Pickup Time' },
      { value: '99.2%', label: 'On-Time Rate' },
      { value: '2-4hrs', label: 'Same-Day Delivery' },
      { value: '1M+', label: 'Parcels Monthly' },
    ],
    ctaTitle: 'Need It There Fast?',
    ctaDescription: 'Book an express courier pickup now or get an instant quote for your urgent shipment. Speed is just a click away.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1616432043562-3671ea2e5242?fm=jpg&fit=crop&w=600&q=80', alt: 'Express courier delivery' },
      { src: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?fm=jpg&fit=crop&w=600&q=80', alt: 'Package sorting facility' },
      { src: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80', alt: 'International express' },
    ],
  },

  // ─── WAREHOUSING & DISTRIBUTION ──────────────────────────────────
  {
    slug: 'warehousing',
    title: 'Warehousing & Distribution',
    tagline: 'State-of-the-Art Storage & Fulfillment Solutions at Scale',
    heroImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Warehousing & Distribution?',
    overviewParagraphs: [
      'Warehousing and distribution form the foundation of modern supply chain management. Beyond simple storage, today\'s warehousing encompasses inventory management, order fulfillment, quality control, kitting, labeling, and multi-channel distribution — all coordinated through sophisticated warehouse management systems.',
      'Next Trace Logistics operates a network of strategically located warehousing facilities across key logistics hubs worldwide. Our facilities are equipped with advanced WMS technology, climate-controlled zones, high-security systems, and scalable layouts designed to grow with your business.',
      'Whether you need short-term overflow storage, long-term inventory management, pick-and-pack fulfillment for e-commerce, or a complete third-party logistics (3PL) solution, our warehousing division delivers operational excellence that drives efficiency and reduces costs.',
    ],
    whyChooseTitle: 'Why Choose Professional Warehousing?',
    whyChooseIntro: 'Outsourcing warehousing to Next Trace Logistics unlocks significant operational and financial advantages:',
    benefits: [
      { icon: 'BarChart3', title: 'Inventory Optimization', description: 'Real-time inventory visibility, automated reorder alerts, FIFO/LIFO management, and cycle counting ensure your stock levels are always accurate and optimized.' },
      { icon: 'Thermometer', title: 'Climate-Controlled Storage', description: 'Temperature and humidity-controlled zones for pharmaceuticals, food products, electronics, and other sensitive goods requiring specific environmental conditions.' },
      { icon: 'Shield', title: 'Enterprise Security', description: '24/7 CCTV surveillance, access-controlled zones, fire suppression systems, and comprehensive insurance coverage protect your valuable inventory.' },
      { icon: 'Zap', title: 'Fast Order Fulfillment', description: 'Automated picking systems, barcode/RFID scanning, and optimized workflows enable same-day order processing with 99.9% accuracy rates.' },
      { icon: 'TrendingUp', title: 'Scalable Capacity', description: 'Flexible space allocation that scales with your business seasonality. Expand during peak seasons and consolidate during quieter periods — pay only for what you use.' },
      { icon: 'RotateCcw', title: 'Returns Management', description: 'Complete reverse logistics processing including inspection, restocking, refurbishment, and disposal — keeping your returns workflow efficient and cost-effective.' },
    ],
    serviceTypesTitle: 'Our Warehousing Services',
    serviceTypesIntro: 'Next Trace Logistics provides comprehensive warehousing and distribution solutions:',
    serviceTypes: [
      { title: 'General Warehousing', description: 'Flexible storage for general merchandise in secure, well-maintained facilities. Racking systems, bulk storage, and floor stacking options. Short-term and long-term contracts available.', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'E-Commerce Fulfillment', description: 'End-to-end order fulfillment for online retailers. Integration with Shopify, Amazon, WooCommerce, and other platforms. Pick, pack, ship, and track — all managed from our facilities.', image: 'https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Cold Chain Storage', description: 'Temperature-controlled warehousing from -25°C to +25°C for perishable goods, pharmaceuticals, and chemicals. HACCP and GDP-compliant facilities with continuous temperature monitoring.', image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Cross-Docking', description: 'Minimize storage time by transferring incoming freight directly to outbound vehicles. Ideal for fast-moving consumer goods, retail distribution, and just-in-time supply chains.', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Kitting & Value-Added Services', description: 'Custom kitting, assembly, labeling, repackaging, quality inspection, and gift wrapping. Transform your raw products into retail-ready inventory within our facilities.', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Bonded Warehousing', description: 'Customs-bonded facilities for duty-deferred storage of imported goods. Reduce cash flow impact by paying duties only when goods are released for domestic distribution.', image: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5eb19?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Warehousing Works with Next Trace Logistics',
    processIntro: 'Our warehousing operations follow rigorous standard operating procedures:',
    processSteps: [
      { step: 1, title: 'Onboarding & Setup', description: 'We assess your product specifications, volume forecasts, and operational requirements to design an optimal warehouse layout and workflow configuration.' },
      { step: 2, title: 'Goods Receipt & Inspection', description: 'Incoming shipments are received, inspected for damage, counted, barcoded, and entered into our WMS. Discrepancies are flagged and resolved immediately.' },
      { step: 3, title: 'Storage & Inventory Management', description: 'Products are stored in designated zones based on velocity, size, and environmental requirements. Real-time inventory levels are accessible via your client portal.' },
      { step: 4, title: 'Order Processing', description: 'Orders received via API, EDI, or portal are automatically processed. Our pick-pack team fulfills orders with barcode verification at every step for 99.9% accuracy.' },
      { step: 5, title: 'Shipping & Distribution', description: 'Packed orders are labeled, manifested, and handed off to carriers. We select the optimal carrier based on destination, speed, and cost parameters.' },
      { step: 6, title: 'Reporting & Analytics', description: 'Comprehensive reporting dashboards provide visibility into inventory levels, order accuracy, fulfillment speed, and cost metrics — enabling data-driven supply chain decisions.' },
    ],
    stats: [
      { value: '2M+', label: 'Sq Ft Capacity' },
      { value: '99.9%', label: 'Order Accuracy' },
      { value: '50K+', label: 'Orders Daily' },
      { value: '15+', label: 'Global Hubs' },
    ],
    ctaTitle: 'Optimize Your Supply Chain',
    ctaDescription: 'Let Next Trace Logistics design a warehousing and distribution strategy that reduces costs, improves speed, and scales with your business.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=600&q=80', alt: 'Modern warehouse' },
      { src: 'https://images.unsplash.com/photo-1553413077-190dd305871c?fm=jpg&fit=crop&w=600&q=80', alt: 'Order fulfillment' },
      { src: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80', alt: 'Cold chain storage' },
    ],
  },

  // ─── SPECIALIZED CARGO ───────────────────────────────────────────
  {
    slug: 'specialized-cargo',
    title: 'Specialized Cargo',
    tagline: 'Expert Handling for High-Value, Oversized, and Sensitive Shipments',
    heroImage: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Specialized Cargo?',
    overviewParagraphs: [
      'Specialized cargo requires logistics expertise that goes far beyond standard shipping. It encompasses oversized and heavy-lift equipment, high-value goods, hazardous materials, temperature-sensitive pharmaceuticals, fine art, military-grade supplies, and any shipment requiring custom handling protocols.',
      'Next Trace Logistics\'s specialized cargo division brings together project logistics engineers, certified dangerous goods handlers, fine art specialists, and pharmaceutical logistics experts. We design bespoke transport solutions that address the unique challenges each specialized shipment presents.',
      'From engineering route surveys for wind turbine blades to maintaining unbroken cold chains for life-saving biologics, our team has the experience, equipment, certifications, and global network to move your most critical and challenging cargo safely and on schedule.',
    ],
    whyChooseTitle: 'Why Choose Specialized Cargo Services?',
    whyChooseIntro: 'When standard logistics aren\'t enough, specialized cargo services provide the expertise and infrastructure your shipments demand:',
    benefits: [
      { icon: 'Shield', title: 'Certified Handlers', description: 'Our teams hold IATA DGR, ADR, IMDG, and other industry certifications for handling hazardous materials, dangerous goods, and regulated commodities safely and legally.' },
      { icon: 'Ruler', title: 'Custom Engineering', description: 'Our project logistics engineers design bespoke cradles, frames, and support structures for oversized and irregularly shaped cargo, ensuring safe loading and transport.' },
      { icon: 'Thermometer', title: 'Cold Chain Integrity', description: 'GDP and CEIV Pharma-certified cold chain solutions with continuous temperature monitoring, data loggers, and deviation alerts from origin to destination.' },
      { icon: 'Lock', title: 'High-Security Transport', description: 'Armed escorts, GPS-tracked secure vehicles, tamper-evident seals, and real-time monitoring for high-value goods including precious metals, electronics, and luxury items.' },
      { icon: 'FileCheck', title: 'Regulatory Compliance', description: 'Complete documentation management for specialized cargo including permits, licenses, safety data sheets, certificates of conformity, and export/import approvals.' },
      { icon: 'Users', title: 'Dedicated Project Team', description: 'Every specialized shipment receives a dedicated project manager and logistics team who coordinate all aspects from planning through execution and delivery.' },
    ],
    serviceTypesTitle: 'Our Specialized Cargo Services',
    serviceTypesIntro: 'Next Trace Logistics offers expert handling across a wide range of specialized cargo categories:',
    serviceTypes: [
      { title: 'Heavy-Lift & Project Cargo', description: 'Transport of oversized industrial equipment, turbines, transformers, and construction machinery. Route surveys, multi-axle trailers, crane operations, and police escorts for exceptional loads.', image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Pharmaceutical & Healthcare', description: 'GDP-compliant transport of medicines, vaccines, clinical trial materials, and medical devices. Active and passive temperature solutions, quality management systems, and full audit trails.', image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Fine Art & Museum Pieces', description: 'White-glove handling of paintings, sculptures, antiques, and museum collections. Custom crating, climate-controlled vehicles, art-specific insurance, and installation services at destination.', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Dangerous Goods (HAZMAT)', description: 'Fully certified transport of hazardous materials across all nine UN classes. Specialized packaging, placarding, emergency response documentation, and trained personnel for road, air, and sea.', image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Military & Defense Logistics', description: 'Secure transport of defense equipment, supplies, and sensitive materials. Government-cleared personnel, classified handling protocols, and compliance with ITAR and EAR regulations.', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Automotive & Motorsport', description: 'Transport of racing cars, prototype vehicles, show cars, and automotive components. Enclosed carriers, hydraulic lift loading, vehicle tracking, and event logistics coordination.', image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Specialized Cargo Works',
    processIntro: 'Every specialized shipment follows a meticulously planned process:',
    processSteps: [
      { step: 1, title: 'Technical Assessment', description: 'Our engineers evaluate your cargo dimensions, weight, sensitivity, and regulatory requirements. A detailed risk assessment and transport plan is developed.' },
      { step: 2, title: 'Solution Design', description: 'We design the optimal transport solution including route selection, vehicle/vessel specification, packaging requirements, and contingency planning.' },
      { step: 3, title: 'Permits & Documentation', description: 'All necessary permits, licenses, and regulatory approvals are obtained. Safety data sheets, handling instructions, and emergency response plans are prepared.' },
      { step: 4, title: 'Custom Packaging & Loading', description: 'Specialized crating, bracing, and packaging is fabricated. Loading is supervised by our engineers using calibrated equipment and documented with photos and measurements.' },
      { step: 5, title: 'Monitored Transport', description: 'Real-time monitoring of location, temperature, shock, and tilt throughout transit. A dedicated project manager coordinates all logistics partners and stakeholders.' },
      { step: 6, title: 'Safe Delivery & Installation', description: 'Cargo is delivered to the final site with supervised unloading, positioning, and optional installation or assembly services. Full handover documentation is provided.' },
    ],
    stats: [
      { value: '10K+', label: 'Projects Completed' },
      { value: '100%', label: 'Safety Record' },
      { value: '50+', label: 'Certifications' },
      { value: '24/7', label: 'Monitoring' },
    ],
    ctaTitle: 'Have a Complex Shipment?',
    ctaDescription: 'Our specialized cargo team thrives on complexity. Describe your shipment and we\'ll design a custom logistics solution.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?fm=jpg&fit=crop&w=600&q=80', alt: 'Specialized cargo handling' },
      { src: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&fit=crop&w=600&q=80', alt: 'Heavy-lift project' },
      { src: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?fm=jpg&fit=crop&w=600&q=80', alt: 'Pharmaceutical logistics' },
    ],
  },

  // ─── ANIMAL DELIVERY ──────────────────────────────────────────────
  {
    slug: 'animal-delivery',
    title: 'Animal & Pet Transport',
    tagline: 'Safe, Humane, and Stress-Free Transport for Pets & Live Animals',
    heroImage: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?fm=jpg&fit=crop&w=2000&q=80',
    overviewTitle: 'What is Animal & Pet Transport?',
    overviewParagraphs: [
      'Animal and pet transport is a highly specialized logistics service dedicated to the safe, humane, and comfortable relocation of live animals — from beloved family pets and show-quality purebreds to exotic species, livestock, and laboratory animals. Unlike standard cargo, live animal transport demands meticulous attention to welfare, regulatory compliance, and environmental controls throughout every stage of the journey.',
      'At Next Trace Logistics, our Animal Transport Division is staffed by certified animal handlers, veterinary consultants, and logistics specialists who understand that your animals are not cargo — they are family. We design bespoke transport plans that prioritize animal welfare above all else, ensuring comfortable temperatures, proper ventilation, adequate hydration, and minimal stress from origin to destination.',
      'Whether you\'re relocating internationally with your dog, shipping breeding livestock across state lines, transporting exotic reptiles for a zoological program, or moving laboratory animals under strict protocol, Next Trace Logistics provides end-to-end solutions that comply with IATA Live Animals Regulations (LAR), USDA-APHIS requirements, CITES conventions, and all local animal welfare laws.',
    ],
    whyChooseTitle: 'Why Choose Professional Animal Transport?',
    whyChooseIntro: 'Transporting live animals requires expertise, certified equipment, and unwavering commitment to animal welfare. Here\'s why Next Trace Logistics stands apart:',
    benefits: [
      { icon: 'Heart', title: 'Animal Welfare First', description: 'Every transport plan is designed around the animal\'s comfort and safety. Climate-controlled environments, species-appropriate crates, scheduled feeding stops, and constant welfare monitoring throughout the journey.' },
      { icon: 'ShieldCheck', title: 'Fully Certified & Compliant', description: 'IATA LAR-certified, USDA-APHIS registered, and compliant with CITES and all international animal import/export regulations. Licensed veterinary oversight at every stage of transport.' },
      { icon: 'Thermometer', title: 'Climate-Controlled Transit', description: 'Temperature and humidity-controlled vehicles, cargo holds, and holding facilities maintain species-specific comfort zones — from tropical reptiles to cold-climate breeds.' },
      { icon: 'Eye', title: 'Real-Time Wellness Tracking', description: 'GPS location tracking combined with live environmental sensors monitoring temperature, humidity, and ventilation. Receive photo and video updates of your animal during transit.' },
      { icon: 'Users', title: 'Trained Animal Handlers', description: 'Our handlers are certified in animal first aid, species-specific behavior, and stress-reduction techniques. Many are qualified veterinary technicians with years of animal care experience.' },
      { icon: 'FileCheck', title: 'Complete Documentation', description: 'We manage all veterinary certificates, health inspections, import/export permits, microchip verification, vaccination records, and quarantine arrangements required for domestic and international moves.' },
    ],
    serviceTypesTitle: 'Our Animal Transport Services',
    serviceTypesIntro: 'Next Trace Logistics offers comprehensive animal transport solutions tailored to every species, size, and destination:',
    serviceTypes: [
      { title: 'Domestic Pet Relocation', description: 'Door-to-door transport for dogs, cats, and small pets within the country. Includes home pickup, IATA-approved crate provisioning, comfort accessories, and delivery to your new residence. Ideal for family relocations, military PCS moves, and long-distance adoptions.', image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'International Pet Shipping', description: 'Full-service global pet relocation including veterinary pre-travel exams, import permit applications, customs clearance, airline coordination, and quarantine management at destination. We navigate complex country-specific requirements for seamless cross-border moves.', image: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Livestock & Farm Animals', description: 'Professional transport of cattle, horses, sheep, goats, poultry, and other farm animals using purpose-built livestock trailers with proper ventilation, non-slip flooring, compartmentalization, and on-board water systems. USDA-compliant handling at every stage.', image: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Exotic & Zoo Animals', description: 'Specialized transport for reptiles, birds, primates, marine life, and other exotic species. Custom enclosures designed to species specifications, CITES documentation management, and climate systems calibrated to precise temperature and humidity ranges.', image: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Equine Transport', description: 'Premium horse transport in climate-controlled, padded stalls with individual partitions. Experienced equine handlers, scheduled rest and water stops, and real-time GPS tracking. Services include competition transport, breeding transfers, and international equine relocation.', image: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?fm=jpg&fit=crop&w=600&q=80' },
      { title: 'Laboratory & Research Animals', description: 'GLP-compliant transport of laboratory animals under strict biosecurity and welfare protocols. Temperature-controlled vehicles, sterile enclosures, chain-of-custody documentation, and IACUC-approved transport plans for mice, rats, rabbits, and other research species.', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?fm=jpg&fit=crop&w=600&q=80' },
    ],
    processTitle: 'How Animal Transport Works with Next Trace Logistics',
    processIntro: 'Our animal transport process is built on safety, compliance, and compassion at every step:',
    processSteps: [
      { step: 1, title: 'Consultation & Assessment', description: 'We gather details about your animal — species, breed, age, health status, temperament, and special needs. Our team assesses destination requirements, travel routes, and optimal transport methods to create a personalized plan.' },
      { step: 2, title: 'Veterinary Preparation', description: 'Our veterinary partners conduct pre-travel health examinations, update vaccinations, issue health certificates, and ensure all medical documentation meets origin and destination country requirements. Microchip verification is performed.' },
      { step: 3, title: 'Crate Fitting & Acclimatization', description: 'We provide an IATA-compliant travel crate sized to your animal\'s specifications. For pets, we recommend a 1–2 week acclimatization period where the animal becomes comfortable with their travel crate at home before departure.' },
      { step: 4, title: 'Pickup & Comfort Boarding', description: 'Our certified handler picks up your animal from your home or facility. Animals are transported to our climate-controlled holding facility for pre-departure health checks, feeding, exercise, and any final preparations.' },
      { step: 5, title: 'In-Transit Care & Monitoring', description: 'During transport, animals receive scheduled feeding, watering, and welfare checks. Environmental conditions are continuously monitored. You receive real-time GPS updates and photo/video check-ins from our handlers.' },
      { step: 6, title: 'Arrival & Safe Handover', description: 'At the destination, we manage customs clearance and any required quarantine processes. Your animal is delivered to the designated address with all veterinary documentation, feeding instructions, and a detailed journey report.' },
    ],
    stats: [
      { value: '25K+', label: 'Animals Transported' },
      { value: '100%', label: 'Safety Record' },
      { value: '80+', label: 'Countries Served' },
      { value: '24/7', label: 'Welfare Monitoring' },
    ],
    ctaTitle: 'Transport Your Animals with Confidence',
    ctaDescription: 'Request a personalized animal transport quote. Share your animal\'s details and destination, and our specialists will design a safe, comfortable journey plan.',
    galleryImages: [
      { src: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?fm=jpg&fit=crop&w=600&q=80', alt: 'Dogs being walked' },
      { src: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?fm=jpg&fit=crop&w=600&q=80', alt: 'Golden retriever pet transport' },
      { src: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?fm=jpg&fit=crop&w=600&q=80', alt: 'Equine transport' },
    ],
  },
];
