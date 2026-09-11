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
    .select("onboarded")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <div className="desktop-app flex h-full min-h-0 flex-col md:flex-row">
      <TabBar />
      <main className="desktop-main relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="desktop-canvas relative flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
