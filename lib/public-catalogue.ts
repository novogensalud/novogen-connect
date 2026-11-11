import { channelSchema, emptyChannels } from "./channels";
import { visibleCatalogue, catalogueChoice } from "./catalogue-tree";
import type { Service } from "./domain";
import { isConfigured, supabase } from "./supabase";
export async function publicCatalogue(slug: string, origin: string) {
  if (!isConfigured()) return null;
  const db = await supabase();
  const org = await db.from('organizations').select('id,name,slug').eq('slug',slug).eq('published',true).maybeSingle();
  if (org.error) throw new Error('catalogue_unavailable');
  if (!org.data) return null;
  const [catalogue, channels] = await Promise.all([
    db.from('services').select('*').eq('organization_id',org.data.id).eq('active',true).order('created_at'),
    db.from('public_channels').select('*').eq('organization_id',org.data.id).maybeSingle(),
  ]);
  const parsed = channelSchema.safeParse(channels.data ?? emptyChannels);
  if (catalogue.error || channels.error || !parsed.success) throw new Error('catalogue_unavailable');
  return {
    organization: {name:org.data.name,slug:org.data.slug}, channels:parsed.data,
    connect_url: `${origin}/connect/${encodeURIComponent(slug)}/app`,
    items: visibleCatalogue((catalogue.data ?? []) as Service[]).sort((a,b) => catalogueChoice(a).order - catalogueChoice(b).order).map(s => ({
      id:s.id, name:s.name, description:s.description, type:s.catalog_type ?? 'service',
      parent_id:s.parent_id ?? null, choice:catalogueChoice(s).title,
      action_url:s.action_url ?? '', action_label:s.action_label ?? '',
      contact_url:s.catalog_type === 'group' ? null : `${origin}/connect/${encodeURIComponent(slug)}/app?service=${s.id}&contact=1`,
    })),
  };
}

