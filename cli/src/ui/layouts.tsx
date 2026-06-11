// Two top-level layouts. game.tsx picks one based on state:
//
//   - phase === "in_combat"  -> CombatLayout  (HUD + scroll + TimingPanel)
//   - everything else        -> MainLayout    (HUD + scroll + footer)
//
// Each layout is self-contained. Switching is driven by state, not by
// conditionals inside any single layout. Narration (formerly "cutscene")
// plays inline through MainLayout — the only signal is the footer
// swapping from InputBar to a dim "..." while lines drip into the scroll.

import type { CombatState, GameState, Line, PlayerState } from "../game/types.ts"
import {
  Hud, InputBar, NarrationIndicator, PreCombatBar, Rule, Scroll,
} from "./panels.tsx"
import { TimingPanel } from "./combat-panels.tsx"

// ---- CombatLayout -------------------------------------------------------
//
// HUD pinned at top, TimingPanel pinned at bottom (mirrors MainLayout's
// InputBar anchoring — keys live where the player's eyes go). Combat
// telegraphs and outcomes are emitted into state.lines by the reducer,
// so the Scroll handles them the same way it handles exploration prose.
//
//   HUD          - player stamina + depth + enemy name/HP on the right
//   Scroll       - the shared line buffer (telegraphs + outcomes)
//   TimingPanel  - bouncing bar + S/B/E hints (owns input)
export function CombatLayout({
  combat, player, lines, width, visibleCount, onStrike, onBrace, onEscape,
}: {
  combat: CombatState
  player: PlayerState
  lines: Line[]
  width: number
  visibleCount: number
  onStrike: () => void
  onBrace: () => void
  onEscape: () => void
}) {
  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%" }}>
      <Hud player={player} combat={combat} />
      <Rule width={width} />
      <Scroll lines={lines} visibleCount={visibleCount} />
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
