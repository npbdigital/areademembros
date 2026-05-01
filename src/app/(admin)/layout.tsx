import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Topbar } from "@/components/topbar";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .schema("membros")
    .from("users")
    .select("full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-npb-bg">
      <AdminSidebar />
      <div className="flex flex-1 flex-col pl-60">
        <Topbar
          user={{
            fullName: profile.full_name ?? "",
            email: user.email ?? "",
            avatarUrl: profile.avatar_url ?? null,
            isAdmin: true,
          }}
          searchPlaceholder="Buscar curso, aluno..."
        />
        <main className="flex-1 overflow-y-auto npb-scrollbar p-6 md:p-8">
          {children}
        </main>
      </div>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e1e1e",
            border: "1px solid #2a2a2a",
            color: "#f0f0f0",
          },
        }}
      />
    </div>
  );
}
