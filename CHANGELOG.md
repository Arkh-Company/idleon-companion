# Changelog

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
