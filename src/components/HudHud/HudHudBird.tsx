/** Original vector interpretation of the supplied hoopoe references.
 * Named groups are the replacement/animation contract; no external assets or IDs.
 */
export function HudHudBird() {
  return (
    <svg className="hudhud-art" viewBox="0 0 100 96" fill="none" aria-hidden="true" focusable="false">
      <g className="hudhud-posture">
        <g className="hudhud-tail">
          <path d="M38 56 9 78 3 83l10-2 30-17Z" fill="#24211F" />
          <path d="m18 71 6-5 7 3-7 5Z" fill="#F5F1E8" />
          <path d="m9 79 26-18" stroke="#80776E" strokeWidth=".6" />
        </g>
        <g className="hudhud-wing-far"><FlightWing /></g>
        <g className="hudhud-body">
          <path d="M24 59c4-11 17-14 26-22 5-5 6-12 12-14 7-3 14 2 13 8-1 6-8 8-9 14-2 8-5 19-15 23-11 5-24 1-27-9Z" fill="#D9B08C" />
          <path d="M58 34c-1 11-6 14-8 22-2 6-9 11-17 10 13 7 24 2 29-9 3-7 3-14 8-19Z" fill="#C98F67" />
          <path d="M60 39c1 7-3 14-5 18" stroke="#E2BE9A" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <g className="hudhud-legs" stroke="#494039" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="m42 67 2 7-3 8m-5 1 5-1 5 1" />
          <path d="m52 64-2 10 3 7m-4 2 4-2 5 1" />
        </g>
        <g className="hudhud-folded-wing">
          <path d="M53 43c-14-1-27 8-36 23l-5 7c15-1 30-7 38-17 4-5 6-10 3-13Z" fill="#24211F" />
          <path d="M42 44c4 1 7 3 9 6l-4 5c-2-4-5-6-10-7Zm-11 8c5 0 10 2 13 6l-5 4c-3-3-7-5-12-5Zm-9 10c4 0 8 1 11 3l-6 3-8-2Z" fill="#F5F1E8" />
          <path d="M49 45c-3 7-11 16-32 25" stroke="#AFA99D" strokeWidth=".65" />
          <path d="M31 50c7-5 13-7 20-7" stroke="#B48B69" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="hudhud-wing-near"><FlightWing /></g>
        <g className="hudhud-head">
          <path d="M55 32c-4-6-1-13 6-15 7-2 14 3 15 9 0 6-5 11-11 12-4 0-7-3-10-6Z" fill="#D9874E" />
          <path d="M56 28c4 0 5 5 10 5l7-3c-1 6-9 9-13 4Z" fill="#E2BE9A" />
          <g className="hudhud-crest">
            {[[-49, 24], [-34, 28], [-19, 30], [-4, 31], [11, 29], [26, 25], [41, 21]].map(([angle, length]) => (
              <g key={angle} transform={`rotate(${angle} 61 25)`}>
                <path d={`M59 25Q55 ${25 - length / 2} 57 ${25 - length}Q60 ${21 - length} 63 ${25 - length}Q66 ${25 - length / 2} 62 26Z`} fill={angle < 0 ? '#C97843' : '#E49A62'} />
                <path d={`M57 ${25 - length}Q60 ${21 - length} 63 ${25 - length}L63 ${30 - length}Q60 ${32 - length} 57 ${30 - length}Z`} fill="#24211F" />
              </g>
            ))}
          </g>
          <path d="M72 25c10 0 20 4 27 10-9-4-18-6-28-6Z" fill="#1C1A18" />
          <path d="M75 26c8 1 15 3 21 7" stroke="#817366" strokeWidth=".6" />
          <path d="m65 24 6-1" stroke="#9D5F39" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="67" cy="25" rx="1.65" ry="1.8" fill="#1C1A18" />
          <circle cx="67.5" cy="24.5" r=".4" fill="#F5F1E8" />
        </g>
      </g>
    </svg>
  )
}

function FlightWing() {
  return <g className="hudhud-wing-stroke">
    <path d="M47 53C34 47 22 33 12 13Q9 9 8 14l3 17Q3 19 3 25l7 17Q0 33 3 41l10 13q-9-4-6 2l13 10q-6 0-3 4c11 4 23-3 30-17Z" fill="#24211F" />
    <path d="m10 23 5 11 5 9 6 8 7 7-5 5-9-10-6-12-3-11Zm4 29 7 7 5 3-4 5-9-8Z" fill="#F5F1E8" />
    <path d="M27 36c3 7 9 13 16 17l-5 6c-8-5-13-12-16-18Z" fill="#F5F1E8" />
    <path d="m13 35 20 26M9 44l21 20m-14-8 11 10" stroke="#847C71" strokeWidth=".55" />
    <path d="M47 53c-5-7-11-12-17-14l8 17Z" fill="#CFA07A" />
  </g>
}
