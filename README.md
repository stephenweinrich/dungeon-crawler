# Dungeon Crawler // The Show

A browser dungeon crawler built with vanilla HTML/CSS/JavaScript and a tiny
zero-dependency Node server. Inspired by the *Dungeon Crawler Carl* books — you
play Carl, clawing down through a televised death-dungeon with a foul-tempered
show cat for a partner.

## Features

- **Tile-based dungeon map** with fog of war, doors you force open, mob markers,
  and a hand-authored floor layout (`data/map-level1.json`).
- **Turn-based combat, rendered right in the map panel** — a d20 that tumbles
  and stamps its verdict, chip-draining HP bars, floating damage numbers,
  portrait flinch and screen shake. Every roll is also written out in full in
  the System Log.
  - `FIGHT`, `DEFEND` (brace for the next hit, recover some SP, and set up a
    +50% riposte if the mob whiffs), or use an inventory item — every action
    costs your turn.
- **Princess Donut** heckles from the Chat panel during fights, and now and
  then while you wander.
- **Safe Room** — its own small map of rooms off a central hall: a paid bunk
  that fully restores HP/SP, Carl's footlocker (an item stash so a full bag
  never loses a loot box), Mordecai's Guide Book, and shopkeepers who aren't
  open for business yet.
- **Leveling** — XP, stat points, gold, loot boxes, portrait that climbs with
  you.
- **Save system** — 10 slots backed by real JSON files on disk through a small
  save API.

## Run it

Requires [Node.js](https://nodejs.org) (any recent version). There are no
dependencies to install.

```sh
npm start
# then open http://localhost:3000
```

`npm start` just runs `node server.js`, which serves the static site and the
`/api/saves` endpoints. Set the `PORT` environment variable to use a different
port.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Move |
| `O` | Open an adjacent door · enter the Safe Room from its tile |
| `F` | Fight the mob sharing Carl's tile |
| `U` | Use the selected inventory item · activate the Safe Room feature you're standing on |

During a fight: `F` attack, `D` defend, `U` use the selected item, `F`/`Enter`
to continue after it ends.

## Project layout

```
index.html         markup for every screen (title, character setup, HUD, modals)
css/style.css       all styling
js/main.js          all game logic — one file, no build step
server.js           static file server + /api/saves CRUD (Node http, no deps)
data/
  map-level1.json   floor 1 layout
  saferoom.json     safe-room layout
  mobs.json         bestiary
  items.json        item catalog
  slot-*.json       player saves (git-ignored; written at runtime)
assets/             card art, mob art, icons, portraits (PNG)
```

## Status

Early and changing fast. The dungeon loop, combat, the safe room, saving, and
leveling all work. The Safe Room's Shop / Spell Master / Guild Master are
placeholder tiles for now — the systems behind them aren't built yet.

## Credits

A fan project inspired by **Dungeon Crawler Carl** by Matt Dinniman. Not
affiliated with or endorsed by the author; character and setting references are
used affectionately.
