import { Calendar, Images, MessageCircle, Palette, Sparkles, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: Images,
    title: 'Stunning Portfolio Galleries',
    description: 'Showcase your photography with beautiful grid, masonry, and slideshow layouts that make your work shine',
  },
  {
    icon: Palette,
    title: 'Easy Portfolio Management',
    description: 'Upload, organize, and manage your images with a simple interface built for photographers',
  },
  {
    icon: Sparkles,
    title: 'Premium Templates',
    description: 'Choose from professionally designed templates created specifically for photography portfolios',
  },
  {
    icon: Calendar,
    title: 'Built-in Availability Calendar',
    description: 'Let clients see your availability and book sessions directly from your portfolio',
  },
  {
    icon: MessageCircle,
    title: 'One-Click Client Contact',
    description: 'Connect with potential clients instantly through WhatsApp and direct inquiry flows',
  },
  {
    icon: TrendingUp,
    title: 'Analytics & Insights',
    description: 'Track portfolio views, visitor sources, and client engagement to grow your business',
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 bg-cyan-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-500">Features</p>
          <h2 className="mb-6 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Everything you need to succeed
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-600 sm:text-xl">
            Powerful tools designed specifically for photographers to showcase their work and attract more clients
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="group text-center">
                <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-50 to-cyan-100 transition-transform group-hover:scale-110">
                  <Icon className="h-8 w-8 text-cyan-500" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900">{feature.title}</h3>
                <p className="leading-relaxed text-slate-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
