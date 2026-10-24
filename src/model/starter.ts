// The note a new user starts with. Also serves as a living example of the format.
export const STARTER = `title: Leg day
columns: [2fr, 1fr, 1fr]
cells:
  - {at: [0, 0], span: 3, text: Leg day, bold: true}
groups:
  - at: [0, 1]
    variant: stack
    rows:
      - [{text: Squat, bold: true}, {counter: 0, label: Reps}, {timer: 0}]
      - [{text: Lunge, bold: true}, {counter: 0, label: Reps}, {timer: 0}]
`
