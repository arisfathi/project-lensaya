type SubscriptionsHeaderProps = {
  title: string;
  description: string;
};

export function SubscriptionsHeader({ title, description }: SubscriptionsHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}
