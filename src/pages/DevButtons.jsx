import GlassButton from '@/components/ui/GlassButton'
import { useState } from 'react'

export default function DevButtons() {
  const [loading, setLoading] = useState(false)

  const simulateLoading = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 pb-32 glass-ambient">
      <div className="max-w-lg mx-auto space-y-10">

        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Glassmorphism Buttons</h1>
          <p className="text-sm text-zinc-500">Iridescent Glow design system — dev preview</p>
        </div>

        {/* Primary Actions */}
        <section>
          <Label>Primary Actions</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="primary" size="lg">Record Match</GlassButton>
            <GlassButton variant="primary" size="md">Create Liga</GlassButton>
            <GlassButton variant="primary" size="sm">Save</GlassButton>
            <GlassButton variant="primary" size="xs">Join</GlassButton>
          </div>
        </section>

        {/* Full Width Primary */}
        <section>
          <Label>Full Width</Label>
          <div className="space-y-3">
            <GlassButton variant="primary" size="lg" fullWidth>
              Create Liga ⚡
            </GlassButton>
            <GlassButton variant="primary" size="lg" fullWidth loading={loading} onClick={simulateLoading}>
              {loading ? '' : 'Click me — Loading State'}
            </GlassButton>
          </div>
        </section>

        {/* Secondary */}
        <section>
          <Label>Secondary Actions</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="secondary" size="lg">Cancel</GlassButton>
            <GlassButton variant="secondary" size="md">View Details →</GlassButton>
            <GlassButton variant="secondary" size="sm">Back</GlassButton>
          </div>
        </section>

        {/* Accent Colors */}
        <section>
          <Label>Accent Colors</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="accent-purple" size="lg">Join Tournament</GlassButton>
            <GlassButton variant="accent-amber" size="lg">Challenge 🔥</GlassButton>
          </div>
        </section>

        {/* Danger */}
        <section>
          <Label>Danger / Destructive</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="danger" size="md">Delete Match</GlassButton>
            <GlassButton variant="danger" size="md">Leave Liga</GlassButton>
          </div>
        </section>

        {/* Pills */}
        <section>
          <Label>Pills / Filter Tags</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton pill pillColor="emerald">Americano</GlassButton>
            <GlassButton pill pillColor="purple">Eliminación</GlassButton>
            <GlassButton pill pillColor="cyan">Liguilla</GlassButton>
            <GlassButton pill pillColor="amber">Mixto</GlassButton>
            <GlassButton variant="ghost" pill>All</GlassButton>
          </div>
        </section>

        {/* Ghost */}
        <section>
          <Label>Ghost</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="ghost" size="md">Skip</GlassButton>
            <GlassButton variant="ghost" size="sm">Maybe Later</GlassButton>
          </div>
        </section>

        {/* Icon Buttons */}
        <section>
          <Label>Icon Buttons</Label>
          <div className="flex flex-wrap gap-3 items-center">
            <GlassButton variant="secondary" size="icon">⚙️</GlassButton>
            <GlassButton variant="primary" size="icon">+</GlassButton>
            <GlassButton variant="accent-purple" size="icon">🏆</GlassButton>
            <GlassButton variant="danger" size="icon">🗑</GlassButton>
          </div>
        </section>

        {/* Disabled */}
        <section>
          <Label>Disabled States</Label>
          <div className="flex flex-wrap gap-3">
            <GlassButton variant="primary" size="lg" disabled>Not Available</GlassButton>
            <GlassButton variant="secondary" disabled>Disabled</GlassButton>
            <GlassButton variant="danger" size="sm" disabled>Can't Delete</GlassButton>
          </div>
        </section>

        {/* Glass Cards + Inputs preview */}
        <section>
          <Label>Glass Card + Input</Label>
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-white font-bold text-lg">Record Match</h3>
            <input className="glass-input" placeholder="Search players..." />
            <div className="flex gap-3">
              <GlassButton variant="secondary" className="flex-1">Cancel</GlassButton>
              <GlassButton variant="primary" className="flex-1">Save Match</GlassButton>
            </div>
          </div>
        </section>

        {/* Combination Example */}
        <section>
          <Label>Real Usage Example</Label>
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold">Liga ProLeague</h3>
                <p className="text-zinc-500 text-sm">Jornada 12 — 8 players</p>
              </div>
              <GlassButton variant="primary" size="icon">⚡</GlassButton>
            </div>
            <div className="flex gap-2">
              <GlassButton pill pillColor="emerald">Americano</GlassButton>
              <GlassButton pill pillColor="amber">Active</GlassButton>
            </div>
            <div className="flex gap-3">
              <GlassButton variant="accent-purple" className="flex-1" size="sm">View Standings</GlassButton>
              <GlassButton variant="primary" className="flex-1" size="sm">Record Match</GlassButton>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div className="text-[11px] font-bold tracking-[0.12em] text-zinc-500 uppercase mb-3">
      {children}
    </div>
  )
}
