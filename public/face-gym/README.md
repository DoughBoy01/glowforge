# Face Gym videos

The exercise clips live here. One mp4 per round, and
[`src/lib/face-gym.ts`](../../src/lib/face-gym.ts) says which file each round
plays — so the filenames don't have to follow any pattern, they just have to
match the `file` field:

```ts
{ slug: "cheek-lift", file: "gym.mp4", name: "Cheek Lift", … }
```

Currently wired up:

| round | file       | exercise   |
| ----- | ---------- | ---------- |
| 1     | `gym.mp4`  | Cheek Lift |
| 2     | `gym2.mp4` | Cheek Puff |
| 3     | `gym1.mp4` | Jaw Drop   |

To add a round, drop the mp4 in this folder and add an entry to
`FACE_GYM_EXERCISES`. To reorder or drop one, edit that array — the player, the
round list and the session length all read from it. A round whose file isn't
here yet still shows up and still counts down; the player just names the file
it expected, so the list works as a checklist while you shoot the rest.

## What the player needs from the files

- **H.264 / AAC in an .mp4 container.** Safari and iOS won't play much else,
  and this is a PWA people install on a phone. The three current clips are
  1264×720.
- **Silent or narrated, either is fine.** Every round starts muted (browsers
  block autoplay with sound), and there's a speaker button to unmute.
- **Loopable.** Each clip plays on repeat for the full minute, so start and
  end in roughly the same position — rest → movement → rest, like the current
  ones — and the loop won't visibly jump. 5–20s is plenty; there's no need for
  a minute of footage.
- **Any aspect ratio.** The frame is 16:9 and letterboxes rather than crops, so
  nothing gets cut off the top of a head.
- **Keep them small — target under ~3 MB each.** They're served as static
  assets and the whole set downloads on a phone. 720p is enough.
