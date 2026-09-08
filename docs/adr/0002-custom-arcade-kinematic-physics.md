# Use Custom Arcade Kinematic Physics Instead of Rigid-Body Engine

We will implement a custom raycast-based kinematic vehicle controller in TypeScript rather than using a general-purpose rigid-body physics engine (such as Rapier or Cannon-es). This guarantees deterministic arcade drift mechanics, snappy counter-steering, glitch-free wall sliding, and precise boost acceleration curves without the instability, inertia sluggishness, or unwanted roll-over flips common in standard rigid-body simulations.
