import { publicContentCache } from '@/lib/public-content-cache';
import { supabaseAdmin } from '@/lib/supabase';

export type RobloxEmoteCommand = {
  code: string;
  name: string;
  command: string;
  asset_id: number | null;
  kind: 'default' | 'avatar';
  description: string;
  requirements: string;
  source_urls: string[];
  verification_method: 'official_documentation' | 'source_documentation' | 'in_game_test';
  verified_at: string;
  sort_order: number;
};

export async function listRobloxEmoteCommands(): Promise<RobloxEmoteCommand[]> {
  const cached = publicContentCache(
    async () => {
      const { data, error } = await supabaseAdmin().from('roblox_emote_commands')
        .select('code,name,command,asset_id,kind,description,requirements,source_urls,verification_method,verified_at,sort_order')
        .eq('is_published', true).order('sort_order').order('code');
      if (error) throw new Error(`Failed to load emote commands: ${error.message}`);
      return (data ?? []) as RobloxEmoteCommand[];
    },
    ['roblox-emote-commands-v1'],
    { revalidate: 86400, tags: ['catalog:roblox-emote-commands'] }
  );

  return cached();
}
