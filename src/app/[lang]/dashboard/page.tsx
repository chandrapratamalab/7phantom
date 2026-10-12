import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/dictionaries";
import { type Locale, localeMeta } from "@/i18n/config";
import { interpolate } from "@/i18n/format";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return { title: dict.dashboard.title, robots: { index: false } };
}

/**
 * Example of a protected page:
 *
 *   1. `requireUser()` is the authoritative authorization check (the proxy gate
 *      is only a UX optimisation — a page is an independent entry point).
 *   2. Data is read straight from Postgres through RLS as this user. There is no
 *      `where user_id = …` because the policy already scopes the rows.
 */
export default async function DashboardPage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const user = await requireUser(lang);

  const supabase = await createClient();
  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id, title, body, is_pinned, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Graceful degradation while `supabase/migrations` has not been applied yet.
  const rows = notesError ? [] : (notes ?? []);

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{dict.dashboard.title}</h1>
          <p className="text-muted-foreground text-sm">{dict.dashboard.description}</p>
        </div>

        <form action={signOutAction}>
          <input type="hidden" name="lang" value={lang} />
          <Button type="submit" variant="outline" size="sm" className="gap-2">
            <LogOut className="size-4" />
            {dict.dashboard.signOut}
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.sessionTitle}</CardTitle>
          <CardDescription>
            {interpolate(dict.dashboard.greeting, { email: user.email ?? "—" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{dict.dashboard.userId}</span>
            <code className="font-mono text-xs break-all">{user.id}</code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{dict.dashboard.locale}</span>
            <span>
              {localeMeta[lang].nativeLabel} ({localeMeta[lang].label})
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dict.dashboard.notesTitle}</CardTitle>
          <CardDescription>
            {rows.length === 0 ? dict.dashboard.notesEmpty : `${rows.length} item(s) · RLS scoped`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {rows.map((note) => (
            <article key={note.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <h2 className="text-sm font-medium">
                {note.is_pinned ? "★ " : null}
                {note.title}
              </h2>
              {note.body ? (
                <p className="text-muted-foreground text-sm text-pretty">{note.body}</p>
              ) : null}
              <time dateTime={note.created_at} className="text-muted-foreground text-xs">
                {new Date(note.created_at).toLocaleDateString(lang)}
              </time>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
