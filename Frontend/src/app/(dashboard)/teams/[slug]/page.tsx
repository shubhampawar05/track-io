import { TeamView } from "@/components/team/TeamView";

const titles: Record<string, string> = {
  design: "Design Agency",
  engineering: "Engineering",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = titles[slug] ?? slug;
  return <TeamView name={name} />;
}
