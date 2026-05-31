// Three top-level layouts. game.tsx picks one based on state:
//
//   - cutscene playing       -> CutsceneLayout (full screen prose)
//   - phase === "in_combat"  -> CombatLayout   (HUD + 3 combat panels)
//   - everything else        -> MainLayout    (HUD + scroll + footer)
//
// Each layout is self-contained. Switching is driven by state, not by
// conditionals inside any single layout.

import type { CombatState, Cutscene, GameState, PlayerState } from "../game/types.ts"
import { LineView } from "./line-view.tsx"
import { Hud, InputBar, PreCombatBar, Rule, Scroll } from "./panels.tsx"
import { EnemyPanel, MomentPanel, TimingPanel } from "./combat-panels.tsx"

// ---- CutsceneLayout -----------------------------------------------------
//
// Full-screen prose. No HUD, no scroll buffer, no input — just the
// cutscene's revealed lines. The cutscene queue (in the reducer) drives
// everything; when it drains, state.cutscene goes null and game.tsx
// switches to MainLayout on its own.
export function CutsceneLayout({
  cutscene, height,
}: {
  cutscene: Cutscene
  height: number
}) {
  // Each story/dialog/thought/pause line takes 2 rows (text + margin
  // from LineView). Mechanical lines (system) take 1, but cutscenes are
  // almost all atmospheric so 2 rows is the right upper bound.
  const visibleCount = Math.max(1, Math.floor(height / 2))
  const visible = cutscene.shown.slice(-visibleCount)
  return (
    <box style={{
      flexDirection: "column", width: "100%", height: "100%",
      paddingLeft: 1, paddingRight: 1, overflow: "hidden",
    }}>
      {visible.map((emit, i) => (
        <LineView key={i} line={{ id: i, ...emit }} />
      ))}
    </box>
  )
}

// ---- CombatLayout -------------------------------------------------------
//
// HUD on top, then three combat panels stacked with rules between them:
//
//   HUD          - player stamina + depth (still matters in combat)
//   EnemyPanel   - name + HP bar (ascii art lands here later)
//   MomentPanel  - prev result + current telegraph
//   TimingPanel  - bouncing bar + S/B/E hints (owns input)
export function CombatLayout({
  combat, player, width, onStrike, onBrace, onEscape,
}: {
  combat: CombatState
  player: PlayerState
  width: number
  onStrike: () => void
  onBrace: () => void
  onEscape: () => void
}) {
  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Hud player={player} />
      <Rule width={width} />
      <EnemyPanel enemy={combat.enemy} hp={combat.enemyHp} maxHp={combat.enemyMaxHp} />
      <Rule width={width} />
      <MomentPanel telegraph={combat.round.telegraph} lastResult={combat.lastResult} />
      <Rule width={width} />
      <TimingPanel
        round={combat.round}
        onStrike={onStrike}
        onBrace={onBrace}
        onEscape={onEscape}
      />
    </box>
  )
}

// ---- MainLayout ---------------------------------------------------------
//
// HUD on top, scroll buffer in the middle, footer at the bottom. The
// footer is either the > input prompt (most of the time) or a
// PreCombatBar when an encounter is mid-decision.
export function MainLayout({
  state, width, visibleCount,
  onInput, onEngage, onEscape,
}: {
  state: GameState
  width: number
  visibleCount: number
  onInput: (raw: string) => void
  onEngage: () => void
  onEscape: () => void
}) {
  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Hud player={state.player} />
      <Rule width={width} />
      <Scroll lines={state.lines} visibleCount={visibleCount} />
      <Rule width={width} />
      {renderFooter()}
    </box>
  )

  // Footer depends on phase: pre-combat shows F/E + countdown; otherwise
  // the > prompt that dispatches commands.
  function renderFooter() {
    if (state.phase === "pre_combat" && state.encounter) {
      return (
        <PreCombatBar
          startedAt={state.encounter.startedAt}
          onEngage={onEngage}
          onEscape={onEscape}
        />
      )
    }
    return <InputBar onSubmit={onInput} />
  }
}
