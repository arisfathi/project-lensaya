import { Star } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

const testimonials = [
  {
    name: 'Raygraphy',
    role: 'Portrait Photographer',
    location: 'Kajang, Selangor',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc0MjU1MTIwMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    quote:
      'Lensaya transformed how I present my work. The portfolio galleries look premium, and the booking flow makes it easier for clients to reach out.',
    rating: 5,
  },
  {
    name: 'David Kim',
    role: 'Commercial Photographer',
    location: 'Setapak, Kuala Lumpur',
    image:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NDI1NTEyMDB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    quote:
      'I needed a portfolio that feels polished and loads fast. Lensaya delivers both, and it gives me a cleaner way to package my services.',
    rating: 5,
  },
  {
    name: 'Maria Santos',
    role: 'Portrait Photographer',
    location: 'Ampang, Kuala Lumpur',
    image:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHx3b21hbiUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc0MjU1MTIwMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    quote:
      'The setup was fast, the site looks far more premium than my previous one, and clients now have a much easier time finding the information they need.',
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-500">Testimonials</p>
          <h2 className="mb-6 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Trusted by photographers worldwide
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-600 sm:text-xl">
            See what photographers are saying about building their portfolio websites with Lensaya.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 sm:gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="rounded-2xl border border-gray-100 bg-gray-50 p-6 transition-all hover:border-cyan-200 hover:shadow-lg sm:p-8"
            >
              <div className="mb-4 flex items-center gap-1">
                {Array.from({ length: testimonial.rating }, (_, index) => (
                  <Star key={index} className="h-5 w-5 fill-cyan-500 text-cyan-500" />
                ))}
              </div>

              <p className="mb-6 leading-relaxed text-slate-700">"{testimonial.quote}"</p>

              <div className="flex items-center gap-4 border-t border-gray-200 pt-4">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
                  <ImageWithFallback
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-600">{testimonial.role}</p>
                  <p className="text-xs text-slate-500">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
