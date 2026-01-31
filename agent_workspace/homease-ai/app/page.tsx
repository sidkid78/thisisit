'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Check, ChevronRight, Scan, ShieldCheck, Users, Heart, Briefcase, Home, Star, Clock, DollarSign, Award } from 'lucide-react'

// Particle Field Animation
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = []
    const particleCount = 60

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
      })
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.9)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(59, 130, 246, ${p.opacity * 0.6})`
        ctx.fill()
      })

      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 150) {
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.12 * (1 - dist / 150)})`
            ctx.stroke()
          }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
}

// Feature Card Component
function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="relative p-6 rounded-2xl bg-white backdrop-blur-sm border border-gray-200 shadow-[inset_0_1px_0_0_rgba(59,130,246,0.1),0_0_40px_rgba(59,130,246,0.05)] transition-all duration-300 hover:scale-[1.02] group text-center">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)] flex items-center justify-center mb-4 mx-auto">
        <Icon className="w-7 h-7 text-blue-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="leading-relaxed text-gray-600">{description}</p>
    </div>
  )
}

// Audience Card Component
function AudienceCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="relative p-6 rounded-2xl bg-white border border-gray-200 transition-all duration-300 hover:border-blue-500/30 group text-center">
      <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 mx-auto group-hover:bg-blue-500/20 transition-colors">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}

// Testimonial Card Component
function TestimonialCard({ quote, author, role, rating }: { quote: string; author: string; role: string; rating: number }) {
  return (
    <div className="relative p-6 rounded-2xl bg-white border border-gray-200 h-full flex flex-col">
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-blue-500 text-blue-500" />
        ))}
      </div>
      <p className="text-gray-600 leading-relaxed flex-grow mb-4">&quot;{quote}&quot;</p>
      <div className="border-t border-blue-500/10 pt-4">
        <p className="font-semibold text-gray-900">{author}</p>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center bg-slate-50">
        <ParticleField />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6 tracking-tight">
              Make Your Home{' '}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Safe & Accessible</span>{' '}
              in Minutes.
            </h1>

            <p className="text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-gray-600">
              The first AI-powered platform that instantly audits homes for ADA compliance and connects homeowners with specialized CAPS-certified contractors.
            </p>

            <div className="flex flex-col sm:flex-row gap-8 justify-center">
              {/* Homeowner CTA */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">For Homeowners</span>
                <Link
                  href="/login?role=homeowner"
                  className="group flex flex-col items-center justify-center gap-1 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 bg-blue-500 hover:bg-blue-400 text-white shadow-lg hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                >
                  <span className="flex items-center gap-2">
                    Start Your Free Scan Now
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-xs text-blue-100 font-normal">100% Free. No Credit Card.</span>
                </Link>
              </div>

              {/* Contractor CTA */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-gray-500">For Contractors</span>
                <Link
                  href="/login?role=contractor"
                  className="group flex flex-col items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 bg-white hover:bg-gray-50 border-2 border-gray-200 text-gray-900 hover:border-blue-300"
                >
                  <span className="flex items-center gap-2">
                    Find Leads in Your Area
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="text-xs text-gray-500 font-normal">Pay per lead, no fees to join</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 to-transparent" />
      </section>

      {/* Who It's For Section */}
      <section className="py-24 relative bg-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.07)_0%,_transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest mb-4 bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              Who It&apos;s For
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Built for Everyone Who Cares About Home Safety
            </h2>
            <p className="text-xl max-w-2xl mx-auto text-gray-600">
              Whether you&apos;re preparing for the future or responding to an immediate need, we&apos;re here to help.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AudienceCard
              icon={Heart}
              title="Aging in Place"
              description="Seniors and families preparing for mobility changes to stay safe and independent at home."
            />
            <AudienceCard
              icon={ShieldCheck}
              title="Post-Surgery Recovery"
              description="Families adapting homes for temporary or permanent accessibility needs after injury or surgery."
            />
            <AudienceCard
              icon={Users}
              title="Family Caregivers"
              description="Adult children helping aging parents stay in the homes they love with confidence."
            />
            <AudienceCard
              icon={Briefcase}
              title="CAPS Contractors"
              description="Certified professionals seeking pre-qualified leads from homeowners ready to renovate."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.05)_0%,_transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest mb-4 bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              From Photo to Renovation in 3 Simple Steps
            </h2>
            <p className="text-xl max-w-2xl mx-auto text-gray-600">
              Our AI analyzes your space and connects you with qualified specialists in minutes, not weeks.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Scan}
              title="1. Scan Your Room"
              description="Upload a photo and our AI instantly detects 47+ accessibility barriers including doorway width, grab bar placement, trip hazards, and more."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="2. Get Your Report"
              description="Receive a room-by-room compliance report with specific recommendations, cost estimates ranging from $500-$25,000, and before/after mockups."
            />
            <FeatureCard
              icon={Users}
              title="3. Connect with Pros"
              description="Match with CAPS-certified contractors in your zip code within 24 hours. Compare quotes and reviews to find your perfect fit."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 relative bg-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.03)_0%,_transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Free for homeowners. Pay-per-lead for contractors. No hidden fees.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                name: 'Homeowner',
                price: 'Free',
                period: 'Forever',
                description: 'Everything you need to make your home safer.',
                features: ['Unlimited Room Scans', 'Full Compliance Report', 'Cost Estimates', 'Contractor Matching', 'Email Support'],
                cta: 'Start Scanning Free',
                ctaLink: '/login?role=homeowner',
                popular: false,
              },
              {
                name: 'Pro Contractor',
                price: '$0',
                period: 'Pay per Lead',
                description: 'High-intent leads from homeowners ready to renovate.',
                features: ['Verified CAPS Badge', 'Lead Previews', 'Direct Contact Info', 'Project Details & Photos', 'Zero Commission Fees'],
                highlight: 'Avg. lead value: $3,500',
                cta: 'Join Marketplace',
                ctaLink: '/login?role=contractor',
                popular: true,
              },
              {
                name: 'Organization',
                price: 'Custom',
                period: '',
                description: 'For hospitals, insurers, and senior care providers.',
                features: ['API Access', 'White-label Reports', 'Bulk Scanning', 'Dedicated Manager', 'SLA Support'],
                cta: 'Contact Sales',
                ctaLink: '/login',
                popular: false,
              },
            ].map((plan) => (
              <div key={plan.name} className="h-full">
                <div
                  className={`relative p-8 rounded-2xl bg-white border ${
                    plan.popular ? 'border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.1)]' : 'border-gray-200'
                  } shadow-[inset_0_1px_0_0_rgba(59,130,246,0.08),0_0_40px_rgba(59,130,246,0.05)] transition-all duration-300 hover:scale-[1.02] h-full flex flex-col group`}
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold rounded-full uppercase tracking-wide bg-blue-500/10 text-blue-700 border border-blue-500/30">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 relative text-center">{plan.name}</h3>
                  <p className="text-sm mb-6 relative text-gray-600 text-center">{plan.description}</p>
                  <div className="mb-6 relative text-center">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-600 ml-1">/ {plan.period}</span>}
                  </div>
                  {'highlight' in plan && plan.highlight && (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 relative text-center">
                      <p className="text-sm text-blue-700 font-medium">{plan.highlight}</p>
                    </div>
                  )}
                  <ul className="space-y-3 mb-8 flex-grow relative">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center justify-center gap-3">
                        <Check className="w-5 h-5 flex-shrink-0 text-blue-600" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.ctaLink}
                    className={`relative block w-full py-3 rounded-xl text-center font-semibold transition-all duration-300 ${
                      plan.popular 
                        ? 'bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]' 
                        : 'bg-transparent hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-blue-300'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 relative bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Trusted by Families Everywhere
            </h2>
            <p className="text-xl text-gray-600">
              See what homeowners and contractors are saying about HOMEase AI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="The AI found hazards I never would have noticed. The contractor they matched us with was professional and the work was excellent."
              author="Sarah M."
              role="Homeowner, Tampa FL"
              rating={5}
            />
            <TestimonialCard
              quote="Made preparing my parents' home so much easier. The whole process from scan to installation took just 2 weeks."
              author="Michael R."
              role="Homeowner, Austin TX"
              rating={5}
            />
            <TestimonialCard
              quote="As a CAPS-certified contractor, this platform brings me quality leads from homeowners who are ready to invest in safety."
              author="David K."
              role="Contractor, Phoenix AZ"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 relative bg-slate-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08)_0%,_transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
            <Award className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-600">Join 1,200+ satisfied homeowners</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            Ready to Make Your Home Safer?
          </h2>
          <p className="text-xl mb-10 text-gray-600">
            Get your free accessibility report in under 2 minutes. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login?role=homeowner"
              className="group flex items-center justify-center gap-2 px-10 py-5 rounded-xl font-semibold text-lg transition-all duration-300 bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]"
            >
              Scan Your First Room Free
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login?role=contractor"
              className="flex items-center justify-center px-10 py-5 rounded-xl font-semibold text-lg transition-all duration-300 bg-transparent hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-blue-300"
            >
              I&apos;m a Contractor
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t bg-white border-blue-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Home className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-gray-900 font-bold text-lg">HOMEase | AI</span>
              </div>
              <p className="text-gray-600 text-sm">
                Making homes safer and more accessible through the power of AI.
              </p>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">For Homeowners</h4>
              <ul className="space-y-2">
                <li><Link href="/login?role=homeowner" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">Start Scanning</Link></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">How It Works</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Pricing</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">FAQ</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">For Contractors</h4>
              <ul className="space-y-2">
                <li><Link href="/login?role=contractor" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">Join Marketplace</Link></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Lead Pricing</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Success Stories</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">CAPS Certification</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-900 font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">About Us</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Contact</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Privacy Policy</span></li>
                <li><span className="text-gray-600 text-sm cursor-pointer hover:text-blue-600 transition-colors">Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-blue-500/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                &copy; 2026 HOMEase | AI. All rights reserved.
              </p>
              <div className="flex gap-6">
                {['Facebook', 'Instagram', 'Twitter', 'LinkedIn'].map((social) => (
                  <span key={social} className="text-gray-500 hover:text-blue-600 cursor-pointer transition-colors text-sm">
                    {social}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
