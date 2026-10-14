# Retro Game Hub

The existing EmulatorJS stable CDN powers the hub. Games share one neutral dark theme. The current six GBA games and their save IDs are preserved.

## Add games

Put game files and optional matching `.ico` artwork in the repository root or `games/`. Formats such as `.gba`, `.gb`, `.gbc`, `.nes`, `.sfc`, `.smc`, `.nds`, `.n64`, `.z64` and `.v64` identify their console automatically.

Use a console folder for ambiguous formats, disc images, and ZIP/7z archives:

```text
games/nes/My Game.nes
games/snes/My Game.sfc
games/genesis/My Game.bin
games/psx/My Game.cue
games/psx/My Game (Track 1).bin
games/arcade/mygame.zip
```

Keep every CUE track next to its CUE file, with filenames matching the references in the CUE. The library adds the CUE as one game and loads its tracks together. Missing tracks are reported during generation. Complete disc sets can also be packaged in one ZIP. Arcade games need ROM sets matching the chosen FinalBurn Neo or MAME 2003 Plus core; ZIP files are kept intact for these cores.

Run `node generate-library.cjs`, or push to `main` and let GitHub Actions generate and deploy the library. Repository **Settings → Pages → Source** must be **GitHub Actions**. The Home and Library console filters show consoles for which you have added games.

## Consoles

Nintendo: Game Boy Advance, Game Boy/Color, NES/Famicom, SNES/Super Famicom, Nintendo 64, Nintendo DS and Virtual Boy.

Sega: Genesis/Mega Drive, Master System, Game Gear, 32X, Sega CD and Saturn. Other supported systems: PlayStation, Atari 2600/5200/7800/Jaguar/Lynx, ColecoVision, PC Engine/TurboGrafx-16/CD, PC-FX, Neo Geo Pocket/Color, WonderSwan/Color, 3DO, FinalBurn Neo arcade and MAME 2003 Plus arcade.

Settings contains the full format list and folder names, sourced from the shared `console-support.js` registry. These are the aliases exposed by the site's existing stable CDN. Performance and individual game compatibility depend on the emulator core and device. See the [EmulatorJS core documentation](https://emulatorjs.org/docs4devs/cores/).

PSP requires browser threading and is not enabled on this GitHub Pages setup. The existing stable CDN does not enable 3DS, GameCube, Wii, PlayStation 2 or newer consoles here. Renaming an unsupported game's extension will not make it compatible.

## BIOS files and saves

For consoles that need a BIOS, go to **Settings → Console BIOS Files**, select the console and choose its files. Keep their original filenames, or select a ZIP containing them. The files stay in this browser's separate `retro-console-bios` database and survive switching games or returning Home. They are not uploaded to GitHub. If browser storage is unavailable, imported BIOS files work for the current page session only.

PlayStation, Sega CD, Saturn, 3DO, PC-FX, ColecoVision, Lynx and Atari 5200 show BIOS setup when none is present. PC Engine CD games also require a BIOS; put compressed PC Engine CD games in `games/pcecd/` so the hub can distinguish them from cartridge archives. PC Engine cartridges do not need a BIOS. Other consoles allow optional BIOS files. Arcade sets may require additional BIOS archives.

The original `hashGame()` calculation, GBA core alias, save import/export, fast-forward speeds, keyboard shortcuts, controller settings, and existing browser storage are retained. In-game saves and states from different cores or console versions may not be interchangeable.

## Checks

Run `node --test tests/*.test.cjs` to check console detection, mixed game libraries, BIOS handling, game loading, and existing GBA save identifiers.
