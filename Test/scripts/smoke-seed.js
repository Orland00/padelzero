#!/usr/bin/env node

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_USER_ID } from '../../src/lib/constants.js'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SEED_PASSWORD = process.env.SMOKE_SEED_PASSWORD || 'PadelZeroSmoke!2026'

const SEED = {
  player: {
    email: 'smoke-player@example.com',
    display_name: 'Smoke Player',
    role: 'player',
    username: 'smoke_player',
  },
  ligaAdmin: {
    email: 'smoke-liga-admin@example.com',
    display_name: 'Smoke Liga Admin',
    role: 'player',
    username: 'smoke_liga_admin',
  },
  tournamentCreator: {
    email: 'smoke-tournament@example.com',
    display_name: 'Smoke Tournament',
    role: 'player',
    username: 'smoke_tournament',
  },
  coach: {
    email: 'smoke-coach@example.com',
    display_name: 'Smoke Coach',
    role: 'coach',
    username: 'smoke_coach',
  },
  clubOwner: {
    email: 'smoke-club-owner@example.com',
    display_name: 'Smoke Club Owner',
    role: 'club_admin',
    username: 'smoke_club_owner',
  },
  platformAdmin: {
    email: process.env.SMOKE_PLATFORM_ADMIN_EMAIL || null,
    password: process.env.SMOKE_PLATFORM_ADMIN_PASSWORD || null,
  },
}

const MARKERS = {
  ligaName: 'Liga Smoke QA',
  ligaSlug: 'liga-smoke-qa',
  tournamentName: 'Torneo Smoke QA',
  tournamentSlug: 'torneo-smoke-qa',
  clubName: 'Club Smoke QA',
  clubSlug: 'club-smoke-qa',
  coachBio: 'Smoke seed - safe to delete',
}

function requireEnv(name, value) {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function serviceClient() {
  return createClient(
    requireEnv('VITE_SUPABASE_URL', SUPABASE_URL),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

function anonClient() {
  return createClient(
    requireEnv('VITE_SUPABASE_URL', SUPABASE_URL),
    requireEnv('VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

async function ensureAuthUser(admin, { email, display_name }) {
  const existing = await findUserByEmail(admin, email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: display_name, name: display_name },
    })
    if (error) throw error
    return data.user
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: display_name, name: display_name },
  })
  if (error) throw error
  return data.user
}

async function cleanupSeedData(db) {
  const tournamentId = await findSeedId(db, 'tournaments', 'name', MARKERS.tournamentName)
  const ligaId = await findSeedId(db, 'ligas', 'name', MARKERS.ligaName)
  const clubId = await findSeedId(db, 'clubs', 'slug', MARKERS.clubSlug)

  if (tournamentId) {
    await db.from('tournament_participants').delete().eq('tournament_id', tournamentId)
    await db.from('tournament_matches').delete().eq('tournament_id', tournamentId)
  }
  await db.from('tournaments').delete().eq('name', MARKERS.tournamentName)

  if (ligaId) {
    await db.from('liga_matches').delete().eq('liga_id', ligaId)
    await db.from('liga_pair_stats').delete().eq('liga_id', ligaId)
    await db.from('liga_team_stats').delete().eq('liga_id', ligaId)
    await db.from('liga_standings').delete().eq('liga_id', ligaId)
    await db.from('liga_members').delete().eq('liga_id', ligaId)

    const jornadaIds = await listSeedIds(db, 'jornadas', 'liga_id', ligaId)
    if (jornadaIds.length > 0) {
      await db.from('jornada_checkins').delete().in('jornada_id', jornadaIds)
      const roundIds = await listSeedIds(db, 'americano_rounds', 'jornada_id', jornadaIds[0])
      if (roundIds.length > 0) {
        await db.from('americano_matches').delete().in('round_id', roundIds)
      }
      await db.from('americano_rounds').delete().in('jornada_id', jornadaIds)
      await db.from('jornadas').delete().eq('liga_id', ligaId)
    }
  }
  await db.from('ligas').delete().eq('name', MARKERS.ligaName)

  const coachIds = await listSeedIds(db, 'coaches', 'bio', MARKERS.coachBio)
  if (coachIds.length > 0) {
    await db.from('coach_availability').delete().in('coach_id', coachIds)
  }
  await db.from('coaches').delete().eq('bio', MARKERS.coachBio)

  if (clubId) {
    await db.from('courts').delete().eq('club_id', clubId)
    await db.from('club_bookings').delete().eq('club_id', clubId)
    await db.from('club_availability_overrides').delete().eq('club_id', clubId)
    await db.from('club_availability').delete().eq('club_id', clubId)
  }
  await db.from('clubs').delete().eq('slug', MARKERS.clubSlug)

  await db.from('profiles').delete().in('email', Object.values(SEED).map((u) => u.email).filter(Boolean))
}

async function findSeedId(db, table, column, value) {
  const { data, error } = await db.from(table).select('id').eq(column, value).maybeSingle()
  if (error) throw error
  return data?.id || null
}

async function listSeedIds(db, table, column, value) {
  if (!value) return []
  const { data, error } = await db.from(table).select('id').eq(column, value)
  if (error) throw error
  return (data || []).map((row) => row.id)
}

async function seedSmokeData() {
  const admin = serviceClient()
  const db = admin

  await cleanupSeedData(db)

  const [player, ligaAdmin, tournamentCreator, coach, clubOwner] = await Promise.all([
    ensureAuthUser(admin, SEED.player),
    ensureAuthUser(admin, SEED.ligaAdmin),
    ensureAuthUser(admin, SEED.tournamentCreator),
    ensureAuthUser(admin, SEED.coach),
    ensureAuthUser(admin, SEED.clubOwner),
  ])

  const profiles = [
    { id: player.id, email: SEED.player.email, display_name: SEED.player.display_name, username: SEED.player.username, role: SEED.player.role },
    { id: ligaAdmin.id, email: SEED.ligaAdmin.email, display_name: SEED.ligaAdmin.display_name, username: SEED.ligaAdmin.username, role: SEED.ligaAdmin.role },
    { id: tournamentCreator.id, email: SEED.tournamentCreator.email, display_name: SEED.tournamentCreator.display_name, username: SEED.tournamentCreator.username, role: SEED.tournamentCreator.role },
    { id: coach.id, email: SEED.coach.email, display_name: SEED.coach.display_name, username: SEED.coach.username, role: SEED.coach.role },
    { id: clubOwner.id, email: SEED.clubOwner.email, display_name: SEED.clubOwner.display_name, username: SEED.clubOwner.username, role: SEED.clubOwner.role },
  ]

  const { error: profileError } = await db.from('profiles').upsert(profiles, { onConflict: 'id' })
  if (profileError) throw profileError

  const { data: club, error: clubError } = await db.from('clubs').insert({
    name: MARKERS.clubName,
    slug: MARKERS.clubSlug,
    owner_user_id: clubOwner.id,
    active: true,
    verified: true,
  }).select('id').single()
  if (clubError) throw clubError

  const { error: courtsError } = await db.from('courts').insert([
    { club_id: club.id, court_number: 1, name: 'Smoke Court 1', active: true },
    { club_id: club.id, court_number: 2, name: 'Smoke Court 2', active: true },
  ])
  if (courtsError) throw courtsError

  const { data: coachRow, error: coachError } = await db.from('coaches').upsert({
    profile_id: coach.id,
    bio: MARKERS.coachBio,
    specialties: ['beginners', 'fitness'],
    experience_years: 7,
    hourly_rate_cents: 120000,
    group_rate_cents: 90000,
    city: 'Demo City',
    verified: true,
    active: true,
  }, { onConflict: 'profile_id' }).select('id').single()
  if (coachError) throw coachError

  const { error: availabilityError } = await db.from('coach_availability').insert({
    coach_id: coachRow.id,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '10:00',
    slot_duration_minutes: 60,
    is_group: false,
    is_active: true,
  })
  if (availabilityError) throw availabilityError

  const { data: liga, error: ligaError } = await db.from('ligas').insert({
    name: MARKERS.ligaName,
    description: 'Smoke seed league for permission checks',
    created_by: ligaAdmin.id,
    schedule: { rules: { preset: 'express', maxScore: 4, deadPoint: true, winByTwo: false } },
    is_active: true,
  }).select('id').single()
  if (ligaError) throw ligaError

  const { error: ligaMembersError } = await db.from('liga_members').insert([
    { liga_id: liga.id, player_id: ligaAdmin.id, role: 'admin', is_active: true },
    { liga_id: liga.id, player_id: player.id, role: 'player', is_active: true },
  ])
  if (ligaMembersError) throw ligaMembersError

  const { data: jornada, error: jornadaError } = await db.from('jornadas').insert({
    liga_id: liga.id,
    jornada_number: 1,
    date: new Date().toISOString().slice(0, 10),
    status: 'upcoming',
    created_by: ligaAdmin.id,
  }).select('id').single()
  if (jornadaError) throw jornadaError

  const { error: tournamentError } = await db.from('tournaments').insert({
    name: MARKERS.tournamentName,
    slug: MARKERS.tournamentSlug,
    description: 'Smoke seed tournament for creator checks',
    type: 'single_elimination',
    status: 'draft',
    created_by: tournamentCreator.id,
    club_id: club.id,
    max_participants: 8,
  })
  if (tournamentError) throw tournamentError

  const platformAdminUser = process.env.SMOKE_PLATFORM_ADMIN_EMAIL
    ? await ensureAuthUser(admin, {
        email: process.env.SMOKE_PLATFORM_ADMIN_EMAIL,
        display_name: 'Platform Admin',
      })
    : null

  if (platformAdminUser?.id) {
    const { error: adminProfileError } = await db.from('profiles').upsert({
      id: platformAdminUser.id,
      email: process.env.SMOKE_PLATFORM_ADMIN_EMAIL,
      display_name: 'Platform Admin',
      username: 'platform_admin',
      role: 'admin',
      is_founder: true,
    }, { onConflict: 'id' })
    if (adminProfileError) throw adminProfileError
  }

  return {
    players: { player, ligaAdmin, tournamentCreator, coach, clubOwner },
    clubId: club.id,
    coachId: coachRow.id,
    ligaId: liga.id,
    jornadaId: jornada.id,
    platformAdminId: platformAdminUser?.id || null,
  }
}

async function signInAs(client, email, password = SEED_PASSWORD) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

async function verifySeededAccess(seedState) {
  const client = anonClient()
  const results = []

  const cases = [
    {
      label: 'normal player',
      user: SEED.player,
      checks: async (user) => {
        const { data, error } = await client.from('profiles').select('id, display_name').eq('id', user.id).single()
        if (error) throw error
        if (data.id !== user.id) throw new Error('profile lookup failed')
      },
    },
    {
      label: 'liga admin',
      user: SEED.ligaAdmin,
      checks: async (user) => {
        const { error } = await client.from('ligas').update({ description: 'Smoke seed updated by admin' }).eq('id', seedState.ligaId)
        if (error) throw error
        const { data: member, error: memberError } = await client.from('liga_members').select('role').eq('liga_id', seedState.ligaId).eq('player_id', user.id).single()
        if (memberError) throw memberError
        if (member.role !== 'admin') throw new Error('liga admin role missing')
      },
    },
    {
      label: 'coach',
      user: SEED.coach,
      checks: async (user) => {
        const { data, error } = await client.from('coaches').select('id, profile_id').eq('profile_id', user.id).single()
        if (error) throw error
        const { error: availabilityError } = await client.from('coach_availability').insert({
          coach_id: data.id,
          day_of_week: 2,
          start_time: '11:00',
          end_time: '12:00',
          slot_duration_minutes: 60,
          is_group: false,
          is_active: true,
        })
        if (availabilityError) throw availabilityError
      },
    },
    {
      label: 'club owner',
      user: SEED.clubOwner,
      checks: async (user) => {
        const { data, error } = await client.from('clubs').select('id, owner_user_id').eq('id', seedState.clubId).single()
        if (error) throw error
        if (data.owner_user_id !== user.id) throw new Error('club owner mismatch')
        const { error: courtError } = await client.from('courts').insert({
          club_id: seedState.clubId,
          court_number: 3,
          name: 'Smoke Court 3',
          active: true,
        })
        if (courtError) throw courtError
      },
    },
    {
      label: 'tournament creator',
      user: SEED.tournamentCreator,
      checks: async (user) => {
        const { data, error } = await client.from('tournaments').select('id, created_by').eq('name', MARKERS.tournamentName).single()
        if (error) throw error
        if (data.created_by !== user.id) throw new Error('tournament creator mismatch')
      },
    },
  ]

  for (const testCase of cases) {
    await client.auth.signOut()
    const user = await signInAs(client, testCase.user.email)
    await testCase.checks(user)
    results.push(testCase.label)
  }

  await client.auth.signOut()

  if (process.env.SMOKE_PLATFORM_ADMIN_EMAIL && process.env.SMOKE_PLATFORM_ADMIN_PASSWORD) {
    const adminUser = await signInAs(client, process.env.SMOKE_PLATFORM_ADMIN_EMAIL, process.env.SMOKE_PLATFORM_ADMIN_PASSWORD)
    if (adminUser.id !== ADMIN_USER_ID) {
      throw new Error(`platform admin must be ADMIN_USER_ID (${ADMIN_USER_ID}), got ${adminUser.id}`)
    }
    const { data, error } = await client.from('profiles').select('role').eq('id', adminUser.id).single()
    if (error) throw error
    if (data.role !== 'admin') throw new Error('platform admin profile role is not admin')
    results.push('platform admin')
  }

  return results
}

async function main() {
  const seeded = await seedSmokeData()
  const verified = await verifySeededAccess(seeded)
  console.log(`Seeded smoke users ready: ${verified.join(', ')}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}

export { seedSmokeData, verifySeededAccess, SEED, MARKERS, SEED_PASSWORD }
