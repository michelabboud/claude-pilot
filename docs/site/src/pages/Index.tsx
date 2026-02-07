import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import ComparisonSection from "@/components/ComparisonSection";
import WorkflowSteps from "@/components/WorkflowSteps";
import WhatsInside from "@/components/WhatsInside";
import DeepDiveSection from "@/components/DeepDiveSection";
import InstallSection from "@/components/InstallSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const Index = () => {
  const websiteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Claude Pilot",
    "url": "https://www.claude-pilot.com",
    "description": "Claude Code ships fast but breaks things — Pilot fixes that. Tests enforced, context preserved, quality automated.",
    "publisher": {
      "@type": "Organization",
      "name": "Claude Pilot",
      "url": "https://www.claude-pilot.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.claude-pilot.com/logo.png"
      },
      "sameAs": [
        "https://github.com/maxritter/claude-pilot"
      ]
    }
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.claude-pilot.com"
      }
    ]
  };

  const softwareStructuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Claude Pilot",
    "description": "Production-grade development framework for Claude Code with 22 rules, 7 automated hooks, 14 coding skills, 3 language servers, and 5 MCP servers. Tests enforced, context preserved, quality automated.",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Linux, macOS, Windows",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Person",
      "name": "Max Ritter",
      "url": "https://maxritter.net/"
    },
    "license": "https://github.com/maxritter/claude-pilot/blob/main/LICENSE",
    "url": "https://github.com/maxritter/claude-pilot",
    "downloadUrl": "https://github.com/maxritter/claude-pilot"
  };

  return (
    <>
      <SEO
        title="Claude Pilot - Production-Grade Development with Claude Code"
        description="Claude Code ships fast but breaks things — Pilot fixes that. 22 rules, 7 automated hooks, 14 coding skills, 3 language servers, and 5 MCP servers. Tests enforced, context preserved, quality automated."
        structuredData={[websiteStructuredData, breadcrumbStructuredData, softwareStructuredData]}
      />
      <NavBar />
      <main className="min-h-screen bg-background">
        <HeroSection />
        <InstallSection />
        <ComparisonSection />
        <WorkflowSteps />
        <WhatsInside />
        <DeepDiveSection />
        <PricingSection />
        <Footer />
      </main>
    </>
  );
};

export default Index;
