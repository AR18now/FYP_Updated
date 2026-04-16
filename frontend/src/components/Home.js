import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload, Eye, Download, Users, Zap, ArrowRight, Sparkles } from 'lucide-react';

const Home = ({ theme = 'dark' }) => {
  const [animatedStats, setAnimatedStats] = useState([0, 0, 0]);
  const [isVisible, setIsVisible] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Animate stats
            const targets = [100, 50, 25];
            const duration = 2000;
            const steps = 60;
            const increment = duration / steps;
            
            let current = [0, 0, 0];
            const timer = setInterval(() => {
              current = current.map((val, idx) => {
                const target = targets[idx];
                const step = target / steps;
                const newVal = Math.min(val + step, target);
                return newVal;
              });
              setAnimatedStats(current);
              
              if (current.every((val, idx) => val >= targets[idx])) {
                clearInterval(timer);
                setAnimatedStats(targets);
              }
            }, increment);
            
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    const statsElement = document.getElementById('stats-section');
    if (statsElement) observer.observe(statsElement);

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: Upload,
      iconColor: "text-r2d-primary",
      bgColor: "bg-r2d-accentMuted/40",
      title: "Input Requirements",
      description: "Upload text files or audio recordings to input your requirements",
      link: "/input",
      delay: "0"
    },
    {
      icon: FileText,
      iconColor: "text-r2d-accent",
      bgColor: "bg-r2d-accentMuted/30",
      title: "Process Requirements",
      description: "AI-powered processing to extract and analyze requirements",
      link: "/results",
      delay: "100"
    },
    {
      icon: Download,
      iconColor: "text-r2d-primaryLight",
      bgColor: "bg-r2d-accentMuted/35",
      title: "Generate SRS",
      description: "Generate IEEE 830-compliant Software Requirements Specification",
      link: "/srs",
      delay: "200"
    }
  ];

  const actions = [
    {
      title: "Generate SRS",
      description: "Produce a complete IEEE 830-compliant SRS document.",
      cta: "Go to SRS",
      link: "/srs",
      badge: "Structured JSON",
      icon: FileText,
      accent: "from-r2d-primary to-r2d-accent"
    },
    {
      title: "Textual Use Cases",
      description: "Turn requirements into clean, ready-to-review use case narratives.",
      cta: "View Use Cases",
      link: "/results",
      badge: "Narratives",
      icon: Sparkles,
      accent: "from-r2d-accent to-r2d-primaryLight"
    },
    {
      title: "Use Case Diagram",
      description: "Generate actor/goals relationships for a visual use case diagram.",
      cta: "Generate Diagram",
      link: "/results",
      badge: "Diagram-ready",
      icon: Eye,
      accent: "from-r2d-primaryLight to-r2d-accent"
    }
  ];

  const flow = [
    { label: "Vague Requirements", color: "bg-r2d-primary" },
    { label: "Preprocessing", color: "bg-r2d-primaryLight" },
    { label: "SRS Making", color: "bg-r2d-accent" },
    { label: "Textual Use Cases", color: "bg-r2d-primary" },
    { label: "Use Case Diagram", color: "bg-r2d-accent" },
  ];

  const stats = [
    { label: "Requirements Processed", value: 100, suffix: "+" },
    { label: "SRS Documents Generated", value: 50, suffix: "+" },
    { label: "Active Users", value: 25, suffix: "+" }
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'} py-14 md:py-24 rounded-3xl neon-card mb-14 border`} aria-labelledby="hero-heading">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <h1 id="hero-heading" className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight ${isDark ? 'text-slate-100 neon-text' : 'text-slate-900'}`}>
            Requirements Engineering
              <span className={`block mt-2 ${isDark ? 'text-r2d-accentSoft neon-text' : 'text-r2d-accent'}`}>Made Simple</span>
          </h1>
            <p className={`text-lg md:text-xl mb-10 leading-relaxed ${isDark ? 'text-slate-200/85' : 'text-slate-700'}`}>
              Transform vague requirements into SRS, textual use cases, and use case diagrams with one streamlined flow.
          </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link 
              to="/input"
                className="group bg-gradient-to-r from-r2d-primary to-r2d-accent text-white px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
              aria-label="Get started with requirements input"
            >
              <Upload className="h-5 w-5" aria-hidden="true" />
                <span>Start with Requirements</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
            </Link>
            <Link 
              to="/results"
                className={`${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'} px-8 py-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2`}
              aria-label="View processing results"
            >
              <Eye className="h-5 w-5" aria-hidden="true" />
                <span>View Outputs</span>
            </Link>
            </div>
          </div>
          <div className="w-full">
            <div className={`p-7 md:p-8 rounded-2xl border ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-slate-700 neon-card' : 'bg-gradient-to-br from-white via-slate-100 to-white text-slate-900 border-slate-200 card-shadow'}`}>
              <div className={`text-sm uppercase tracking-wide font-semibold mb-5 ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-accent'}`}>Pipeline</div>
              <div className="space-y-5">
                {[
                  "Vague Requirements",
                  "Preprocessing",
                  "SRS Making",
                  "Textual Use Cases",
                  "Use Case Diagram",
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <div className={`h-9 w-9 rounded-full bg-gradient-to-br from-r2d-primary via-r2d-accent to-r2d-primaryLight text-white flex items-center justify-center font-bold text-sm shadow-md`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{step}</div>
                      {idx < 4 && <div className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs`}>Next: {idx === 3 ? "Use Case Diagram" : "..."}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className={`mt-6 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Choose an outcome (SRS, textual use cases, diagram) and the system orchestrates the flow automatically.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Menu */}
      <section className="py-10 md:py-12" aria-labelledby="menu-heading">
        <div className="text-center mb-8">
          <h2 id="menu-heading" className={`text-3xl md:text-4xl font-bold mb-3 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>What do you want to generate?</h2>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-2xl mx-auto`}>Pick an outcome and we’ll guide you there.</p>
        </div>
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {actions.map(({ title, description, cta, link, badge, icon: Icon, accent }, idx) => (
            <Link
              key={idx}
              to={link}
              className={`group relative overflow-hidden rounded-xl p-6 md:p-7 card-shadow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              aria-label={`${title} - ${description}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className="relative flex flex-col h-full space-y-4">
                <div className={`inline-flex items-center space-x-2 text-xs font-semibold px-3 py-1 rounded-full w-fit border ${isDark ? 'text-r2d-accentSoft bg-slate-800 border-slate-700' : 'text-r2d-primary bg-r2d-accentMuted/35 border-slate-200'}`}>
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>{badge}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform duration-200 ${isDark ? 'bg-slate-800 text-r2d-accentSoft' : 'bg-slate-100 text-r2d-accent'}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className={`text-xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
                </div>
                <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed flex-1`}>{description}</p>
                <div className={`flex items-center font-semibold group-hover:translate-x-1 transition-transform duration-200 ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-accent'}`}>
                  <span>{cta}</span>
                  <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16" aria-labelledby="features-heading">
        <div className="text-center mb-12">
          <h2 id="features-heading" className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            How It Works
          </h2>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-2xl mx-auto`}>
            A simple three-step process to transform your requirements into professional documentation
          </p>
        </div>
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link
                key={index}
                to={feature.link}
                className={`group p-6 md:p-8 rounded-xl card-shadow hover:shadow-xl transition-all duration-300 hover:-translate-y-2 focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                style={{ animationDelay: `${feature.delay}ms` }}
                aria-label={`${feature.title} - ${feature.description}`}
              >
                <div className="text-center">
                  <div className={`mb-4 flex justify-center ${feature.bgColor} rounded-full p-4 w-16 h-16 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-8 w-8 ${feature.iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className={`text-xl font-semibold mb-3 transition-colors duration-200 ${isDark ? 'text-slate-100 group-hover:text-r2d-accentSoft' : 'text-slate-900 group-hover:text-r2d-accent'}`}>
                    {feature.title}
                  </h3>
                  <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed`}>
                    {feature.description}
                  </p>
                  <div className={`mt-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-accent'}`}>
                    <span className="text-sm font-medium">Learn more</span>
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Flow Section */}
      <section className={`py-12 md:py-16 rounded-xl card-shadow mb-12 border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'}`} aria-labelledby="flow-heading">
        <div className="text-center mb-6">
          <h2 id="flow-heading" className={`text-2xl md:text-3xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>End-to-End Flow</h2>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'}`}>From vague requirements to diagrams</p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
          {flow.map((step, idx) => (
            <div key={idx} className="flex items-center w-full md:w-auto">
              <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border card-shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <div className={`h-9 w-9 rounded-full ${step.color} text-white flex items-center justify-center font-bold text-sm`}>
                  {idx + 1}
                </div>
                <div className={`${isDark ? 'text-slate-100' : 'text-slate-900'} font-semibold`}>{step.label}</div>
              </div>
              {idx < flow.length - 1 && (
                <div className="hidden md:block mx-3 text-slate-500">
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats-section" className={`py-12 md:py-16 rounded-xl card-shadow mb-12 border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'}`} aria-labelledby="stats-heading">
        <div className="text-center mb-8">
          <h2 id="stats-heading" className={`text-2xl md:text-3xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            System Statistics
          </h2>
          <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Trusted by teams worldwide</p>
        </div>
        <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {stats.map((stat, index) => (
            <div 
              key={index} 
              className={`p-6 rounded-lg hover:shadow-lg transition-shadow duration-200 border ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-700 border-slate-700' : 'bg-gradient-to-br from-slate-100 to-white border-slate-200'}`}
              role="region"
              aria-label={`${stat.label}: ${Math.floor(animatedStats[index])}${stat.suffix}`}
            >
              <div className={`text-4xl md:text-5xl font-bold mb-2 tabular-nums ${isDark ? 'text-r2d-accentSoft' : 'text-r2d-accent'}`}>
                {isVisible ? Math.floor(animatedStats[index]) : 0}{stat.suffix}
              </div>
              <div className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={`text-center py-12 md:py-16 rounded-2xl card-shadow border ${isDark ? 'bg-gradient-to-r from-slate-800 via-r2d-primary to-r2d-accent text-white border-slate-800' : 'bg-gradient-to-r from-r2d-accentMuted via-r2d-accentMuted/60 to-white text-slate-900 border-slate-200'}`} aria-labelledby="cta-heading">
        <div className="max-w-2xl mx-auto px-4">
          <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className={`${isDark ? 'text-slate-200' : 'text-slate-700'} mb-8 text-lg`}>
            Upload your requirements and generate professional SRS documents in minutes.
          </p>
          <Link 
            to="/input"
            className={`inline-flex items-center space-x-2 px-8 py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${isDark ? 'bg-white text-slate-900 focus:ring-offset-slate-800' : 'bg-slate-900 text-white focus:ring-offset-white'}`}
            aria-label="Start processing requirements"
          >
            <Zap className="h-5 w-5" aria-hidden="true" />
            <span>Start Processing</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
