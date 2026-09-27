---
title: {{Case Study Title}}
timeline: {{e.g. 4 weeks}}
contributors: {{e.g. 1 Product Designer(Me), 1 Product Manager, 3 Developers}}
contribution: {{e.g. Research, End-to-end design and delivery}}
---

<!--
HOW THIS FILE WORKS

This is the write-up for the project folder it sits in. While it is named "_case study.md" it is IGNORED —
the tile on the home page shows a "Coming Soon" cursor instead of linking anywhere. Rename it to
"case study.md" (drop the underscore) when it's ready and the tile starts linking to it.

The URL comes from the folder name, not this file: "01_buyer support" -> /case-studies/buyer-support.

FRONTMATTER (between the --- lines at the top)
  title          the page's <h1>, and the browser tab title. The only field that's really required.
  timeline       \ the three stats under the title. A value with commas in it is split onto
  contributors   | separate lines, so "1 Product Designer(Me), 1 Product Manager" shows as two lines.
  contribution   / leave a field out entirely and it just doesn't appear.

SECTIONS
  ## Problem Statement        a section heading. Each one becomes an entry in the left index.
  *Some Overview*             an OPTIONAL eyebrow. Write it on the line UNDER the heading and it gets
                              shown ABOVE it, small and grey, the way the design has it.
  ### Aligning the Team       a sub-heading inside a section — grey, one step quieter.

WRITING
  Plain paragraphs, **bold**, [links](https://example.com), and 1. / - lists all work as usual.

  > A line starting with ">" becomes a callout — the amber box for something worth pulling out.

  [QUOTE: You like to nit pick things, huh?]
                              a big centred aside in blue, for an interjection between sections.

ANNOTATED STATEMENT
  The mad-libs sentence: joining words stay grey, and the parts that carry the meaning go dark, get
  ringed with a hand-drawn loop, and are labelled with an arrow.

  [STATEMENT]
  {Banks and Visa Admins | User | left} are {responsible for handling merchants' issues. | User Role}
  They need {a troubleshooting and support aiding tool | User Need}
  so they can {improve their merchants' experience with quick error resolution. | Goal}
  [/STATEMENT]

  Everything OUTSIDE the braces is the grey joining text. Each line becomes its own line on the page.

  {phrase | label}          ring the phrase, and write "label" beside it on a little arrow
  {phrase | label | green}  pick the pen: purple, blue, orange, green, red, pink, cyan.
                            Leave it out and it cycles purple -> blue -> orange -> green down the sentence.
  {phrase | label | left}   put the label on the LEFT of the phrase instead of the right.
                            Colour and side can be combined: {phrase | label | purple left}
  {phrase}                  ring it with no label at all.

  The loops and arrows come from /media/annotations (circle-1.svg, circle-2.svg..., arrow-1.svg...).
  Each phrase uses the next loop in the folder, so a sentence doesn't look rubber-stamped. They stretch
  to fit whatever the phrase is, so you never need to redraw one when the words change — to restyle them,
  drop new SVGs in that folder. Colour is applied from CSS, so draw them in any colour you like.

MEDIA
  [IMAGE: filename.jpg]                     an image, no caption
  [IMAGE: filename.jpg | A short caption]   an image with a caption
  [VIDEO: filename.mp4 | A short caption]   same, for video

  Files are looked up in this project folder's own media/ subfolder. Subfolders work too, either as
  [IMAGE: name.jpg] or [IMAGE: subfolder/name.jpg]. The extension is optional.

  For two things side by side, use a table — each cell can hold a media tag:

  | Iteration 1 | Iteration 2 |
  | --- | --- |
  | [IMAGE: v1.png] | [IMAGE: v2.png] |

Delete everything in this comment once you've got the hang of it. The sections below are a starting
shape, not a rule — rename them, reorder them, drop the ones that don't apply.
-->

## Product Context
*Some Overview*

{{What is the product, and what does a reader need to know before the problem makes sense?}}

> {{An optional callout — the one sentence you'd want someone to leave with.}}

[IMAGE: {{filename}} | {{caption}}]

## Problem Statement

[STATEMENT]
{Who was struggling | User | left} are {what they are responsible for | User Role}
They need {the thing that was missing | User Need}
so they can {the outcome they were after | Goal}
[/STATEMENT]

## Previous Solution

{{What existed before, and where did it fall down?}}

[IMAGE: {{filename}}]

## Ideation and Brainstorming
*Finally getting to work*

### {{Aligning the Team}}

{{What was proposed, and what constraints shaped it?}}

### {{Wireframing and Validating}}

{{What did you try, and what did testing or feedback change?}}

[IMAGE: {{filename}}]

## Final Product

{{Walk through what shipped.}}

[VIDEO: {{filename}} | {{caption}}]

## Impact

{{Numbers if you have them, the qualitative change if you don't.}}

## Thoughts
*Some Key Moments*

{{What you'd do differently, what you learnt, what you're glad about.}}
