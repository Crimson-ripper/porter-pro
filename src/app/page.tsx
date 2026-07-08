"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Truck,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronRight,
  Smartphone,
  Wallet,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1E1B4B] rounded-lg flex items-center justify-center">
                <Truck className="text-[#D4AF37] w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-[#1E1B4B]">Premium Courier</span>
            </div>
            <div className="hidden md:flex gap-8 font-medium text-sm">
              <a href="#services" className="hover:text-[#D4AF37] transition-colors">Services</a>
              <a href="#drive" className="hover:text-[#D4AF37] transition-colors">Become a Driver</a>
              <a href="#about" className="hover:text-[#D4AF37] transition-colors">About</a>
            </div>
            <div className="flex gap-4">
              <button className="hidden md:block px-4 py-2 text-sm font-medium text-slate-700 hover:text-[#D4AF37] transition-colors">
                Log In
              </button>
              <button className="bg-[#1E1B4B] hover:bg-opacity-90 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-lg">
                Download App
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-[#1E1B4B]/10 text-[#1E1B4B] text-xs font-bold tracking-wider mb-6">
              #1 PREMIUM LOGISTICS
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight text-slate-900">
              White-glove <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E1B4B] to-[#D4AF37]">
                delivery solutions
              </span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
              Experience logistics that feel like luxury. From critical corporate parcels to personal care items, we deliver with absolute precision and security.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="flex items-center justify-center gap-2 bg-[#D4AF37] text-[#1E1B4B] px-8 py-4 rounded-full text-lg font-bold transition-all shadow-xl hover:shadow-2xl">
                Book a Vehicle <ChevronRight className="w-5 h-5" />
              </button>
              <button className="flex items-center justify-center gap-2 bg-white border border-[#1E1B4B]/20 text-[#1E1B4B] hover:bg-[#1E1B4B]/5 px-8 py-4 rounded-full text-lg font-semibold transition-colors">
                Get an Estimate
              </button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[#1E1B4B] to-[#D4AF37]/50 rounded-[3rem] transform rotate-3 scale-105 -z-10"></div>
            <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border border-slate-100 bg-white">
              <img 
                src="/images/hero.png" 
                alt="Premium Logistics" 
                className="w-full h-auto object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Customer Features */}
      <section id="services" className="py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#1E1B4B]">Excellence in every delivery.</h2>
            <p className="text-slate-600">Experience seamless logistics with our technology-driven platform designed for the utmost reliability.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <MapPin className="w-6 h-6 text-[#D4AF37]" />,
                title: "Live GPS Tracking",
                desc: "Track your premium goods in real-time. Full transparency from our warehouse to your doorstep."
              },
              {
                icon: <Clock className="w-6 h-6 text-[#D4AF37]" />,
                title: "Priority Booking",
                desc: "Get a dedicated vehicle at your doorstep instantly. Our algorithm finds the best driver for fragile goods."
              },
              {
                icon: <ShieldCheck className="w-6 h-6 text-[#D4AF37]" />,
                title: "Elite Drivers",
                desc: "Every driver-partner goes through intense vetting and training to ensure your goods are handled with care."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#1E1B4B] shadow-sm flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-[#1E1B4B]">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Driver Onboarding Section */}
      <section id="drive" className="py-24 bg-[#1E1B4B] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#D4AF37]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#D4AF37] font-semibold tracking-wider text-sm uppercase mb-4 block">For Elite Partners</span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-white">
                Elevate your earning potential.
              </h2>
              <p className="text-slate-300 text-lg mb-10 leading-relaxed">
                Join our premium fleet and earn top-tier rates for your flawless service. 
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: <Smartphone />, title: "1. Download the Partner App", desc: "Available for Elite Drivers." },
                  { icon: <ShieldCheck />, title: "2. Verify Identity", desc: "Submit RC, DL, and undergo our strict KYC process." },
                  { icon: <Wallet />, title: "3. Earn Premium Rates", desc: "Enjoy daily payouts and the highest commissions in the industry." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-[#D4AF37]">
                      {step.icon}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold mb-1 text-white">{step.title}</h4>
                      <p className="text-slate-400">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12">
                <button className="bg-[#D4AF37] text-[#1E1B4B] hover:bg-opacity-90 px-8 py-4 rounded-full text-lg font-bold transition-colors shadow-lg">
                  Apply to Drive
                </button>
              </div>
            </div>
            
            {/* Visual Phone Mockup */}
            <div className="relative mx-auto w-full max-w-sm">
              <div className="aspect-[9/19] bg-slate-800 rounded-[2.5rem] p-2 border-4 border-slate-700 shadow-2xl relative">
                {/* Screen content */}
                <div className="w-full h-full bg-slate-900 rounded-[2rem] overflow-hidden flex flex-col pt-12 relative">
                  <div className="absolute top-0 inset-x-0 h-6 bg-black rounded-t-[2rem]"></div>
                  
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <p className="text-slate-400 text-sm">Today's Earnings</p>
                        <p className="text-3xl font-bold text-white">₹3,450.00</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-[#D4AF37]" />
                      </div>
                    </div>
                    
                    <div className="bg-slate-800 rounded-2xl p-5 mb-4 border border-slate-700">
                      <div className="flex justify-between mb-4">
                        <span className="text-sm font-medium text-[#D4AF37]">Premium Delivery Request</span>
                        <span className="text-sm text-slate-400">Just now</span>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                          <span className="text-sm text-slate-200">Nariman Point</span>
                        </div>
                        <div className="ml-1 w-[2px] h-4 bg-slate-700"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
                          <span className="text-sm text-slate-200">Taj Colaba</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-[#D4AF37] text-[#1E1B4B] py-2 rounded-lg font-bold text-sm">Accept VIP</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-[#D4AF37] rounded flex items-center justify-center">
              <Truck className="text-[#1E1B4B] w-3 h-3" />
            </div>
            <span className="font-bold text-lg text-white">Premium Courier</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 Premium Courier Logistics. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
