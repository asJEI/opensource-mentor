import { Navbar } from '@/components/layout'
import {
  FeaturesSection,
  HeroSection,
  PreviewSection,
  WorkflowSection,
} from './sections'

const Landing = () => (
  <div className="landing-page">
    <Navbar />
    <HeroSection />
    <WorkflowSection />
    <FeaturesSection />
    <PreviewSection />
  </div>
)

export default Landing
