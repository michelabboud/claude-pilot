import { ExternalLink, Check, Building2, Clock, Sparkles, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInView } from "@/hooks/use-in-view";

const PricingSection = () => {
  const [headerRef, headerInView] = useInView<HTMLDivElement>();
  const [cardsRef, cardsInView] = useInView<HTMLDivElement>();
  const [valueRef, valueInView] = useInView<HTMLDivElement>();

  return (
    <section id="pricing" className="py-16 lg:py-24 px-4 sm:px-6 relative" aria-labelledby="pricing-heading">
      <div className="max-w-6xl mx-auto">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Header */}
        <div
          ref={headerRef}
          className={`text-center mb-16 ${headerInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Pricing
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Get instant access to best practices from daily production usage — a shortcut to state-of-the-art Claude Code development.
          </p>
        </div>

        <div ref={cardsRef} className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {/* Trial */}
          <div
            className={`group relative rounded-2xl p-6 sm:p-8 border border-border/50 bg-card/30 backdrop-blur-sm
              hover:border-sky-400/50 hover:bg-card/50 hover:shadow-lg hover:shadow-sky-400/10
              hover:-translate-y-1 transition-all duration-300
              ${cardsInView ? "animate-fade-in-up animation-delay-0" : "opacity-0"}`}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-sky-400/15 rounded-xl flex items-center justify-center
                group-hover:bg-sky-400/25 group-hover:scale-110 transition-all duration-300">
                <Clock className="h-6 w-6 text-sky-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Trial</h3>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Full features for 7 days</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">No credit card required</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-sky-400 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Starts automatically on install</span>
              </li>
            </ul>

            <Button asChild variant="outline" className="w-full">
              <a href="#installation">
                Start Free Trial
              </a>
            </Button>
          </div>

          {/* Standard - Featured */}
          <div
            className={`group relative rounded-2xl p-6 sm:p-8 border-2 border-primary/50 bg-card/40 backdrop-blur-sm
              hover:border-primary hover:bg-card/60 hover:shadow-xl hover:shadow-primary/20
              hover:-translate-y-2 transition-all duration-300 scale-[1.02]
              ${cardsInView ? "animate-fade-in-up animation-delay-100" : "opacity-0"}`}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center
                group-hover:bg-primary/30 group-hover:scale-110 transition-all duration-300">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Standard</h3>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$14</span>
              <span className="text-muted-foreground">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">22 rules, 7 hooks, 14 skills, 3 LSPs</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Endless Mode + persistent memory</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Latest learnings from daily usage</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Continuous updates + GitHub support</span>
              </li>
            </ul>

            <Button asChild className="w-full">
              <a href="https://license.claude-pilot.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Subscribe
              </a>
            </Button>
          </div>

          {/* Enterprise */}
          <div
            className={`group relative rounded-2xl p-6 sm:p-8 border border-border/50 bg-card/30 backdrop-blur-sm
              hover:border-indigo-500/50 hover:bg-card/50 hover:shadow-lg hover:shadow-indigo-500/10
              hover:-translate-y-1 transition-all duration-300
              ${cardsInView ? "animate-fade-in-up animation-delay-200" : "opacity-0"}`}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-500/15 rounded-xl flex items-center justify-center
                group-hover:bg-indigo-500/25 group-hover:scale-110 transition-all duration-300">
                <Building2 className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Enterprise</h3>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold text-foreground">$35</span>
              <span className="text-muted-foreground">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Everything in Standard</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Dedicated email support</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground text-sm group-hover:text-foreground/80 transition-colors">Priority feature requests</span>
              </li>
            </ul>

            <Button asChild variant="outline" className="w-full border-indigo-500/50 hover:bg-indigo-500/10">
              <a href="https://license.claude-pilot.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Subscribe
              </a>
            </Button>
          </div>
        </div>

        {/* Value proposition */}
        <div
          ref={valueRef}
          className={`mt-12 rounded-2xl p-6 border border-border/50 bg-card/30 backdrop-blur-sm ${valueInView ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">What You Get</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">2,900+ lines</span> of production-tested rules and best practices loaded into every session
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">7 automated hooks</span> enforcing quality on every file edit — formatting, linting, type checking, TDD
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Continuous updates</span> from daily production usage — new rules, skills, and optimizations shipped regularly
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
