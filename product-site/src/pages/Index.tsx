import type { FC } from "react";
import {
  Navbar,
  Footer,
  HeroSection,
  OverviewSection,
  DemoSection,
  ConversionSection,
} from "@/components";

const Index: FC = () => {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <OverviewSection />
      <DemoSection />
      <ConversionSection />
      <Footer />
    </main>
  );
};

export default Index;
