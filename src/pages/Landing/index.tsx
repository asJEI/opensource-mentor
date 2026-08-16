import { Navbar, Footer } from '@/components/layout'
import {
  CTASection,
  FeaturesSection,
  HeroSection,
  PreviewSection,
  WhySection,
  WorkflowSection,
} from './sections'

const Landing = () => (
  <div className="landing-page">
    <Navbar />
    <HeroSection />
    <WhySection />
    <FeaturesSection />
    <WorkflowSection />
    <PreviewSection />
    <CTASection />
    <Footer />
  </div>
)

export default Landing
