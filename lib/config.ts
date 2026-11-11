// Server-side reads stay dynamic so a retained build can use this machine's settings.
// Never import this module into a client component.
function read(name: string) {
  return process.env[name];
}
export function getSupabaseConfig() {
  return {
    url: read("NEXT_PUBLIC_SUPABASE_URL"),
    key: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
