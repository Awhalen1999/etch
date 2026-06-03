// Two top-level layouts. game.tsx picks one based on state:
//
//   - phase === "in_combat"  -> CombatLayout  (HUD + 3 combat panels)
//   - everything else        -> MainLayout    (HUD + scroll + footer)
//
// Each layout is self-contained. Switching is driven by state, not by
// conditionals inside any single layout. Narration (formerly "cutscene")
// plays inline through MainLayout — the only signal is the footer
// swapping from InputBar to a dim "..." while lines drip into the scroll.

import type { CombatState, GameState, PlayerState } from "../game/types.ts"
import {
  Hud, InputBar, NarrationIndicator, PreCombatBar, Rule, Scroll,
} from "./panels.tsx"
import { EnemyPanel, MomentPanel, TimingPanel } from "./combat-panels.tsx"

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
// footer has three states:
//   - narration playing     -> dim "..." indicator (input disabled)
//   - phase === "pre_combat" -> PreCombatBar (F/E + countdown)
//   - otherwise              -> InputBar (the > prompt)
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

  function renderFooter() {
    if (state.cutscene) return <NarrationIndicator />
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
