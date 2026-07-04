import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";

export default async function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded, profile_color")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded) redirect("/onboarding");

  const accent = profile?.profile_color || "#F5F5F5";

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
