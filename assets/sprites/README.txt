Sprite placeholders

Each drawable has two variants:
- <id>.svg: vector placeholder used by Vector mode.
- <id>-pixel.svg: blocky pixel-art placeholder used by Pixel mode.

All files are served statically from GitHub Pages in assets/sprites/. Keep the filenames, or update spritePath() in client.js. Replace the artwork inside each file with your own.

Terrain canvases are 128x80 diamonds. Units, resources and buildings use transparent 64x64 canvases.

Terrain IDs: terrain-ocean, terrain-water, terrain-plain, terrain-forest, terrain-mountain, terrain-unknown.
Unit IDs: warrior, rider, archer, defender, swordsman, knight, catapult, mind-bender, giant, cloak, dagger, raft, scout-ship, rammer, bomber, juggernaut.
Resource IDs: fruit, animal, fish, ore, crop, whale, ruins.
Building IDs: city, capital, farm, mine, hut, port, mountain-temple, forest-temple, water-temple, embassy, sawmill, forge, custom-house, road.
