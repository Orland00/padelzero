import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface WaUser {
  id: string;
  phoneNumber: string;
  profileId: string | null;
  isLinked: boolean;
  waName: string | null;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

export async function resolveWaUser(
  supabase: SupabaseClient,
  senderPhone: string,
  senderName: string
): Promise<WaUser> {
  const { data: existing } = await supabase
    .from("whatsapp_users")
    .select("id, phone_number, profile_id, is_linked, wa_name, message_count, last_message")
    .eq("phone_number", senderPhone)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("whatsapp_users")
      .update({
        message_count: existing.message_count + 1,
        last_message: new Date().toISOString(),
        wa_name: senderName,
      })
      .eq("id", existing.id);

    return {
      id: existing.id,
      phoneNumber: existing.phone_number,
      profileId: existing.profile_id,
      isLinked: existing.is_linked,
      waName: senderName,
    };
  }

  const normalized = normalizePhone(senderPhone);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone")
    .not("phone", "is", null);

  let matchedProfileId: string | null = null;
  if (profiles) {
    for (const p of profiles) {
      if (p.phone && normalizePhone(p.phone) === normalized) {
        matchedProfileId = p.id;
        break;
      }
    }
  }

  const { data: newUser, error } = await supabase
    .from("whatsapp_users")
    .insert({
      phone_number: senderPhone,
      profile_id: matchedProfileId,
      is_linked: !!matchedProfileId,
      wa_name: senderName,
      message_count: 1,
      last_message: new Date().toISOString(),
    })
    .select("id, phone_number, profile_id, is_linked, wa_name")
    .single();

  if (error) {
    console.error("Failed to create WA user:", error);
    throw error;
  }

  return {
    id: newUser.id,
    phoneNumber: newUser.phone_number,
    profileId: newUser.profile_id,
    isLinked: newUser.is_linked,
    waName: senderName,
  };
}

export async function isRateLimited(
  supabase: SupabaseClient,
  waUserId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_users")
    .select("message_count, last_message")
    .eq("id", waUserId)
    .single();

  if (!data?.last_message) return false;

  const lastMsg = new Date(data.last_message).getTime();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  if (lastMsg < oneHourAgo) {
    await supabase
      .from("whatsapp_users")
      .update({ message_count: 0 })
      .eq("id", waUserId);
    return false;
  }

  return data.message_count >= 30;
}

export async function getGroupLinks(
  supabase: SupabaseClient,
  groupId: string
): Promise<{ ligaId: string | null; clubId: number | null }> {
  const { data } = await supabase
    .from("whatsapp_group_links")
    .select("liga_id, club_id")
    .eq("group_id", groupId)
    .maybeSingle();

  return {
    ligaId: data?.liga_id || null,
    clubId: data?.club_id || null,
  };
}

export async function linkGroupToLiga(
  supabase: SupabaseClient,
  groupId: string,
  joinCode: string,
  linkedBy: string
): Promise<{ success: boolean; ligaName?: string; error?: string }> {
  const { data: liga } = await supabase
    .from("ligas")
    .select("id, name")
    .eq("join_code", joinCode.toLowerCase().trim())
    .maybeSingle();

  if (!liga) return { success: false, error: "Codigo de liga no encontrado" };

  const { error } = await supabase
    .from("whatsapp_group_links")
    .upsert(
      { group_id: groupId, liga_id: liga.id, linked_by: linkedBy },
      { onConflict: "group_id" }
    );

  if (error) return { success: false, error: error.message };
  return { success: true, ligaName: liga.name };
}

export async function linkGroupToClub(
  supabase: SupabaseClient,
  groupId: string,
  clubName: string,
  linkedBy: string
): Promise<{ success: boolean; clubName?: string; error?: string }> {
  const safe = clubName.replace(/[%_\\,.()"']/g, "");
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("active", true)
    .ilike("name", `%${safe}%`)
    .limit(3);

  if (!clubs?.length) return { success: false, error: "Club no encontrado" };
  if (clubs.length > 1) {
    const names = clubs.map((c) => c.name).join(", ");
    return { success: false, error: `Varios clubes: ${names}. Se mas especifico.` };
  }

  const club = clubs[0];
  const { error } = await supabase
    .from("whatsapp_group_links")
    .upsert(
      { group_id: groupId, club_id: club.id, linked_by: linkedBy },
      { onConflict: "group_id" }
    );

  if (error) return { success: false, error: error.message };
  return { success: true, clubName: club.name };
}
