// Authored cutscene prose for the opening and the band first-visits.
//
// Each function returns an Emit[] that the cutscene queue plays one
// line per CUTSCENE_LINE_MS. A literal "..." entry counts as a pause —
// no special markup or pause logic, just another line of text.
//
// Prose tracks docs/story.md but compresses repeated beats so each
// cutscene reads tight. Tone guidelines (lowercase, observational, no
// exclamation marks, never name the horror) live in docs/story.md.

import type { Band } from "./world.ts"
import type { Emit } from "./types.ts"

// ---- Helpers (file-local) ----

const story = (text: string): Emit => ({ style: "story", text })
const sys = (text: string): Emit => ({ style: "system", text })
const pause: Emit = { style: "story", text: "..." }
// Horris's spoken lines, set in quotes so they read as dialog.
const speech = (text: string): Emit => ({ style: "story", text: `"${text}"` })

// ---- Opening cutscene ----
//
// Plays once on first-ever launch. Ends with a system line that points
// at /help so brand-new players know where to start.
export function openingCutsceneLines(): Emit[] {
  return [
    story("the surface is dying."),
    pause,
    story("the heat killed your camp three days ago."),
    story("the others didn't make it."),
    pause,
    story("you walked."),
    pause,
    story("three days. no water. no shade. no one."),
    story("just cracked earth and yellow sky, thick with dust."),
    pause,
    story("you stopped sweating on the second day."),
    story("you kept walking because stopping meant lying down."),
    story("and lying down meant not getting up."),
    pause,
    story("on the third day you saw it."),
    story("a hole in the ground. dark and still."),
    pause,
    story("you went toward it because there was nothing else."),
    pause,
    story("the edge crumbled under your weight."),
    story("you fell for a long time."),
    pause,
    story("dust. impact. nothing."),
    pause,
    story("you wake. someone is sitting near you, in the shade."),
    pause,
    speech("you came down too."),
    story("he sounds almost pleased."),
    pause,
    speech("they all come down eventually."),
    pause,
    story("he's been here a while. you can tell by the dust settled around him."),
    pause,
    story("you look around. it's an abandoned mineshaft."),
    story("you look up. the ceiling and walls are smooth stone."),
    story("the lip curls inward like a jaw."),
    story("even with rope the climb seems impossible."),
    pause,
    story("almost like it was designed that way."),
    pause,
    speech("that's quite a fall you took."),
    pause,
    speech("the good news is it's not far between levels down here."),
    speech("you can use the old beams to climb if you need to."),
    pause,
    speech("the only way out is down."),
    story("he points down the shaft. it goes farther than your light reaches."),
    pause,
    story("he grins. it doesn't reach his eyes."),
    pause,
    story("he pulls something from a bag beside him. tosses it to you."),
    story("an old miner's headlamp."),
    pause,
    speech("it gets dark down there."),
    pause,
    speech("i've watched a lot of people go down."),
    speech("not many come back."),
    pause,
    story("he settles back against the wall."),
    story("he looks comfortable. he looks like he could sit here forever."),
    pause,
    speech("me. i'm happy here. i like the quiet."),
    pause,
    story("something in him is wrong but you can't say what."),
    pause,
    speech("go on, then. or stay. some of us stay."),
    pause,
    story("you think one thing, clearly:"),
    pause,
    story("i am not dying here."),
    pause,
    story("the only way is down."),
    pause,
    sys("type /help for commands."),
  ]
}

// ---- Band first-visit cutscenes ----
//
// Fire once when deepest_depth first crosses into a band. The dust has
// no message — the opening cutscene serves that purpose. The queen at
// depth 200 is a separate, full cutscene that lives with that boss.
export function bandFirstVisitLines(band: Band): Emit[] | null {
  switch (band) {
    case "the stone":
      return [
        story("the shaft narrows. the walls are smoother now."),
        story("like something polished them, a long time ago."),
        story("the dust from above doesn't reach this deep."),
      ]
    case "the writing":
      return [
        story("inscriptions begin to appear on the walls."),
        story("horrors. this place is not right."),
        pause,
        story("the wall remembers everyone."),
      ]
    case "the damp":
      return [
        story("your breath fogs. the rock is wet to the touch."),
        story("water trickles somewhere out of sight."),
        story("the air here is wrong. it is freezing cold."),
      ]
    case "the quiet":
      return [
        story("sound dies here."),
        story("your words don't echo. your own breath sounds far away."),
        story("this is not a place where things rest."),
      ]
    case "the dust":
    case "the queen":
      return null
  }
}

// ---- Band crossing detection ----
//
// Returns the band the player just entered if their deepest depth
// crossed a band threshold this move, otherwise null. Caller uses the
// returned band to queue the corresponding first-visit cutscene.
export function bandCrossing(oldDeepest: number, newDeepest: number): Band | null {
  if (newDeepest <= oldDeepest) return null
  const thresholds: Array<[number, Band]> = [
    [31, "the stone"],
    [81, "the writing"],
    [121, "the damp"],
    [161, "the quiet"],
  ]
  for (const [t, band] of thresholds) {
    if (oldDeepest < t && newDeepest >= t) return band
  }
  return null
}
