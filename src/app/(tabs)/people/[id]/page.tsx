import PersonScreen from "@/components/PersonScreen";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonScreen personId={id} />;
}
