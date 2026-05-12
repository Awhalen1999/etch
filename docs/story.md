# etch — story and prose reference

all authored text the player will see in the world. game mechanics are in design.md.

## opening cutscene

plays once, on first-ever login. text arrives line-by-line with ~1.5s pauses between most lines and longer pauses on dialogue. player input is locked during the cutscene.
the surface is dying.

## dialog

# cut scene 1 start (mute chat)

the surface is dying.

[pause]

the heat killed your camp three days ago.
the others didn't make it.

[pause]

you walked.

[longer pause]

three days.
no water. no shade. no one.
just cracked earth and yellow sky --- filled with dust.

[pause]

you stopped sweating on the second day.
you kept walking because stopping meant lying down.
and lying down meant not getting up.

[pause]

on the third day you saw it.
a hole in the ground. dark and still.

[pause]

you went towards it because there was nothing else.

[pause]

the edge crumbled under your weight.

[pause]

you fell for a long time.

[pause]

dust.
impact.
nothing.

[longer pause]

when you wake someone is sitting near you in the shade.

[pause]

"you came down too."

[pause]

he sounds almost pleased.

[pause]

"they all come down eventually."

[pause]

he's been sitting here for a while.
you can tell by the way the dust has settled around him.

[pause]

you look around.
its some sort of abandoned mineshaft.

[pause]

you look up.
the ceiling above and walls are pure stone.
the lip curls inwards like a jaw.
even with rope the climb seems impossible.

[longer pause]

almost like it was designed that way

[pause]

"thats quite a fall you took."

[pause]

"the good news is it's not far between levels down here."

[pause]

"you can use the old beams to climb if you need to."

[pause]

"the only way out is down."
that way he points down the seemingly endless vertical mineshaft below.

[pause]

he grins. it doesn't reach his eyes.

[pause]

he pulls something out of a bag next to him.
he tosses it to you.

[pause]

an old minors headlamp.

[pause]

"it gets dark down there."

[pause]

"i've watched a lot of people go down."

[longer pause]

"not many come back."

[pause]

he settles back against the wall.
he looks comfortable. he looks like he could sit here forever.

[pause]

"me. i'm happy here. i like the quiet."

[pause]

he watches you in the dim for a while.
something in him is wrong but you can't say what.

"go on, then. or stay. some of us stay."

[pause]

you think one thing, clearly:

[pause]

i am not dying here.

[pause]

the only way is down.

# cut scene 1 end

after this, gameplay begins. the player is at depth 1. the NPC is still there. they can `/down` whenever.

## the NPC

name: **Horris**

permanent at depth 1. does not move. does not respond to chat. doesn't fight. is not targetable by `/look` (that's for other players). speaks on triggered events.

### NPC trigger lines

the NPC speaks one randomly-selected line when triggered. triggers below.

**on returning to depth 1 after going deeper (climbed back up):**

"still here, are you."

"how was it down there."

"you came back. they don't always."

"the lamp helps, doesn't it."

"you'll get used to the smell."

"some of them stop talking after a while."

"the walls remember more than i do."

**on respawning at depth 1 after death:**

"back already."

"didn't make it, did you."

"that's how it starts."

"i thought you'd last longer."

"hm. quick this time."

"the dirt got you."

"you'll learn."

**on idle / inactivity at depth 1 (occasional, randomized timing):**

"i was going to climb out once."

"don't be in a hurry."

"sometimes i hear them. up there. the others."

"this isn't a bad place to wait."

## first encounter cutscene

plays once, the first time a player triggers an ant encounter (below depth 40). after this, encounters are purely mechanical.

something moves in the dark below you.

[pause]

you hear it before you see it.
legs. too many legs. clicking against stone.

[pause]

it pulls itself up onto the beam in front of you.

[longer pause]

it's the size of a man.

[pause]

its head is wrong. smooth and ridged like cracked bone.
two black eyes catch your headlamp and don't reflect it back.
they just swallow the light.

[pause]

its mandibles open sideways.
they're serrated. wet. there's something dark caught between them.

[pause]

it smells like copper and rot.

[longer pause]

it doesn't charge. it just watches you.
its antennae twitch once. twice.

[pause]

it knows you're here.

/fight to engage.
/escape to run.

## first-visit band messages

each player sees the message the first time their depth crosses into a new band — derived from deepest_depth tracking.

the dust (depth 1-30) has no first-visit message — the opening cutscene serves that purpose.

### the stone (depth 31)

the shaft narrows. the walls are smoother now —
like something polished them, a long time ago.
the dust from above doesn't reach this deep.

### the writing (depth 81)

inscriptions begin to appear on the walls.
horrors. this place is not right.

the wall remembers everyone.

### the damp (depth 121)

your breath fogs. the rock is wet to the touch.
water trickles somewhere out of sight.
something about the air here is wrong.
its freezing cold. 

### the quiet (depth 161)

sound dies here.
your words don't echo. your own breath sounds far away.
this is not a place where things rest.

### the queen (depth 200)

# cut scene 2 start (mute chat)

the shaft opens.

[pause]

you stop. there is an opening below you. a room, not a tunnel.

[pause]

a strange light pulses from somewhere across the chamber.
something biological. something alive in the walls.

[longer pause]

you take another step down.

[pause]

the floor is wet. it's not water.

[pause]

bones.

[pause]

scattered across the stone. picked clean. human.
skulls. ribcages. jawbones cracked open and hollowed out.
drag marks lead inward from every tunnel.

[longer pause]

this is where they bring them.

[pause]

[CLICK]

[CLICK CLICK]

[pause]

mandibles. opening and closing in the dark.
the sound of bone on bone.

[longer pause]

she's at the center of the room.

[pause]

she's massive. twice your size.
her abdomen drags behind her, swollen with eggs
that pulse and shift beneath a membrane slick with fluid.

[pause]

where she moves she leaves a trail.
dark. thick. something between blood and mucus.
it hisses faintly where it meets the stone.

[pause]

her exoskeleton is black and cracked. gore clings to the ridges.
remains. hair. things you don't want to identify.

[pause]

her head turns toward you.
compound eyes. hundreds of black lenses.
every single one finds you at once.

[pause]

her mandibles open. the length of your forearm.
serrated. stained dark. they click shut. click open.

[longer pause]

she pulls herself toward you.
slow. deliberate. dragging that weight behind her.
the trail widens.

[pause]

she doesn't need to be fast.
everything that comes down here ends up in front of her eventually.

[pause]

/fight to engage.
/escape to run.

# cut scene 2 end

after this, the queen encounter is active. chat stays muted until the encounter resolves (kill, death, or escape).

## death messages

when a player dies, a death-marker inscription is automatically carved at the depth they died. format:

{name} fell here. {YYYY-MM-DD}.

players who pass through that depth and `/read` will see it among the inscriptions.

## queen death message

the queen has been slain.

# cut scene 3 start (mute chat)

the clicking falters. the queens body slumps.
something deep below her shifts and goes still.

[longer pause]

you have killed the queen of this place.

[pause]

beneath her, a sac. swollen. leaking something that hisses
against the stone. wherever it touches, the rock blackens and gives.

[pause]

you take it. (it gets added to your inventory in a 6th slot)

/ascent to begin the climb back.
/mark to leave your mark on the cave for everyone to see

[/ascent cut]

the sound starts before you see it.

[pause]

clicking. everywhere. frantic.

[pause]

the ants are dying.
they curl inward on themselves, legs twitching.
the mineshaft fills with a sound like screaming.

[pause]

you begin climbing past them. 

[pause]

level after level. the beams creak under your hands. 
the walls you fought through. the dark you survived.
it all slides by beneath you now.
you have what feels like infinite stamina to climb now that you might have a way out.

[longer pause] 

you reach depth 1.

[pause]

the dust is undisturbed.
the wall where Horris sat is bare.
no prints. no lamp. no sign anyone was ever here. 

[longer pause]

you look up.

[pause]

forty feet of smooth stone. the lip curls inward above you.

[pause]

you crack the sac against the wall.
it hisses. the rock blackens. gives.

[pause]

you climb.
handhold by handhold. burning your way up.

[longer pause]

the surface.

[pause]

the heat hits you and you remember why you went down in the first place.

[pause]

but you're out.

# cut scene 3 end

the player's name gains a permanent diacritic.

## ambient lines

short atmospheric lines that occasionally fire in the main scroll area. weighted by band. fire roughly every 60-90 seconds while a player is active and not in an encounter.

### the dust (1-30)

dust drifts down from above.
the rock is warm from the surface.
something skitters somewhere overhead. probably nothing.

### the stone (31-80)

the walls smell of old iron.
you think you hear sounds. you can't be sure.

### the writing (81-120)

someone wrote a name here long ago.
the inscriptions get harder to read at this depth.
the wall is colder than it should be.

### the damp (121-160)

something drips, far above.
the rock is slick. you slow down.
your breath comes in clouds.

### the quiet (161-199)

you stop breathing for a moment to listen.
the silence is wrong. the silence is full.
something is paying attention.

## error messages with voice

errors and refusals should match the game's tone. keep them short.

| situation | line |
|---|---|
| empty /mark | `carve what?` |
| /mark too long | `too much to carve. 240 characters max.` |
| /down out of stamina | `you don't have the strength.` |
| /up out of stamina | `you don't have the strength to climb.` |
| /up at depth 1 | `the lip overhangs. no climbing back.` |
| moving while resting | `you have to wake up first.` |
| acting while climbing cooldown | `you need to catch your breath.` |
| /look at the npc | `you can only look at the other climbers.` |
| unknown command | `unknown command: {input}` |
| chat to no one (alone at depth) | (nothing — message just drops silently) |

## tone guidelines

- the game speaks in observations, never instructions
- short sentences. no exclamation points.
- never explain the horror. only describe what's there.
- never use the words "demon", "hell", "evil"
- never use "you must" or "you should"
- the world is indifferent, not hostile. the wrongness is ambient, not aggressive.
- lowercase voice throughout, with occasional capitalized words for emphasis (sparing)