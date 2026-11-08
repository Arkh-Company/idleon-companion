# Changelog

## [0.3.0](https://github.com/Arkh-Company/idleon-companion/compare/v0.2.0...v0.3.0) (2026-11-08)


### Features

* installer, Steam setup, let the game close and automatic updates ([7a42771](https://github.com/Arkh-Company/idleon-companion/commit/7a42771b2e924f79398d1991fa8f752c87f89dc4))
* **installer:** say so when the uninstall ends ([cd81f77](https://github.com/Arkh-Company/idleon-companion/commit/cd81f772489cf98e41c9f0962ad80f7b47af0297))
* **installer:** undo the Steam setup when uninstalling ([5a6d3fa](https://github.com/Arkh-Company/idleon-companion/commit/5a6d3fa727473e067a0fab3cd4a5b2194b30d863))
* **ipc:** payload check for the bodiless channels of 002 ([7e0a765](https://github.com/Arkh-Company/idleon-companion/commit/7e0a7657aaf225aad11e35134412bd64a109d592))
* **ipc:** steam:state and steam:setup in the main process; steam:progress without replay ([4850149](https://github.com/Arkh-Company/idleon-companion/commit/4850149178831365443a452cf167e65ce4525615))
* **keeper:** reader stop resolves after the engine is let go ([7660130](https://github.com/Arkh-Company/idleon-companion/commit/7660130206a90a92c36c274122997b4fc0d7a6da))
* **keeper:** release the game and reconnect on the link messages ([9fb9bff](https://github.com/Arkh-Company/idleon-companion/commit/9fb9bff0cdaacda64710c2d568b69c9aa51455ec))
* **renderer:** setup screen, shown alone until Steam is set up ([8340444](https://github.com/Arkh-Company/idleon-companion/commit/83404440365fb259fba0a6e7319c4ebefc50a0e3))
* **settings:** leave undoing the Steam setup to the uninstaller ([aef81e4](https://github.com/Arkh-Company/idleon-companion/commit/aef81e411b1d7aaea418fed18a3d610a5d520f4d))
* **shared:** contracts of 002 - IPC names, Steam, setup and update types, release and reconnect ([0d75667](https://github.com/Arkh-Company/idleon-companion/commit/0d75667e9a5c4f1b5e639d0b42787732d9dbce7b))
* **start:** one executable that is the keeper with --keeper and the app without it ([5fd1453](https://github.com/Arkh-Company/idleon-companion/commit/5fd1453e53995ae8a73425137e7357ad7b42e63f))
* **start:** the uninstaller's mode removes the companion from Steam ([60c4d16](https://github.com/Arkh-Company/idleon-companion/commit/60c4d16fd620349f42bd8ea635ec77c86dda532e))
* **steam:** locate Steam, its last account and the game, with the runner and the file reads injected ([b168aa6](https://github.com/Arkh-Company/idleon-companion/commit/b168aa6646daf17e8f625375af8c3a645e18f23c))
* **steam:** remove the companion from the launch option ([703bec5](https://github.com/Arkh-Company/idleon-companion/commit/703bec50490fa17436eb69e6981eeb75c2d4f58b))
* **steam:** setup flow that closes Steam, keeps a copy, adds the part and reopens Steam ([e82f059](https://github.com/Arkh-Company/idleon-companion/commit/e82f0593851bd9c38447fe47e0c99d98737d10c4))
* **steam:** setup records of each account, and the module's entry file ([ba9e330](https://github.com/Arkh-Company/idleon-companion/commit/ba9e330294ca22c062830dde50243926bd306fa1))
* **steam:** VDF reader that splices only the launch option, and the companion's part of it ([a98a8cd](https://github.com/Arkh-Company/idleon-companion/commit/a98a8cde6a3ebddae4a50d52b9a40faf923141fa))
* **ui:** let the game close and reconnect from the status bar and tray ([d9884e5](https://github.com/Arkh-Company/idleon-companion/commit/d9884e5482a95ea9eca5850751223a8dde2097ff))
* **ui:** set up and remove Steam from Settings ([cd571e1](https://github.com/Arkh-Company/idleon-companion/commit/cd571e132888101f3f77684cadca911fac7b04ef))
* **updates:** find and install new versions with the game closed ([4a88fba](https://github.com/Arkh-Company/idleon-companion/commit/4a88fba941f93665de2ae90fbf479a06d266865b))


### Bug Fixes

* **installer:** show the closing box without copying the template's removal ([c34aad5](https://github.com/Arkh-Company/idleon-companion/commit/c34aad56a61da3521350762a61f1ef90a91b0674))
* **installer:** stop before closing anything while the game is open ([ac42166](https://github.com/Arkh-Company/idleon-companion/commit/ac4216683f7e5619f62444c06d8f3cd9324e2f43))
* **installer:** tasklist by full path and no desktop shortcut ([66a8b3d](https://github.com/Arkh-Company/idleon-companion/commit/66a8b3d2a77d0cf899170c8d45f80d27e6ffe404))
* **ipc:** reader:confirm-attach refuses a body ([93b96aa](https://github.com/Arkh-Company/idleon-companion/commit/93b96aabb94c82a194881c3b5c1c9280dc1e2954))
* **steam:** another companion's launch option, and text around an inserted command ([94b4a7b](https://github.com/Arkh-Company/idleon-companion/commit/94b4a7b42975549c73a710af35a6ea2a1767f755))
* **steam:** check the bytes before offering setup, and give the text to paste by hand ([6536bcf](https://github.com/Arkh-Company/idleon-companion/commit/6536bcf157a90393aab28860e7ca290b9ea4b26c))
* **steam:** find the last-used account by timestamp without MostRecent ([ec5b21b](https://github.com/Arkh-Company/idleon-companion/commit/ec5b21b284698e630a35612f6273fd5406e1a430))
* **steam:** reopen Steam when waiting for it to close fails ([bda0acf](https://github.com/Arkh-Company/idleon-companion/commit/bda0acf376ddd9e6344914b66394d1daae6a954b))
* **steam:** undo takes out the companion's part also when the user deleted their own text ([9a6a0e5](https://github.com/Arkh-Company/idleon-companion/commit/9a6a0e5c4483f30fb67cad128ce73ac333d24d3b))
* **steam:** vdf that keeps line breaks and tabs escaped, and a timeout on Windows tools ([77bc952](https://github.com/Arkh-Company/idleon-companion/commit/77bc952825216aa08c1ce44766847116cf387f5c))
* **ui:** hide Reconnect once the game updated ([5b2d4c6](https://github.com/Arkh-Company/idleon-companion/commit/5b2d4c661ac12ad3ec2c4de9cabaf5379ab0b905))
* **updates:** settle the install flag before quitting with the game ([7d529ba](https://github.com/Arkh-Company/idleon-companion/commit/7d529bacddea5512418d19cf41edcd54082995f6))
* **window:** remove the default Electron menu bar ([191e979](https://github.com/Arkh-Company/idleon-companion/commit/191e9792dee0e123404f35d5bbd7eb552f412bb9))

## [0.2.0](https://github.com/Arkh-Company/idleon-companion/compare/v0.1.1...v0.2.0) (2026-11-07)


### Features

* **keeper:** check the game code of an unpacked game folder ([4743fd4](https://github.com/Arkh-Company/idleon-companion/commit/4743fd4c3df9ad3dd3dbbd71a44772fdbb68a928))
* **keeper:** keeper process and its build entry ([5d7a7a2](https://github.com/Arkh-Company/idleon-companion/commit/5d7a7a21339152dda5cdfc048409c138d6d7e04f))
* **keeper:** launch the game with the pipe and read it live ([4d4bd28](https://github.com/Arkh-Company/idleon-companion/commit/4d4bd28463f4ba329522739ea66c9cc59fbe3b30))
* **keeper:** update watch and the keeper-app link over a local pipe ([9f303bc](https://github.com/Arkh-Company/idleon-companion/commit/9f303bceac47205d1cc26189c290d5ec7de7fb14))
* **keeper:** warn after ten failed readings, report the pause, release on stop ([ab07ee4](https://github.com/Arkh-Company/idleon-companion/commit/ab07ee4f94b1ad4ddb009682adec881265078f3a))
* live screen map companion for Legends of Idleon (v1) ([576f15d](https://github.com/Arkh-Company/idleon-companion/commit/576f15df914c564995d9af9e1f9878d0c552aa82))
* **main:** app as a link client with tray, single instance, settings and the fixed IPC channels ([85b45b0](https://github.com/Arkh-Company/idleon-companion/commit/85b45b071ddbfa2c8bf532e455ca6f23929c8d41))
* **main:** pure lifecycle decisions and the module registry ([135cb52](https://github.com/Arkh-Company/idleon-companion/commit/135cb52741eb912c7a555b2a7c51b5d33b5a9d0e))
* **main:** settings with defaults key by key ([b7b92e0](https://github.com/Arkh-Company/idleon-companion/commit/b7b92e061734537726a940b0742836e4fd7064a0))
* **main:** shape checks for IPC payloads and link readings, and the navigation lockdown rule ([63d8fcb](https://github.com/Arkh-Company/idleon-companion/commit/63d8fcbe16063c88345ac1a1cec04d78892808a1))
* **main:** the window's X hides it in the tray ([e74a7df](https://github.com/Arkh-Company/idleon-companion/commit/e74a7df48160d5e11c0b4c67edaafc9845d8ed0f))
* **renderer:** screen map window with naming, status bar and settings ([21418bb](https://github.com/Arkh-Company/idleon-companion/commit/21418bb6cd052327b8b556682ee6cc3d41dbf233))


### Bug Fixes

* **keeper:** a failed reading never takes the engine again ([5fe1054](https://github.com/Arkh-Company/idleon-companion/commit/5fe1054607fe37a9333db90da562df454f6785c3))
* **keeper:** an app.asar that cannot be opened fails closed instead of skipping the check ([b1d0849](https://github.com/Arkh-Company/idleon-companion/commit/b1d0849d3cf1111559b704ac07946fea0ab534b4))
* **keeper:** an update with markers stays unrecorded until the user confirms ([18a8a08](https://github.com/Arkh-Company/idleon-companion/commit/18a8a08600173226758c35ece9819e0959bab2f0))
* **keeper:** decode the debugging pipe as a utf8 stream ([757521d](https://github.com/Arkh-Company/idleon-companion/commit/757521d12c29d939e39f999604aa018f01bd00c4))
* **keeper:** every good reading sends the app the time of the last reading ([48534ea](https://github.com/Arkh-Company/idleon-companion/commit/48534eaeee3ca20f058b4feb216540b7ae44b02c))
* **keeper:** every keeper.log line carries the game pid as id ([89da5fc](https://github.com/Arkh-Company/idleon-companion/commit/89da5fc279607372fbab9a03e5bb72fd5a21b924))
* **keeper:** make the data folder first and tell the app when it fails ([228d7b0](https://github.com/Arkh-Company/idleon-companion/commit/228d7b058a82d2f172a8cb5c817fa886da5c1b6a))
* **keeper:** open the game without the debugging pipe when it cannot be checked safely ([f73dfef](https://github.com/Arkh-Company/idleon-companion/commit/f73dfef3ba3bd76ce75e00d7bba80b248715b51b))
* **keeper:** read a missing character or Codex tab as null ([bd30229](https://github.com/Arkh-Company/idleon-companion/commit/bd302293c5bc5d93dc387237df641204aeda7c97))
* **keeper:** read the engine only from a pause at the reader's breakpoint ([319ca90](https://github.com/Arkh-Company/idleon-companion/commit/319ca9073c4cf88b9a0415eaabb37d182fcebc76))
* **keeper:** record clean game code outside the update check ([7c54a42](https://github.com/Arkh-Company/idleon-companion/commit/7c54a423c59a8b376dd0b4b766177e682fc48310))
* **keeper:** stop taking the engine after a game update moved the anchor ([e5fc004](https://github.com/Arkh-Company/idleon-companion/commit/e5fc004fbc7361d8774b3e64c6fc03d9573a1f6f))
* **keeper:** the game never inherits ELECTRON_RUN_AS_NODE; Edge tests are opt-in ([20da00d](https://github.com/Arkh-Company/idleon-companion/commit/20da00dc36242cfe0fa2bb0c650cb73fb88f70d7))
* **main:** a link status is shape-checked before it reaches the window ([8c14260](https://github.com/Arkh-Company/idleon-companion/commit/8c14260be19dc0c4e2728c55964896d8543f173a))
* **main:** keep "Game closed" on a link drop and bound the window reloads ([10bcf19](https://github.com/Arkh-Company/idleon-companion/commit/10bcf191aa026989ff074460d9779baa2e0f2a46))
* **main:** load and save names.json without losing the app or the file ([0d7dc34](https://github.com/Arkh-Company/idleon-companion/commit/0d7dc34179258291f600a255ced0495511437c47))
* **renderer:** never carry a typed name to another number, and say when it fails ([095faeb](https://github.com/Arkh-Company/idleon-companion/commit/095faebfd1daf39712d9e57194c2a6cd70c35982))

## [0.1.1](https://github.com/Arkh-Company/idleon-companion/compare/v0.1.0...v0.1.1) (2026-11-07)


### Bug Fixes

* **ci:** cooldown do github-actions só com o default-days ([2883ba4](https://github.com/Arkh-Company/idleon-companion/commit/2883ba4c93ceb1e5aa96d32cbefbe24dac8fcae4))
* **ci:** cooldown do github-actions só com o default-days ([f288ba4](https://github.com/Arkh-Company/idleon-companion/commit/f288ba41fdc75297aa68dbd825cc9a66516272b3))
