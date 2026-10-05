# Final Smart Escape requirement review

Reviewed against all three pages of Smart_Escape_Problem_Statement.pdf on 5 October 2026.

| Required behavior | Implementation and evidence |
| --- | --- |
| Full schema, category references, bounds, undirected unique pairs | engine validation; boundary and malformed-input tests |
| All nodes/edges, coordinates, distinct types, labels and costs | SVG renderer; 9 costs visible; finite extreme-coordinate browser test |
| Select unblocked nonexit and show minimum weighted cost, exit and sequence | pure Dijkstra engine, all 5 published sample checks |
| Exclude blocked nodes/incidents, corridors and closed exits even as intermediates | engine regressions and exhaustive-path oracle |
| Cost then exit ID then node sequence | ordinal comparison tests, including mixed case and joined-path ambiguity |
| Immediate reroute, specific blocked start and no-route statuses | browser checks, stale highlights removed |
| Reset to all imported initial-state arrays | engine and browser tests, including after saved-progress restoration |
| Principal Bangla/English labels, errors, instructions | bilingual dictionary and browser checks; dataset labels preserved |
| Brief nonflashing transitions and reduced motion | CSS transitions and reduced-motion browser check |
| Frontend only, no secrets or external routing APIs | static ten-file build, local browser import/storage/export |
| Source, README metadata, MIT license, baseline and C2-reroute screenshots | repository artifacts and final Git delivery |
| Public HTTPS without login and matching final code | Railway deployment plus public asset SHA-256 comparison |

Bonus features implemented: PNG download, saved progress, keyboard controls and visible focus. Alternative routes and advanced walkthroughs are not implemented.

Identity supplied: Abdullah Alif, student ID 252-15-834, email 252-15-834@diu.edu.bd. The user requested this existing mock/practice repository. Official contest eligibility additionally requires the organizer's registration-based repo name, fresh T+0 code and correct contest timing; this project does not claim that eligibility. Every recorded commit includes its prompt; the final release has at least three commits. The form itself remains for the participant to submit.

Known layout limits: coincident nodes and unusually long dataset labels may overlap. Mobile uses native scrolling within the map; the document itself does not overflow horizontally. The final integration increases the sample map width to 880px for readable 12px labels, and preserves scroll position during rerenders. Imported costs must fit safe integers; file size is limited to 2 MB.
