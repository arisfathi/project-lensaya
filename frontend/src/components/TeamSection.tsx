import Slider from 'react-slick';
import { ImageWithFallback } from './figma/ImageWithFallback';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './TeamSection.css';

export type TeamMember = {
  name: string;
  role: string;
  image: string;
};

const sampleTeamMembers: TeamMember[] = [
  {
    name: 'Aisha Rahman',
    role: 'Lead Photographer',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Daniel Wong',
    role: 'Creative Director',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Nadia Lim',
    role: 'Portrait Specialist',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Hakim Zulkifli',
    role: 'Lighting Artist',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Sofia Idris',
    role: 'Post-Production Lead',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80',
  },
];

type TeamSectionProps = {
  members?: TeamMember[];
  useSampleData?: boolean;
};

export function TeamSection({ members = [], useSampleData = false }: TeamSectionProps) {
  const normalizedMembers = members
    .map((member) => ({
      name: String(member?.name || '').trim(),
      role: String(member?.role || '').trim(),
      image: String(member?.image || '').trim(),
    }))
    .filter((member) => member.name && member.role && member.image);

  const items = normalizedMembers.length > 0 ? normalizedMembers : useSampleData ? sampleTeamMembers : [];

  if (items.length === 0) {
    return null;
  }

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    swipeToSlide: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1.15,
        },
      },
    ],
  };

  return (
    <section className="bg-gray-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Our Team</h2>
          <p className="mx-auto mt-3 max-w-3xl text-slate-600">
            Meet the talented professionals behind our photography studio
          </p>
        </div>

        <div className="team-section-slider pb-8 sm:pb-12">
          <Slider {...settings}>
            {items.map((member) => (
              <div key={`${member.name}-${member.role}`} className="px-2 sm:px-3">
                <article className="overflow-hidden rounded-2xl bg-white shadow-lg">
                  <div className="aspect-[5/6] overflow-hidden sm:aspect-[3/4]">
                    <ImageWithFallback
                      src={member.image}
                      alt={`${member.name} headshot`}
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                  <div className="p-5 sm:p-6">
                    <h3 className="text-xl font-bold text-slate-900">{member.name}</h3>
                    <p className="mt-1 font-medium text-cyan-500">{member.role}</p>
                  </div>
                </article>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </section>
  );
}

