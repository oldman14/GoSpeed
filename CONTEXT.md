# GoSpeed (QQ Speed Clone)

GoSpeed is a 3D arcade racing game inspired by Tencent's QQ Speed, centered on high-speed precision drifting, boost chaining, and competitive track mastery.

## Language

### Core Racing Mechanics

**Speed Race**:
A race mode purely focused on driving lines, drift timing, and boost chaining with no offensive items.
_Avoid_: Classic race, normal mode

**Drift**:
A controlled slide initiated by holding steer and drift keys simultaneously, preserving momentum through turns and filling the Nitro Tank.
_Avoid_: Powerslide, skid

**Drift Sparks**:
Visual particle emissions from the rear wheels signaling drift duration and boost readiness (progressing from blue to golden-orange).
_Avoid_: Tire smoke, skid particles

**Mini-Boost**:
A short, instant burst of acceleration available for a brief window immediately upon completing a drift.
_Avoid_: Quick boost, drift boost, mini turbo

**Double-Boost**:
Two consecutive mini-boosts executed by precise steering counter-steer and release timing at the tail end of a drift.
_Avoid_: 2x boost, double tap

**Nitro Tank**:
A gauge that fills as the kart drifts; once full, it can be expended for a sustained high-velocity burst.
_Avoid_: Turbo meter, energy bar, nitrous

**CWW Boost**:
An advanced boost chain executed by activating Nitro first, followed immediately by a Double-Boost, achieving the vehicle's top terminal velocity.
_Avoid_: Mega boost, nitro combo

**WCW Boost**:
An advanced boost chain executed by triggering the first Mini-Boost, then Nitro, then the second Mini-Boost, prioritizing rapid corner exit acceleration.
_Avoid_: Quick-nitro chain

**Air-Boost**:
A brief acceleration burst triggered by tapping accelerate while airborne after launching off ramps or drop-offs.
_Avoid_: Jump boost, airborne turbo

**Land-Boost**:
An instant acceleration burst triggered by tapping accelerate the moment the kart's wheels touch the ground after a jump.
_Avoid_: Landing turbo, touchdown boost

### Track Environment & Systems

**Checkpoint**:
Invisible collision boundaries placed along the track to track lap completion, splits, and validate fair driving lines.
_Avoid_: Gate, waypoint

**Speed Pad**:
A luminescent surface strip on the track floor that imparts an instant velocity burst upon contact.
_Avoid_: Boost pad, dash strip

**Kinematic Vehicle Controller**:
A custom mathematical movement model calculating raycast surface alignment, synthetic yaw slip, and boost impulses instead of generic rigid-body physics.
_Avoid_: Rigid body sim, physics car

**Spline Waypoint Follower**:
An AI driving system navigating vehicles along continuous curve paths with dynamic speed regulation and corner drift cues.
_Avoid_: Bot navigator, path follower

**Rubber-Banding**:
A real-time game balancing algorithm that modulates AI speed according to their distance from the player to maintain close racing competition.
_Avoid_: Catch-up cheat, auto handicap

**Synthesized Engine Audio**:
Procedural audio generation utilizing Web Audio API oscillators and gain curves to reflect RPM, throttle, and boost state in real time without audio sample delays.
_Avoid_: Sound clip, engine loop

**FOV Warp**:
A dynamic camera field-of-view expansion triggered during high-speed boosts to intensify the visual sensation of velocity.
_Avoid_: Camera zoom, speed effect
