CONTROL CENTER
==============

Everything in the work and play grids on the site comes from here. There's no code to touch: add, rename or
delete files, and the site follows.

  control center/
    work/        the "all work" grid
    play/        the "some play" grid
    (more folders can be added later; each one becomes a section of its own)
    about box/   not a section: what the things in the about box open into (the camera's photos, the iPod's
                 songs, the sketchbook's pages and stickers). See the README inside it.
    chat questions.md   the questions in the hero's WhatsApp chat, and your answers. See the note at its top.


WHAT GOES IN A SECTION
----------------------

A FILE on its own (a picture or a video) is a piece of media. Clicking its tile opens it in the middle of the
screen, over the page, frosted. Videos play with their own controls.

A FOLDER is a case study. Inside it:
  - the write-up, as a Markdown file (any name, e.g. "case study.md"). See "_case study template.md" next to this
    file for how to write one. Start its name with "_" ("_case study.md") while it's a draft: the tile shows
    "case study · soon" and doesn't open.
  - ONE picture or video, sitting right in the folder: the tile's thumbnail.
  - a "media" folder with everything the write-up shows ([IMAGE: name] and [VIDEO: name] in the Markdown).
A FOLDER WITHOUT A .md is a piece of media on a background of its own. Inside it:
  - "bg" (bg.png, bg.jpg, bg.mp4…): the background, a picture or a clip (a clip plays on its own, silent and
    looping). It fills the whole tile, cropped to fit.
  - ONE other picture or video: the media, sitting on the background. Its name sets the tile, as below. On a
    background the media is inset by default (as if Edge-[no]); Edge-[20, 8] sets the margin, Edge-[yes] fills.
  The folder's name only sets the order ("03_empty states"). In the viewer the media opens on its background too.

Clicking a case study's tile opens the write-up in a panel in the middle of the screen. It also has its own page,
/case-studies/<folder name without the number>, for sending to people.

Pictures: png, jpg, jpeg, webp, avif (gif and svg work too). Videos: mp4, webm (mov only plays in Safari).


THE TILE, FROM THE FILE NAME
----------------------------

A tile's logos, heading, subtitle, tag, background, shadow, edge-to-edge and corner radius are written into the NAME of its media
file (for a case study, the name of its thumbnail). Every part is optional, they can come in any order, and they're separated by
semicolons:

  Logo-[Juspay, Visa];Heading-[Designing an Interactive Kiosk];Subtitle-[A demo kiosk for VPF 2026];Tag-[kiosk];Edge-[12, 8];Shadow-[yes];Radius-[16];Bg-[fde7d4].png

  Logo-[…]       logos on the tile's label, from the /logos folder by name (Juspay, Visa, Thomas Cook,
                 Axis Bank, Mobbin…). Several are separated by commas and shown as "Juspay × Visa". A name with no
                 logo file is written out instead.
  Heading-[…]    the title under the logos. (For a case study, left out = the write-up's own title.)
  Subtitle-[…]   shown in the viewer, under the heading (not on the tile).
  Tag-[…]        what kind of thing it is, on the right-hand label, and a filter above the grid
                 ("illustrations · 2"). Several are separated by commas; the label shows the first.
  Edge-[…]       yes (the default): the media fills the tile, edge to edge. no: the media sits inside the tile,
                 with a margin of the background colour all round (10% at the sides, 11% top and bottom).
                 Numbers set that margin, as a % of the tile's width: Edge-[20, 8] is 20% left and right and 8%
                 top and bottom; Edge-[20] changes only the sides. Bigger numbers, smaller media.
  Shadow-[…]     yes: a soft shadow under the media. no (the default): none. It shows on Edge-[no] tiles; a
                 tile that's all media has nowhere for a shadow to fall.
  Radius-[…]     how round the media's corners are, in pixels: Radius-[0] is square, Radius-[24] is very round.
                 Left out = 6 on Edge-[no] tiles. On an edge-to-edge tile the media is the tile, so it rounds
                 the tile's own corners instead (left out = 10, like the rest of the grid).
  Bg-[…]         the tile's background colour (what shows around Edge-[no] media, or behind a picture with
                 see-through parts). A hex colour WITHOUT the # (file names can't hold one): fde7d4, fff,
                 e0f2fe. Colour names work too: lavender, mintcream. Left out = a light grey, f6f6f6.

Edge and Shadow can also be written on their own, meaning yes: "…;Shadow.png". Yes/no also take true/false,
on/off.

PLAY is simpler: a piece there only needs its text, which is the label that comes up on it when it's pointed at
(and its heading when it's opened). No Tag needed:
  Text-[sketched at a cafe in kochi].jpg      or just      sketched at a cafe in kochi.jpg
The older play names still work ("Tags-[Art];Text-Sketched at a cafe in Kochi.jpg"); their Tags are ignored now.
A name with none of the keys is just its heading. A text that's only a number ("Text-13") isn't shown, so that piece
has no label.

Characters a file name can't hold: / and : (use — or – instead). Avoid ; inside a value, it separates the parts.
Keep the whole name under about 250 characters.


ORDER, AND HIDING THINGS
------------------------

Tiles follow the names, A to Z, numbers counted properly (2 before 10). Start a name with a number and an
underscore to place it: "01_kiosk", "02_Logo-[Visa];Heading-[…].mp4". The number isn't shown anywhere.
A section where nothing is numbered (play, at the moment) is shuffled on each visit instead.

Start a file's or folder's name with "_" to keep it off the site without deleting it: "_03_tcil".


THE GRID
--------

Three columns of the same width (two on a tablet, one on a phone), each tile as tall as its media, 8px apart.
Tiles are placed in name order, each into whichever column is shortest so far, so the columns end near level.
A tile shows only its media until it's pointed at; then its labels come up along its foot (on a phone they're
always showing).

