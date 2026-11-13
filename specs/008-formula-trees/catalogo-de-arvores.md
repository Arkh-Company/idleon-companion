> **Anexo da spec 008.** O levantamento das árvores possíveis por sistema, feito em 12/11/2026 sobre a bancada (BASELINE-3.1, 3abbb53), o inventário de stats, os catálogos de tela, o catálogo de telas do app e o índice do N.js. Só nomes de bloco, de sub-caso e de caminho do estado, e contagens; nenhum trecho do código do jogo, nenhuma tabela de dados do jogo. Os caminhos da bancada são da máquina do Vinicius e ficam fora do repositório.

# Árvores possíveis por sistema (entrada do brainstorming da 008)

12/11/2026. Levantamento só de leitura, em cinco frentes, sobre a bancada (BASELINE-3.1, 3abbb53), o inventário de stats (inv-j), os catálogos de tela, o catálogo de telas do app e o índice do N.js (njs-index). Nada foi gravado. O personagem aparece sempre como "Character N".

## Como ler

- **Tipo:**
  - `sistema`: de onde vêm os bônus que o sistema dá (a página da bancada).
  - `stat do sistema`: um número próprio do sistema.
  - `não mostrado`: número que o jogo não mostra, como custo, teto, chance, tempo ou próximo tier.
  - `alimenta`: stats gerais que o sistema alimenta.
- **Estado:**
  - `provada`: gravada e montada na bancada, com conta.
  - `gravada sem conta`: o valor está certo, mas falta o ⓘ.
  - `candidata`: o bloco existe no N.js, mas nunca foi gravado.
  - `precisa do jogo vivo`: depende de um ator do mapa.
  - `sem bloco`: precisaria de conta escrita à mão, e o app não reescreve fórmula.
  - `não é stat`: valor vazio ou constante.
  - `já no app`: um dos 11 números da Stats de hoje.

## Totais (linhas das tabelas; uma linha candidata pode juntar vários sub-casos)

| Frente                                          |    Linhas | Provada | Gravada sem conta |          Candidata | Jogo vivo | Sem bloco | Outros                      |
| ----------------------------------------------- | --------: | ------: | ----------------: | -----------------: | --------: | --------: | --------------------------- |
| 1. Personagem e conta (18 sistemas)             |       137 |      65 |                 6 |                 48 |         5 |        13 | —                           |
| 2. Skills e stats gerais (20 skills + 6 grupos) |       333 |     185 |                 9 | 88 (143 sub-casos) |        18 |         6 | 11 já no app, 16 não é stat |
| 3. Mundos 1 a 3 (27 sistemas)                   |       223 |     101 |                 4 |                 99 |         3 |        16 | —                           |
| 4. Mundos 4 e 5 (11 sistemas)                   |       183 |      77 |                 4 |                 87 |         6 |         9 | —                           |
| 5. Mundos 6, 7 e tardios (29 sistemas)          |       280 |     100 |                 7 |                157 |         8 |         8 | —                           |
| **Total**                                       | **1.156** | **528** |            **30** |            **479** |    **40** |    **52** | 27                          |

## O que sai daqui

1. **A árvore de sistema já está provada em quase todos**, com poucos "?". Stamps tem 1.215 linhas e 1 "?"; Alchemy, 2.265 e 2; Statues, Arcade, Construction, Worship, Post Office e Trapping, 0. Não têm árvore de sistema: Smithing, Obols, Colosseum, Fishing Toolkit, Weekly Boss, Méritos e Gem Shop (estes dois não têm bloco próprio).
2. **"O que o jogo não mostra" é quase todo candidata barata.** Custo do próximo nível, teto, chance e taxa por hora existem como sub-casos no jogo e leem só o estado. Exemplos: `StampCostss`, `PetUpgCostREAL`, `CookingMenuMealCosts`, `BoatUpgCostQty`, `BuildCost`, `SuperbitCost`. Os `Holes`/`Holes2` sozinhos têm 173 sub-casos, e só cerca de 15 viraram árvore. Na bancada, a gravação leva de 5 a 20 s.
3. **Ajustes no plano de Stamps:**
   - o exaltado sai de `Windwalker("StampDoubler",0,0)`;
   - o teto (`StampLevelMAX`) é estado salvo, sem conta;
   - `StampCostss` devolve uma lista (material e quantidade), e a árvore precisa ler o `[1]`.
4. **As 20 skills têm árvores provadas**, menos Worship (`WorshipStuff`, 0 de 7 gravadas) e Fishing Toolkit. Em 8 skills, a EXP não vem do `ExpMulti`: Sailing, Gaming, Farming, Sneaking, Summoning e Research não têm ramo nele, e Construction e Divinity caem num ramo vazio. Cada uma tem a árvore certa em outro bloco (`PlayerConExp`, `DivPerHr_EXP`…).
5. **Tela × árvore não batem em vários pontos:**
   - Rift, Killroy, Equinox, Dungeons, Weekly Boss, Friends, Family e Companions têm árvore, mas não têm tela no app.
   - Obols, Well, Motherlode, Hive e Grotto têm tela, mas só candidatas.
6. **Ganhos baratos:**
   - as receitas de stats de Compass, Tesseract e Grimoire já estão escritas em `systems-b9.cjs`, mas fora das páginas;
   - a Correção A resolve Legend Talents e Zenith;
   - `Ninja("NinjaBonus")` dá nome à maior parte dos 38 "?" do Sneaking.
7. **Dependem do jogo vivo:** kills por hora de combate, comida AFK de combate, a rocha do Spelunking, o tabuleiro do Minehead e o cache `DNSM.DungeonStats`.
8. **A bancada só tem um retrato** (Character 9). Árvores de classe que o retrato não tem valem 0 até o personagem da classe estar ativo.

As cinco frentes seguem, sem edição.

---

# Frente 1: Personagem e conta (árvores possíveis por sistema)

Pesquisa só leitura, 12/11/2026. Bancada: `research\run\formula-006` (BASELINE-3.1). Números de linhas e "?" das páginas de sistema vêm de `systems\pages\index.html`; os das árvores de stat/cobertura vêm das páginas atuais (`arvores\pages.tsv`, a varredura das 296 páginas de `any\pages`), que valem mais que os `results` das coberturas (as páginas foram remontadas depois). Blocos candidatos conferidos no njs-index (`block`, `search_code`, `readers`): todo sub-caso citado como "candidata" existe na lista de sub-casos do bloco.

Retrato: Character 9 (Royal Guardian), cadeia Rage Basics > Warrior > Squire > Divine Knight > Royal Guardian.

Legenda de Estado: `provada` (página/árvore na bancada, com linhas e "?"), `gravada sem conta` (valor certo, sem ⓘ ou folha única), `candidata` (bloco e sub-caso existem no N.js, nunca gravada), `sem bloco` (o número só existe dentro de um evento de tela ou de um laço; o app teria de reescrever a conta), `precisa do jogo vivo` (o bloco existe, mas o estado que ele lê não está no retrato offline: servidor, ator do mapa, outro personagem ativo).

Telas: nomes do campo `name` de `src\shared\screens\rules\*.json` (o que o app já reconhece) e, entre parênteses, o nome do catálogo em `docs\product`.

---

## 1. Talents (inclui Star Talents, Super Talents, formas de buff)

Tela no app: própria. `Talents`, `Talents › <aba de classe>` (hoje só as 5 da cadeia gravada: Rage Basics, Warrior, Squire, Divine Knight, Royal Guardian), `Talents › Specials 1..5` (star talents), `Talents › Assign Attacks`, `Attacks`. Catálogo: "Talentos (menu 2)".

| Árvore (nome de jogador)                                                                                                                                                                                                                                                                                     | Tipo            | Chamada do jogo                                                                                                           | Estado                       | Nota                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Talents (system page)                                                                                                                                                                                                                                                                                        | sistema         | `GetTalentNumber(1,t)` por aba + star + `getbonus2(1,t,-1)` + `GetBuffBonuses` + `Thingies("SuperTalentPTS_LVgiven",0,0)` | provada                      | `talents.html`: 226 membros (22 pulados "_"), 6519 linhas, 299 peças, ⓘ 407/407, "?" 0                                                                                                                                                            |
| Class tab: Rage Basics / Warrior / Squire / Divine Knight / Royal Guardian                                                                                                                                                                                                                                   | sistema         | `GetTalentNumber(1,t)`, t = TalentOrder[15×(classe−1)..+14]                                                               | provada                      | 5 abas dentro de `talents.html`                                                                                                                                                                                                                   |
| Class tab: as outras 22 classes com talentos (Beginner, Journeyman, Maestro, Voidwalker, Barbarian, Blood Berserker, Death Bringer, Calm Basics, Archer, Bowman, Hunter, Siege Breaker, Beast Master, Wind Walker, Savvy Basics, Mage, Wizard, Shaman, Elemental Sorcerer, Bubonic Conjuror, Arcane Cultist) | sistema         | mesma receita, `GetTalentNumber(1,t)`                                                                                     | precisa do jogo vivo         | o bloco lê `SkillLevels` do personagem ativo: offline dá 0 para classe que a Character 9 não tem. Ao vivo, com o personagem da classe, é a mesma receita. As regras de tela também só têm as 5 abas da cadeia gravada (faltam as outras ~22 abas) |
| Infinilyte, Spiritual Monk                                                                                                                                                                                                                                                                                   | sistema         | —                                                                                                                         | sem bloco                    | abas vazias ("_") no jogo                                                                                                                                                                                                                         |
| Star talents                                                                                                                                                                                                                                                                                                 | sistema         | `GetTalentNumber(1,t)`, t = TalentOrder[615..679]                                                                         | provada                      | subsistema de `talents.html`                                                                                                                                                                                                                      |
| Second value of a talent                                                                                                                                                                                                                                                                                     | sistema         | `GetTalentNumber(2,t)`                                                                                                    | provada                      | só os talentos com curva no 2º valor                                                                                                                                                                                                              |
| Best of all characters (54 "works for all players")                                                                                                                                                                                                                                                          | sistema         | `getbonus2(1,t,-1)`                                                                                                       | provada                      | subsistema; exemplos isolados: `h-getbonus2-1-53--1` 27 linhas "?" 0, `h-getbonus2-1-432--1` 99 linhas "?" 0                                                                                                                                      |
| Second value, best of all characters                                                                                                                                                                                                                                                                         | sistema         | `getbonus2(2,t,-1)`                                                                                                       | provada                      | 5 membros                                                                                                                                                                                                                                         |
| Talent value (one talent, own tree)                                                                                                                                                                                                                                                                          | stat do sistema | `GetTalentNumber(1,227)` / `(2,120)`                                                                                      | provada                      | `h-GetTalentNumber-1-227` 82 linhas "?" 0 (C−: filho com o nome do talento); `h-GetTalentNumber-2-120` 71 linhas "?" 0                                                                                                                            |
| Buff forms                                                                                                                                                                                                                                                                                                   | sistema         | `GetBuffBonuses(t, 1                                                                                                      | 2)` (34 pares)               | provada                                                                                                                                                                                                                                           | subsistema; buff inativo dá folha única (`h-GetBuffBonuses-107-1`, 1 linha, nome cru) |
| Super Talent points given                                                                                                                                                                                                                                                                                    | stat do sistema | `Thingies("SuperTalentPTS_LVgiven",0,0)`                                                                                  | provada                      | membro de `talents.html`                                                                                                                                                                                                                          |
| Super Talent points to spend / left / unlocked                                                                                                                                                                                                                                                               | não mostrado    | `Thingies("SuperTalentPTS_totaltospend"                                                                                   | "SuperTalentPTS_lefttospend" | "SuperTalentPTS_unlockedstatus",0,0)`                                                                                                                                                                                                             | candidata                                                                             | 3 sub-casos do Thingies; "aba Super" do catálogo |
| Effective talent level (invested + bonus levels)                                                                                                                                                                                                                                                             | não mostrado    | `RunCodeOfTypeXforThingY("AllTalentLV", t)`                                                                               | candidata                    | já aparece como subárvore dentro de `GetTalentNumber` (os "níveis extras" do 227); como raiz própria nunca gravada                                                                                                                                |
| Talent banned from All-Talent levels                                                                                                                                                                                                                                                                         | não mostrado    | `RunCodeOfTypeXforThingY("TalentBannedforAllLV", t)`                                                                      | candidata                    | Condição 0/1 (lista de banidos é literal do bloco)                                                                                                                                                                                                |
| Talent points total                                                                                                                                                                                                                                                                                          | stat do sistema | `TotalTalentPoints(0)`                                                                                                    | provada                      | `n-TotalTalentPoints-0` 776 linhas "?" 1                                                                                                                                                                                                          |
| Max talent book level                                                                                                                                                                                                                                                                                        | não mostrado    | `WorkbenchStuff("maxBookLv",0,0)`                                                                                         | provada                      | `o-WorkbenchStuff-maxBookLv-0-0` 47 linhas "?" 0 (valor 434)                                                                                                                                                                                      |
| Talent Library time per book                                                                                                                                                                                                                                                                                 | não mostrado    | `WorkbenchStuff("BookReqTime",0,0)`                                                                                       | provada                      | `o-WorkbenchStuff-BookReqTime-0-0` 139 linhas "?" 0                                                                                                                                                                                               |
| Signature talents (counts × value), 14 árvores                                                                                                                                                                                                                                                               | stat do sistema | `TalentCalc(t)`: 31, 57, 59, 110, 125, 209, 305, 430, 470, 485, 493, 643, 644, 656                                        | provada                      | Cobertura I (`i-TalentCalc-*`): 7 a 96 linhas; "?" 0 em 57/59/110/125/209/644; 1 em 31/305/430/470/485/643; 11 no 493; 75 no 656 (contador "Part N" do laço). 7 das 14 dão 0 offline (classe ausente: ao vivo com a classe certa)                 |
| Talent 125 active? (accuracy ≥ 2.25 × AFK target Defence)                                                                                                                                                                                                                                                    | não mostrado    | condição dentro de `TalentCalc(125)` + `PlayerAccTot()`                                                                   | provada (com defeito)        | `PlayerAccTot-0` 801 linhas "?" 2; o galho da condição falta na árvore do 125 (defeito 2 da Cobertura I)                                                                                                                                          |
| Talents já cobertos como subárvore: 146, 616, 620, 645, 650                                                                                                                                                                                                                                                  | alimenta        | `TalentCalc(t)`                                                                                                           | provada                      | dentro de Cooking, Weapon_Power, STR/AGI/WIS/LUK, CritChance, AFKgainrates                                                                                                                                                                        |
| Next point value (delta in damage/drop/AFK per +1)                                                                                                                                                                                                                                                           | não mostrado    | simulação (cópia de `SkillLevels` +1 e regravar a raiz)                                                                   | sem bloco                    | não é uma chamada: exige mexer no estado; fora do "rodar o jogo isolado só lendo"                                                                                                                                                                 |

## 2. Equipment (inclui Obols, Keychains, Gear extras)

Tela no app: própria. `Items › Equipment`, `Items › Equipment › Specials|Tools|Foods`. Catálogo: "Itens / Inventário (menu 1)".

| Árvore                                                                                                                 | Tipo            | Chamada do jogo                                                     | Estado                    | Nota                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equipment bonuses by type                                                                                              | sistema         | `EtcBonuses(k)`, k = chaves de `CM.IDforETCbonus` (43, 44 NOT_USED) | provada                   | `equipment.html`: 106 membros (2 pulados), 1054 linhas, ⓘ 327/332, "?" 2, progresso de laço 80 (Gallery/Nametag/PremHat "earlier ... with the same stat") |
| Drop rate from equipment (one key)                                                                                     | stat do sistema | `EtcBonuses("2")`                                                   | provada                   | `h-EtcBonuses-s2` 184 linhas "?" 1 (galeria + chapéus + capas + obols)                                                                                    |
| Set bonus (one set)                                                                                                    | stat do sistema | `GetSetBonus(set,"Bonus",0,0)`                                      | gravada sem conta         | isolada lê o cache `SetBonusTOTz` sem BUILDER (`h-GetSetBonus-EMPEROR_SET-Bonus-0-0`, 1 linha). Dentro de Armor Smithy, com o `-1` antes, abre            |
| Carry capacity per category                                                                                            | não mostrado    | `MaxCapacity("bOre"                                                 | "bLog"                    | "dFish"                                                                                                                                                   | "dBugs"                                    | "cFood"                                                                        | "dCritters" | "dSouls" | "bCraft")` | provada | `g-MaxCapacity-*` 175 a 198 linhas "?" 0; `n-MaxCapacity-bCraft` 198 linhas |
| All capacity multiplier / base                                                                                         | não mostrado    | `MaxCapacity("AllCapBonuses")`, `MaxCapacity("AllCapBASE")`         | provada                   | 98 linhas "?" 0; AllCapBASE 15 linhas "?" 3 (BundlesReceived)                                                                                             |
| Hard cap 2.05B                                                                                                         | não mostrado    | `MaxCapacity("HardCappy")`                                          | candidata                 | constante (1 linha honesta)                                                                                                                               |
| Other categories: bBar, cOil, bLeaf, dCurrency, dQuest, dStatueStone, dExpOrb, dStone, dFishToolkit, bCraftOtherPlayer | não mostrado    | `MaxCapacity(x)`                                                    | candidata                 | sub-casos existem; bOre/bLog caem nos ramos cOil/bLeaf                                                                                                    |
| Inventory / storage slots, filter slots                                                                                | não mostrado    | `Thingies("ExtraInventory"                                          | "ExtraStorage"            | "Filterslots",0,0)`                                                                                                                                       | candidata                                  | telas `Items › Info › Inventory Slots Owned`, `Storage Slots Owned`, `Storage` |
| Buy / sell price of an item                                                                                            | não mostrado    | `RunCodeOfTypeXforThingY("BuyPrice"                                 | "SellPrice", item)`       | candidata                                                                                                                                                 | tela `Shop`                                |
| Item piece X-ray (each line after multipliers)                                                                         | não mostrado    | só por diferença entre duas gravações                               | sem bloco                 | não há bloco por peça; o EtcBonuses soma por tipo                                                                                                         |
| Mystery stone stat odds                                                                                                | não mostrado    | handler `event_InventoryItem`                                       | sem bloco                 | evento de tela, não bloco                                                                                                                                 |
| Obols: bonuses                                                                                                         | sistema         | `EtcBonuses(k)` (os obols entram aí)                                | provada                   | não há sistema "Obols" próprio (decisão do lote 7: "already covered by CM.IDforETCbonus")                                                                 |
| Obols: reroll cost (coins / fragments)                                                                                 | não mostrado    | `RunCodeOfTypeXforThingY("ObolRerollCostMoney"                      | "ObolRerollCostFrag", x)` | candidata                                                                                                                                                 | tela `Obols › Upgrades`                    |
| Obols: Menagerie obol multi / auto-trash                                                                               | stat do sistema | `MenagerieStuff("ObolMISCmulti"                                     | "ObolAutoTrashRate",0,0)` | provada                                                                                                                                                   | membros da página Menagerie (outra frente) |
| Obols: personal vs family split, upgrade fail chance                                                                   | não mostrado    | `event_ObolUpgrades`                                                | sem bloco                 | a chance de quebra é literal do evento; a separação Personal/Family não tem bloco próprio (não conferido a fundo)                                         |

Telas de Obols reconhecidas: `Obols`, `Obols › Personal|Family|Upgrades|Totals` (catálogo "Obols (menu2 5)"): hoje sem página própria na bancada.

## 3. Golden Food

Tela no app: só do pai (`Items › Equipment › Foods`). Catálogo: dentro de "Itens / Inventário".

| Árvore                                                      | Tipo            | Chamada do jogo                                                                                                                                                                                                                     | Estado  | Nota                                                                                        |
| ----------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Golden food effects                                         | sistema         | `GoldFoodBonuses(s)`, 14 sub-casos (BaseDamage, Defence, SkillExp, BaseAcc, AllStatz, SailAFKz, GamerAFKz, MonsterCash, ClassEXPz, AllAFK, DropRatez, SpelunkEXPz, ShrineEffect, + HealthFoods)                                     | provada | `golden-food.html`: 18 membros, 830 linhas, ⓘ 152/165, "?" 0                                |
| Golden food: coins (one effect)                             | stat do sistema | `GoldFoodBonuses("MonsterCash")`                                                                                                                                                                                                    | provada | `h-GoldFoodBonuses-MonsterCash` 591 linhas "?" 0                                            |
| Golden food multiplier (the shared "x" of all golden foods) | stat do sistema | primeira parte de `GoldFoodBonuses` (set SECRET, família 66, EtcBonuses 8, talento 99, stamp GFood, achievements 37/380/383, bubbles, sigil, meal, star sign, bribe, pristine, voting, getbonus2 209, companions, legend 25, cards) | provada | já é o galho comum de todas as árvores acima; não tem bloco próprio para virar raiz isolada |

## 4. Boost Food (e comida em geral)

Tela no app: só do pai (`Items › Equipment › Foods`).

| Árvore                                  | Tipo            | Chamada do jogo                                                        | Estado                  | Nota                                                                     |
| --------------------------------------- | --------------- | ---------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| Boost food totals                       | sistema         | `TotalFoodBonuses(effect)`                                             | provada                 | `boost-food.html`: 22 membros, 449 linhas, ⓘ 102/113, "?" 0, progresso 2 |
| Food effect multiplier (Boost / Health) | stat do sistema | `FoodBonuses("BoostsEffectBonus")`, `FoodBonuses("HealthEffectBonus")` | provada                 | subsistema da página                                                     |
| Food cooldown (forge/boost/health)      | stat do sistema | `FoodBonuses("HealthCooldownBonus"                                     | "...ForgeCooldownBonus" | "...BoostsCooldownBonus")`                                               | candidata | quase tudo constante 1; o Forge usa bribe 9 |
| Chance food is not consumed             | não mostrado    | `ArbitraryCode("FoodNOTconsume")`                                      | provada                 | `n-ArbitraryCode-FoodNOTconsume` 20 linhas "?" 0                         |
| AFK food time (how long food lasts AFK) | não mostrado    | `AFKfoodsTimeRedux("Fighting")`                                        | provada                 | `AFKfoodsTimeRedux-Fighting` 2388 linhas "?" 19, progresso 3             |
| Best food slot order                    | não mostrado    | otimização                                                             | sem bloco               | busca combinatória, não é chamada                                        |

## 5. Armor Smithy (Set Bonuses)

Tela no app: própria. `Armor-Set Smithy` (catálogo "Set Bonuses (79)").

| Árvore                                | Tipo            | Chamada do jogo                                                     | Estado           | Nota                                                                |
| ------------------------------------- | --------------- | ------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| Set bonuses                           | sistema         | `GetSetBonus(set,"Bonus",0,-1)` (monta cache) e `(set,"Bonus",0,0)` | provada          | `armor-smithy.html`: 58 membros, 77 linhas, ⓘ 12/12, "?" 0          |
| Parts worn / parts required           | stat do sistema | `GetSetBonus(set,"PartsOn"                                          | "PartsReq",0,0)` | provada                                                             | subsistemas; "faltam N peças" = PartsReq − PartsOn (duas folhas provadas, a diferença é do app) |
| Permanent unlock                      | stat do sistema | `GetSetBonus(set,"PermaUnlock",0,0)`                                | provada          | subsistema                                                          |
| Can afford permanent unlock           | não mostrado    | `GetSetBonus(set,"PermaUnlockAfford",0,0)`                          | candidata        | modo existe (lê ServerGemsReceived); nunca gravado                  |
| Which pieces you still miss (by name) | não mostrado    | `CustomMaps.EquipmentSets` × `EquipmentOrder`                       | sem bloco        | o bloco só conta; a lista por nome é leitura de tabela, não fórmula |

## 6. Talent Enhancement

Tela no app: só do pai (`Talents`).

| Árvore                                                 | Tipo            | Chamada do jogo                                  | Estado            | Nota                                                                                                                                                                                           |
| ------------------------------------------------------ | --------------- | ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enhanced talents                                       | sistema         | `TalentEnh(t)` depois de `TalentEnh(-1)`         | gravada sem conta | `talent-enhancement.html`: 10 membros, 13 linhas, ⓘ 0/0, "?" 0 (todas "Bônus cru": o cache `TalENHNC` não tem BUILDER). `h-TalentEnh-42` e `h-read-DNSM.TalENHNC-s42`: 1 linha, o 2º com "?" 1 |
| Enhancement points (talent 49, best of all characters) | stat do sistema | `getbonus2(1,49,-1)`                             | provada           | membro de "Best of all characters" no `talents.html`; é a entrada que decide cada limiar                                                                                                       |
| Next enhancement threshold                             | não mostrado    | limiares 25/50/…/250 literais de `TalentEnh(-1)` | sem bloco         | não há sub-caso que devolva o próximo limiar                                                                                                                                                   |

## 7. Cards (Codex)

Tela no app: própria. `Codex › Cards`, `Codex › Cards › Sets`, `Codex › Cards › Filters`. Catálogo "Codex › Cards (menu 3, aba 3)".

| Árvore                                 | Tipo            | Chamada do jogo                                                                                                                                | Estado            | Nota                                                                  |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Cards (system page)                    | sistema         | `CardBonusREAL(id)`, `CardSetBonuses(0,k)`, `RunCodeOfTypeXforThingY("CardLv",card)`, `RiftStuff("5starCards",0)`, `Spelunk("6starCards",0,0)` | provada           | `cards.html`: 389 membros (39 pulados), 2163 linhas, ⓘ 480/480, "?" 0 |
| Card type bonus (one)                  | stat do sistema | `CardBonusREAL(10)`                                                                                                                            | provada           | `h-CardBonusREAL-10` 30 linhas "?" 0                                  |
| Card set bonus (one)                   | stat do sistema | `CardSetBonuses(0,"3")`                                                                                                                        | provada           | `h-CardSetBonuses-0-s3`: 1 linha, 0/1 honesto (set não equipado)      |
| Card drop chance multiplier            | não mostrado    | `ArbitraryCode("CardChanceMulti")`                                                                                                             | provada           | `g-ArbitraryCode-CardChanceMulti` 42 linhas "?" 1                     |
| Daily card chance of the AFK target    | não mostrado    | `ArbitraryCode("CardChanceDaily")`                                                                                                             | gravada sem conta | `n-ArbitraryCode-CardChanceDaily` 1 linha, ⓘ 0/0                      |
| Cards till next star                   | não mostrado    | `RunCodeOfTypeXforThingY("CardsTillNextLV", card)`                                                                                             | candidata         | sub-caso existe; "Próxima estrela" do catálogo                        |
| Cards collected / unique cards in game | não mostrado    | `Stuff2("CardsCollected",0,0)`, `Stuff2("UniqueCardsInGame",0,0)`                                                                              | candidata         | contagens em laço sobre CardStuff (vai dar "Quantidade")              |
| Cards from the Forge (qty^0.6)         | não mostrado    | `customEvent_QuickTap`                                                                                                                         | sem bloco         | evento                                                                |
| Best hand / preset delta               | não mostrado    | busca                                                                                                                                          | sem bloco         | combinatório                                                          |

## 8. Companions (pai: Prem currency)

Tela no app: nenhuma própria. O pai "Prem currency" corresponde a `Menu › Gem Shop`. Catálogo: "Companions (bônus)" (sem janela) e "Companion Raffle (80)".

| Árvore                                          | Tipo            | Chamada do jogo                                           | Estado               | Nota                                                                                                                                     |
| ----------------------------------------------- | --------------- | --------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Companions (Prem currency page)                 | sistema         | `Companions(i)`, `CompLV2(i)`                             | provada              | `prem-currency.html`: 358 membros, 516 linhas, ⓘ 75/75, "?" 0; folhas "Condição" fechadas: o valor vem do servidor (`DNSM.CompanionBon`) |
| One companion                                   | stat do sistema | `Companions(27)`                                          | provada              | `h-Companions-27` 1 linha, 0/1 honesto                                                                                                   |
| Bonus tokens owned / left, Supernova stocked    | não mostrado    | `Stuff2("PetBonusTokensOwned"                             | "PetBonusTokensLeft" | "SupernovaStocked",0,0)`                                                                                                                 | candidata | lidos pela tela de itens/ofertas                                                               |
| Companion raffle state / winners                | não mostrado    | `getServerVarLoad("Comp_Raffle")`                         | precisa do jogo vivo | variável de servidor, sem bloco                                                                                                          |
| Gem shop purchases (GemItemsPurchased), bundles | alimenta        | lidos inline em dezenas de blocos; `Thingies("Have_bon_f" | "Have_ban_i"         | ...,0,0)`                                                                                                                                | candidata | não há sistema "Gem shop": aparecem como folhas dentro das outras árvores; os `Have_*` são 0/1 |

## 9. Achievements e Tasks (pai: Task board)

Tela no app: própria. `Tasks`, `Tasks › W1..W7`, `Tasks › Unlocks` (catálogo "Tasks (menu2 23)" e "Taskboard e Merits do mundo (23)").

| Árvore                                                     | Tipo            | Chamada do jogo                                                                                                                                                                    | Estado           | Nota                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World 1..7 achievements                                    | sistema         | `AchieveStatus(i)`, i = 70 × mundo + posição                                                                                                                                       | provada          | `task-board.html`: 303 membros (187 pulados FILLER), 851 linhas, ⓘ 267/268, "?" 0                                                                                     |
| One achievement                                            | stat do sistema | `AchieveStatus(120)`                                                                                                                                                               | provada          | `h-AchieveStatus-120` 3 linhas "?" 0                                                                                                                                  |
| Task unlock points curve                                   | não mostrado    | `TaskStuff("UnlockPtsFORMULA", n, "0")`                                                                                                                                            | candidata        | chamado com (1,"0")                                                                                                                                                   |
| Task points required (this / previous tier)                | não mostrado    | `TaskStuff("TaskPointREQ", 0                                                                                                                                                       | 1, "0")`         | candidata                                                                                                                                                             | a tela mostra a barra; o número exato não |
| Merits given per task                                      | não mostrado    | `TaskStuff("MeritsGiven", n, 0)`                                                                                                                                                   | candidata        | 1 + floor(n/5): árvore curta                                                                                                                                          |
| Available unlocks / unlock points owned / recipes unlocked | não mostrado    | `TaskStuff("AvailableUnlocks"                                                                                                                                                      | "UnlockPtsOwned" | "RecipesUnlockedNUM",0,0)`                                                                                                                                            | candidata                                 | contagens em laço sobre `Tasks[3]` |
| Merit bonuses (Merit shop)                                 | sistema         | `Tasks[2][mundo][i]` lido inline em ExpMulti, TotalTalentPoints, WorkbenchStuff, Refinery, Breeding, Labb, Sailing, Farming, Ninja, Summoning, Spelunk, ResearchStuff, Minehead... | sem bloco        | não existe bloco de bônus de mérito; eles aparecem como folha "Pontos investidos" dentro das árvores que os leem. Uma página "Merits" exigiria reescrever cada efeito |
| Boss gem/key chance from merits                            | não mostrado    | `event_Boss0Death` etc.                                                                                                                                                            | sem bloco        | eventos de morte de chefe                                                                                                                                             |

## 10. Vault (Upgrade Vault)

Tela no app: própria. `The Upgrade Vault` (catálogo "Upgrade Vault (72)").

| Árvore                                                      | Tipo            | Chamada do jogo                                                             | Estado    | Nota                                                                                                                                                                 |
| ----------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vault upgrades + Kill totals                                | sistema         | `Summoning("VaultUpgBonus",i,0)`, `Summoning("VaultKillzTotal",i,0)`        | provada   | `vault.html`: 98 membros, 403 linhas, ⓘ 103/108, "?" 3 (`DNSM.VaultKillzDN#`, valor de trabalho do laço de kills). Gravação isolada `system-vault`: 496 linhas "?" 8 |
| One vault upgrade                                           | stat do sistema | `Summoning("VaultUpgBonus",32,0)`                                           | provada   | `Summoning-VaultUpgBonus-32-0` 3 linhas "?" 0                                                                                                                        |
| Upgrade cost (with Vault 13, companion 99, Sushi discounts) | não mostrado    | `Summoning("VaultUpgCost", i, 0)`                                           | candidata | a tela usa `(0,0)`                                                                                                                                                   |
| Real max level (Research, Event shop raise it)              | não mostrado    | `Summoning("VaultUpgMaxLV", i, 0)`, `Summoning("VaultUpgMaxLV_most", i, 0)` | candidata | "Cap rises with" do catálogo                                                                                                                                         |
| Total levels / unlocked                                     | não mostrado    | `Summoning("VaultUpgTotal",0,0)`, `Summoning("VaultUpgUNLOCKED", i, 0)`     | candidata | contagem / Condição                                                                                                                                                  |

## 11. Clickers: Owl (Orion), Kangaroo (Poppy), Bubba

Tela no app: própria para cada um. `Orion` (Owl), `Poppy` (Kangaroo), `Bubba`. Catálogo: "Owl e Roo (W1/W2)", "Bubba (menu2 94)". O pai "Clickers" não tem tela.

| Árvore                                                    | Tipo         | Chamada do jogo                                                   | Estado                                          | Nota                                                                                      |
| --------------------------------------------------------- | ------------ | ----------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Clickers (system page)                                    | sistema      | `Summoning("OwlBonuses"                                           | "OwlMegafeather",i,0)`, `Summoning("RooBonuses" | "RooMegafeather",i,0)`, `Bubbastuff("MegafleshOwned"                                      | "BubbaRoG_Bonuses",i,0)`      | provada                                                  | `clickers.html`: 54 membros, 263 linhas, ⓘ 81/81, "?" 0. Gravação só da Owl: `h-system-owl` 131 linhas "?" 0 |
| Bubba upgrades                                            | sistema      | `Bubbastuff("TotUpgBonus", i, 0)`                                 | candidata                                       | receita existe (b9, grupo B) mas desligada ("loja de produção")                           |
| Orion feather rate                                        | não mostrado | `Summoning2("OwlFeatherRate",0,0)`                                | candidata                                       | usado no AFK e na tela                                                                    |
| Orion upgrade cost / next upgrade requirement             | não mostrado | `Summoning("OwlCost", i, 0)`, `Summoning2("OwlNextUpgReq", i, 0)` | candidata                                       |                                                                                           |
| Orion shiny feather generation                            | não mostrado | `Summoning2("OwlFeatherShinyGen", t, 0)`                          | candidata                                       | t = tempo (o AFK passa 7200): árvore depende do argumento                                 |
| Poppy fish rate / shiny / tar / reset bonus               | não mostrado | `Summoning("RooCatchRate"                                         | "RooCatchRate_S"                                | "RooCatchRate_T"                                                                          | "RooShinyMulti"               | "RooTarOwned",0,0)`, `Summoning("RooRESETbon", 0..4, 0)` | candidata                                                                                                    |                 |
| Poppy upgrade cost / next requirement                     | não mostrado | `Summoning("RooCost", i, 0)`, `Summoning("RooNextUpgReq", i, 0)`  | candidata                                       |                                                                                           |
| Clicker cost reductions (Menagerie)                       | alimenta     | `MenagerieStuff("OrionCheapener"                                  | "PoppyCheapener"                                | "BubbaCheapener"                                                                          | "ClickerCheapenerAoE", i, 0)` | candidata                                                | entram nos custos acima                                                                                      |
| Bubba meat per second                                     | não mostrado | `Bubbastuff("MeatsliceRate",0,0)`                                 | candidata                                       | a raiz de produção mais rica (felicidade, dados, defumador, carisma, arena, sushi, jelly) |
| Bubba happiness bonus / rank / loss                       | não mostrado | `Bubbastuff("HappinessBonus"                                      | "HappinessRank"                                 | "HappinessLoss",0,0)`                                                                     | candidata                     |                                                          |
| Bubba dice / smoker / spare coins multipliers and chances | não mostrado | `Bubbastuff("Dice_Multi"                                          | "Dice_Luck"                                     | "SmokeMeat_Multi"                                                                         | "SmokeMeat_2xChancePCT"       | "SmokeMeat_10xChancePCT"                                 | "SpareCoins_FindChance"                                                                                      | "CharismaBonus" | "DoubleLVchancePCT",0,0)` | candidata |     |
| Bubba upgrade cost                                        | não mostrado | `Bubbastuff("UpgCost", i, 0)`                                     | candidata                                       |                                                                                           |
| Bubba dice result, smoker tier odds over time             | não mostrado | `Dice_Result` (sorteio), `customEvent_Bubbathings`                | sem bloco                                       | sorteio e evento                                                                          |

## 12. Royal Armory (Royal Guardian) e filhos

Tela no app: própria. `Royal Armory`, `Royal Statues`, `Lil Orblet Shop`; mapa com postos: `World Map › Upgrade Outposts`. Catálogo: "Royal Guardian: Estátuas (105)", "Royal Armory e Kingdom (106)", "Orblet Market (107)".

| Árvore                                                                                    | Tipo            | Chamada do jogo                                                 | Estado            | Nota                                                                       |
| ----------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| Royal Armory (system page)                                                                | sistema         | `RoyalG("StatueBon"                                             | "ArmoryUpgBonus"  | "TotalStatz"                                                               | "OutpostROGbon",i,0)`, `Thingies("OrbletMarketBonus",i,0)`, family bonus RG (read) | provada                            | `royal-armory.html` (com "Royal Guardian extra kills"): 106 membros (5 pulados), 581 linhas, ⓘ 121/123, "?" 0, progresso 6 |
| Royal Guardian extra kills                                                                | sistema         | `RoyalG(s,0,0)` (XtraClearKillz, ActiveKillClear...)            | provada           | filho, na mesma página                                                     |
| One armory upgrade                                                                        | stat do sistema | `RoyalG("ArmoryUpgBonus",2,0)`                                  | provada           | `h-RoyalG-ArmoryUpgBonus-2-0` 3 linhas; C− ("Level × Level", nome trocado) |
| Outpost ranks                                                                             | sistema         | `RoyalG("OutpostEXPrank", a, b)`                                | candidata         | receita existe, desligada (extra)                                          |
| Statue upgrade success odds                                                               | não mostrado    | `RoyalG("StatueUpgOdds", t, 0)`                                 | candidata         | catálogo: "1 em 40"                                                        |
| Statue EXP multi / Statue SF bonus / SF cost / SF max level                               | não mostrado    | `RoyalG("StatueEXPmulti"                                        | "SF_bonus"        | "SF_costo"                                                                 | "SF_maxLV", t, 0)`                                                                 | candidata                          |                                                                                                                            |
| Armory upgrade cost / total                                                               | não mostrado    | `RoyalG("ArmoryUpgCost", i, 0)`, `RoyalG("ArmoryUpgTotal",0,0)` | candidata         |                                                                            |
| Parchment drop / double / recycle                                                         | não mostrado    | `RoyalG("ParchmentDrop"                                         | "ParchmentDouble" | "ParchmentRecycle",0,0)`                                                   | candidata                                                                          | lida no MonsterKill (só classe 16) |
| Marble drop, RI chance, Orblet multi-drop                                                 | não mostrado    | `RoyalG("MarbleDrop"                                            | "RI_chance"       | "OrbletMultiDrop",0,0)`                                                    | candidata                                                                          |                                    |
| Rat respawn / Rat damage                                                                  | não mostrado    | `RoyalG("RatResp"                                               | "RatDMG",0,0)`    | candidata                                                                  |                                                                                    |
| Outpost kills required / cost / EXP required / support EXP / bar EXP rate / resource rate | não mostrado    | `RoyalG("OutpostKillsReq"                                       | "OutpostCost"     | "OutpostEXPreq"                                                            | "SupportEXP"                                                                       | "BarExpRate"                       | "OutpostResourceRate", map, i)`                                                                                            | candidata | args = mapa (o app tem `CurrentMap`); OutpostCost vem com (mapa, 0..2) |
| Orblet Market cost                                                                        | não mostrado    | `Thingies("OrbletMarketCost", i, 0)`                            | candidata         |                                                                            |
| Has outpost here                                                                          | não mostrado    | `RoyalG("HasOutpost", map, 0)`                                  | candidata         | 0/1                                                                        |

## 13. Friends

Tela no app: nenhuma (o app reconhece Codex › Quik Ref/Cards/Guild, não a aba de amigos). Catálogo: "Codex › Amigos (menu 3, aba 5)".

| Árvore                                 | Tipo         | Chamada do jogo                                                                                                  | Estado               | Nota                                                                                               |
| -------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| Friends (system page)                  | sistema      | `Thingies("FriendBonusStatz", i, 0)`, `Thingies("FriendBonusXtraMulti",0,0)`, `Thingies("FriendBonusSlots",0,0)` | provada              | `friends.html`: 9 membros, 77 linhas, ⓘ 21/21, "?" 0                                               |
| Bonus of one friend (saturating curve) | não mostrado | `Thingies("FriendBonusQTY", x, y)`                                                                               | precisa do jogo vivo | a tela chama com a linha do amigo (vem de `getCurrentFriendsList`, servidor); offline não há lista |
| Account level (shown on friend card)   | não mostrado | `Thingies("AccountLV",0,0)`                                                                                      | candidata            | também usado pelo Menagerie                                                                        |

## 14. Guild

Tela no app: própria. `Codex › Guild` e sub-telas (Claimboard, Leaderboards...). Catálogo: "Codex › Guilda (menu 3, aba 6)".

| Árvore                                   | Tipo            | Chamada do jogo                                                                           | Estado               | Nota                                                                                                                                                   |
| ---------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guild bonuses                            | sistema         | `GuildBonuses(i)`                                                                         | provada              | `guild.html`: 18 membros, 110 linhas, ⓘ 36/36, "?" 0                                                                                                   |
| One guild bonus                          | stat do sistema | `GuildBonuses(3)`                                                                         | provada              | `h-GuildBonuses-3` 6 linhas "?" 0                                                                                                                      |
| GP spent on a bonus / cost of next level | não mostrado    | `ArbitraryCode5Inputs("PtsSpentOnGuildBonus", GuildBonuses[i][10], [i][11], nível, 0, 0)` | candidata            | não há sub-caso no GuildBonuses; o jogo calcula na tela com o bloco genérico `ArbitraryCode5Inputs`. Chamável com os args da tabela (não é reescrever) |
| Weekly chest timer, member contribution  | não mostrado    | `ShopRestock`, `getGuildMembers`                                                          | precisa do jogo vivo | servidor                                                                                                                                               |

## 15. Family bonuses

Tela no app: nenhuma (`Obols › Family` é dos obols de família, não do bônus de família).

| Árvore                                         | Tipo            | Chamada do jogo                                                                                    | Estado     | Nota                                                                          |
| ---------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Family bonus (best character of each class)    | sistema         | leitura `DNSM.FamBonusQTYs[k]` (18 chaves; + 28, 32, 80 dentro de Grimoire/Royal Armory/Tesseract) | provada    | `family-bonuses.html`: 18 membros, 730 linhas, ⓘ 40/57, "?" 0. 17 ramos sem ⓘ |
| One family bonus (isolated read)               | stat do sistema | `@read DNSM.FamBonusQTYs.80`                                                                       | provada    | `h-read-DNSM.FamBonusQTYs-s80` 4 linhas, raiz sem nome e sem ⓘ (causa D)      |
| Family bonus of a given class at a given level | não mostrado    | `FamilyBonsuesREAL(classId, 0                                                                      | 1, level)` | candidata                                                                     | permite "qual personagem dá o maior bônus" e "quanto daria no nível N" |

## 16. Legend Talents

Tela no app: própria. `Legend Talents` (catálogo "Legend Talents (91)").

| Árvore                       | Tipo         | Chamada do jogo                        | Estado                  | Nota                                                                                                                                                                                                                                  |
| ---------------------------- | ------------ | -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legend Talents (system page) | sistema      | `Thingies("LegendPTS_bonus", i, 0)`    | gravada sem conta       | `legend-talents.html`: 42 membros (8 pulados), 44 linhas, ⓘ 0/0 (todas "Bônus cru": round(nível × valor) sem abrir). `h-Thingies-LegendPTS_bonus-5-0` 1 linha. A Correção A da Cobertura H abre em 3 linhas, mas não está nas páginas |
| Legend points owned / spent  | não mostrado | `Thingies("LegendPTS_owned"            | "LegendPTS_spent",0,0)` | candidata                                                                                                                                                                                                                             | soma de níveis acima de 400 de todos os personagens (lê `PlayerDATABASE`) |
| Legend talent max level      | não mostrado | `Thingies("LegendTalent_MaxLV", i, 0)` | candidata               | "teto móvel"                                                                                                                                                                                                                          |

## 17. Event Shop (conta)

Tela no app: própria. `Event Shop` (catálogo "Event Shop (menu2 67)").

| Árvore                   | Tipo         | Chamada do jogo                              | Estado            | Nota                                                                                                                                         |
| ------------------------ | ------------ | -------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Event Shop (system page) | sistema      | `Summoning("EventShopOwned", i, 0)`          | gravada sem conta | `event-shop.html`: 68 membros, 71 linhas, ⓘ 0/0; 68 Condição 0/1 (honesto: o jogo só lê a compra). `h-Summoning-EventShopOwned-33-0` 1 linha |
| Next free claim          | não mostrado | `Thingies("EventTimeToNextFreeClaimio",0,0)` | candidata         | tempo                                                                                                                                        |

## 18. Personagem: números de combate e conta que esses sistemas alimentam

Tela no app: nenhuma própria (aparecem em `Menu › AFK Info`, `AFK Gains`, `Character select`, `Items`). São as árvores que mostram o efeito dos sistemas acima.

| Árvore                                                                            | Tipo     | Chamada do jogo                                                              | Estado               | Nota                                                       |
| --------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| Total STR / AGI / WIS / LUK                                                       | alimenta | `TotalStats("STR"                                                            | "AGI"                | "WIS"                                                      | "LUK")` | provada                                                   | 1524 / 1311 / 1300 / 1310 linhas; "?" 2 cada |
| Defence / Accuracy / Weapon Power                                                 | alimenta | `TotalStats("Defence"                                                        | "Accuracy"           | "Weapon_Power")`                                           | provada | 1148 ("?" 4) / 679 ("?" 0) / 639 ("?" 4)                  |
| Max HP / Max MP / Accuracy total / Movement speed                                 | alimenta | `PlayerHPmax(0)`, `PlayerMPmax(0)`, `PlayerAccTot(0)`, `PlayerSpeedBonus(0)` | provada              | 1859 / 1391 / 801 / 1441 linhas; "?" 2 cada                |
| Damage (min / max / mastery / boss multipliers)                                   | alimenta | `DamageDealed("Min"                                                          | "Max"                | "Mastery")`, `DamageMultipliers("Boss")`                   | provada | 3506 ("?" 18) / 3571 ("?" 24) / 103 ("?" 0) / 120 ("?" 1) |
| Crit chance / crit damage                                                         | alimenta | `CritChance(0)`, `CritDamage(0)`                                             | provada              | 460 ("?" 1) / 125 ("?" 2)                                  |
| Class EXP multiplier                                                              | alimenta | `ExpMulti(0)`                                                                | provada              | 827 linhas "?" 6                                           |
| % all stats / flat all stats                                                      | alimenta | `ArbitraryCode("AllStatPCT")`, `ArbitraryCode("AllStat")`                    | provada              | 780 ("?" 1) / 6 ("?" 0)                                    |
| Hit chance / attack cooldown / MP per second                                      | alimenta | `ArbitraryCode("HitChancePCT"                                                | "AtkCooldownDEC"     | "PctMPperSec")`                                            | provada | 804 ("?" 3) / 17 / 50                                     |
| Attack wait time by weapon (Bow, Fisticuff, Spear, Wand, AFK) and invulnerability | alimenta | `ActionWaitTime("BOW"                                                        | "FISTICUFF"          | "SPEAR"                                                    | "WAND"  | "AFK"                                                     | "Invuln")`                                   | provada | 127 a 148 linhas, "?" 0 a 1; Invuln 12 |
| Damage a monster deals to you                                                     | alimenta | `MonsterDamage(0)`                                                           | provada              | 1152 linhas "?" 4                                          |
| Attack range                                                                      | alimenta | `PlayerReach(0)`                                                             | gravada sem conta    | 1 linha (valor 70): o Compass/buff não abrem offline       |
| Respawn time                                                                      | alimenta | `AutoRespawnTime(0)`                                                         | provada              | 12 linhas "?" 0                                            |
| Coins from monsters / kills per kill / quest EXP                                  | alimenta | `ArbitraryCode("MonsterCash"                                                 | "KillPerKill"        | "QuestEXP")`                                               | provada | 2380 ("?" 6) / 691 ("?" 6) / 13                           |
| Drop rate                                                                         | alimenta | Drop Rate (`TotalStats("Drop_Rarity")` como raiz própria)                    | provada              | `droprate` 2414 linhas, "?" 3 reais + 14 de progresso      |
| Drop odds                                                                         | alimenta | `DropOdds(0)`                                                                | provada              | 754 linhas "?" 7                                           |
| AFK kills per hour (Fighting)                                                     | alimenta | `HourlyKillRate("Fighting")`                                                 | precisa do jogo vivo | lê `MapMonstersList` (ator do mapa); nunca gravada offline |

## 19. Fronteira com outras frentes (só registro)

- Master Classes (Grimoire, Compass, Tesseract) são "Class" na bancada, como o Royal Armory: páginas `grimoire.html` (220 linhas, "?" 0), `compass.html` (823, "?" 0), `tesseract.html` (383, "?" 0) e os "stats de forma". Ficam com a frente de W6; o multiplicador geral `Summoning("AllMasterclassDropz",0,0)` e as reduções `AllMasterclassCostRedux` / `First3MC_CostRedux` são **candidatas** e não aparecem em nenhuma página.
- Star Signs, Statues, Stamps, Post Office (por personagem ou W1/W2) ficam com a frente de W1/W2.

---

## Totais por estado (linhas das tabelas acima, seções 1 a 18)

| Estado               | Linhas  |
| -------------------- | ------- |
| provada              | 65      |
| gravada sem conta    | 6       |
| candidata            | 48      |
| sem bloco            | 13      |
| precisa do jogo vivo | 5       |
| **total**            | **137** |

Por tipo: sistema 30, stat do sistema 22, não mostrado 66, alimenta 19. Uma linha pode juntar vários sub-casos do mesmo bloco (por exemplo, 8 modos do Bubbastuff), então as 48 linhas candidatas somam bem mais de 48 árvores possíveis. Quase todas as candidatas são `não mostrado` (custo, teto, chance, taxa): quase todo número que "o jogo não mostra" nesta frente já tem um sub-caso pronto no jogo e nunca foi gravado.

## 5 achados mais importantes

1. **Tudo o que dá bônus nesta frente já está provado; o que falta é o "não mostrado".** As 17 páginas de sistema da frente existem, com "?" entre 0 e 3. As 48 linhas candidatas são quase todas custo, teto, chance ou taxa, com sub-caso no jogo: Vault (`VaultUpgCost`, `VaultUpgMaxLV`), Royal Armory (`StatueUpgOdds`, `ArmoryUpgCost`, `Outpost*`), Clickers (`OwlFeatherRate`, `RooCatchRate`, `Bubbastuff MeatsliceRate`), Tasks (`UnlockPtsFORMULA`, `TaskPointREQ`), Cards (`CardsTillNextLV`), Obols (`ObolRerollCost*`), Super/Legend talents. Uma rodada de gravação de 1 linha por candidata cobriria quase todo o "o jogo não mostra" dos catálogos.
2. **Telas sem dono e donos sem tela.** Sem tela no app: Friends (a aba de amigos do Codex não está nas regras), Family bonuses, Companions (só o Gem Shop do pai), e as 22 abas de talento de outras classes (as regras só têm as 5 da cadeia gravada). Com tela e sem página própria na bancada: Obols (4 telas; o bônus está dentro do Equipment), Tasks › Unlocks / Merits.
3. **Caches sem BUILDER viram "gravada sem conta".** Talent Enhancement (`TalENHNC`), Legend Talents (`round(nível × valor)` sem abrir; a Correção A está pronta, mas ainda não nas páginas), Set bonus isolado (`SetBonusTOTz`), CardChanceDaily, PlayerReach. O valor está certo, só falta o ⓘ.
4. **Classe é estado vivo, não falta de bloco.** 7 das 14 árvores `TalentCalc` e todas as abas fora da cadeia gravada dão 0 offline só porque a Character 9 não tem a classe. Ao vivo, com o personagem da classe ativo, a mesma receita serve. O que falta é a regra de tela por aba de classe e a correção dos 3 defeitos de nome/condição (`CalcTalentDN1` com um nome só, a condição do 125, a linha do 110).
5. **Méritos e Gem Shop não têm bloco.** `Tasks[2]` (méritos) e `GemItemsPurchased` são lidos inline em dezenas de blocos. Eles aparecem como folhas certas dentro das árvores de stat, mas uma página "Merits" ou "Gem Shop" de sistema só sairia reescrevendo cada efeito, e isso o app não faz. Bloco promissor do mesmo tipo: o custo da guilda, que existe só como `ArbitraryCode5Inputs("PtsSpentOnGuildBonus", ...)`, chamável com os argumentos da tabela.

---

# Árvores por skill e por stat geral (frente 2: SKILLS E STATS GERAIS)

Pesquisa só leitura, 12/11/2026. Fontes: as 296 páginas de `formula-006\any\pages\` (lidas uma a uma: raiz, linhas, folhas "?"), `any\pages\index.html`, `systems\BASELINE-3.1-READY.txt`, `systems\DECISOES-loop.md`, `any\MAIN-STATS.md`, o inventário J (`STAT-MATRIX.json`, `branches-main.json`, `world.tsv`), a Cobertura H, e o njs-index (`block` de SkillStats, ExpMulti, TalentCalc, ForgeStats, TrappingStuffs, WorshipStuff; `search_code` de ChanceToHarvest, MaxCapacity e dos índices de skill sem ramo).

Como ler:
- **Linhas / "?"**: linhas da árvore gravada / folhas sem tipo de folha. "(+n laço)" = folhas de progresso de laço (total corrente de um laço), contadas à parte como no `index.html`. "—" = sem página.
- **Estado**: `já no app` = um dos 11 de `src\calculator\targets.ts`; `provada` = gravada na bancada e a conta abre (BASELINE-3.1: raiz igual ao valor gravado); `gravada sem conta` = página com 1 ou 2 linhas, ou valor que depende de quem chama (lista, 0); `candidata` = o sub-caso existe no N.js e nunca foi gravado; `precisa do jogo vivo` = lê ator do mapa ou do jogador (gravada com o stub G7 quando tem linhas; no app só com o jogo rodando); `não é stat` = ramo vazio, constante, contador ou estado de tela; `sem bloco` = o jogo não tem ramo para essa chamada (o número mora em outro bloco).
- Nomes de árvore em inglês, de jogador. O índice do `ExpMulti(n)` é o índice do skill no `Lv0`: 0 classe, 1 Mining, 2 Smithing, 3 Choppin, 4 Fishing, 5 Alchemy, 6 Catching, 7 Trapping, 8 Construction, 9 Worship, 10 Cooking, 11 Breeding, 12 Laboratory, 13 Sailing, 14 Divinity, 15 Gaming, 16 Farming, 17 Sneaking, 18 Summoning, 19 Spelunking, 20 Research. O `ExpMulti` só tem ramo para 0-12, 14 e 19 (njs-index: 16 sub-casos, um é o 999 interno).
- Telas: os nomes vêm de `src\shared\screens\rules\*.json`. "Items" é a tela de personagem (stats); "Items › Skills" é a lista de skills (com detalhe para Catching e Research).

## Combate

Tela no app: Items (painel de stats do personagem); Talents para os talentos.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Max damage | `DamageDealed("Max")` | já no app | 3571 / 24 (+18 laço) | damageMax |
| Min damage | `DamageDealed("Min")` | já no app | 3506 / 18 (+20 laço) | damageMin |
| Damage mastery | `DamageDealed("Mastery")` | provada | 103 / 0 | razão Min/Max |
| Damage roll | `DamageDealed("RNG")` | não é stat | — | um golpe sorteado entre Min e Max |
| Strength | `TotalStats("STR")` | já no app | 1524 / 2 (+4 laço) | str |
| Agility | `TotalStats("AGI")` | já no app | 1311 / 2 (+5 laço) | agi |
| Wisdom | `TotalStats("WIS")` | já no app | 1300 / 2 (+4 laço) | wis |
| Luck | `TotalStats("LUK")` | já no app | 1310 / 2 (+5 laço) | luk |
| Defence | `TotalStats("Defence")` | provada | 1148 / 4 (+2 laço) |  |
| Accuracy stat | `TotalStats("Accuracy")` | provada | 679 / 0 (+1 laço) | entrada do PlayerAccTot |
| Weapon Power | `TotalStats("Weapon_Power")` | provada | 639 / 4 (+3 laço) |  |
| Max HP | `PlayerHPmax(0)` | já no app | 1859 / 2 (+5 laço) | hp |
| Max MP | `PlayerMPmax(0)` | já no app | 1391 / 2 (+4 laço) | mp |
| Total accuracy | `PlayerAccTot(0)` | já no app | 801 / 2 (+1 laço) | accuracy |
| Crit chance | `CritChance(0)` | provada | 460 / 1 (+1 laço) |  |
| Crit damage | `CritDamage(0)` | provada | 125 / 2 |  |
| All stats (flat) | `ArbitraryCode("AllStat")` | provada | 6 / 0 | 6 linhas |
| All stats % | `ArbitraryCode("AllStatPCT")` | provada | 780 / 1 |  |
| Hit chance vs AFK target | `ArbitraryCode("HitChancePCT")` | precisa do jogo vivo | 804 / 3 (+1 laço) | gravada com o stub G7 (100); lê o alvo AFK |
| Attack range | `PlayerReach(0)` | precisa do jogo vivo | 1 / 0 | 1 linha: só o caso "sem alvo" (70); o alvo clicado é do jogo vivo |
| Damage taken from monster | `MonsterDamage(0)` | gravada sem conta | 1152 / 4 (+2 laço) | valor 0: o dano-base é posto por quem chama |
| Boss damage multiplier | `DamageMultipliers("Boss")` | gravada sem conta | 120 / 1 (+1 laço) | devolve uma lista, sem total único |
| Talent points per tab | `TotalTalentPoints(0)` | gravada sem conta | 776 / 1 | devolve uma lista (776 linhas) |
| Talent cooldown reduction | `ArbitraryCode("AtkCooldownDEC")` | provada | 17 / 0 |  |
| MP regen % per second | `ArbitraryCode("PctMPperSec")` | provada | 50 / 0 |  |
| Chance food is not consumed | `ArbitraryCode("FoodNOTconsume")` | provada | 20 / 0 | total certo; parte das linhas é "Working value of the game" (Cobertura N: parcial) |
| + levels to all talents | `RunCodeOfTypeXforThingY("AllTalentLV")` | candidata | — | 8 chamadas; também AllTalentLVz (1) |
| Dungeon power | `TotalStats("Dung_Power")` | provada | 15 / 0 | só dungeons |
| Class EXP multiplier | `ExpMulti(0)` | provada | 827 / 6 (+3 laço) |  |
| Quest EXP bonus | `ArbitraryCode("QuestEXP")` | provada | 13 / 0 |  |

## Movimento e tempo

Tela no app: Items (stats); Menu › AFK Info para o tempo de ataque AFK.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Movement speed | `PlayerSpeedBonus(0)` | provada | 1441 / 2 (+5 laço) | PlayerSpeed() é só o invólucro |
| Respawn time | `AutoRespawnTime(0)` | provada | 12 / 0 | 12 linhas |
| Attack wait time, bow | `ActionWaitTime("BOW")` | provada | 127 / 0 |  |
| Attack wait time, spear | `ActionWaitTime("SPEAR")` | provada | 127 / 0 |  |
| Attack wait time, wand | `ActionWaitTime("WAND")` | provada | 148 / 1 |  |
| Attack wait time, fists | `ActionWaitTime("FISTICUFF")` | provada | 127 / 0 |  |
| AFK attack wait time | `ActionWaitTime("AFK")` | provada | 127 / 0 |  |
| Invulnerability after a hit | `ActionWaitTime("Invuln")` | provada | 12 / 0 |  |
| Wait time, skill actions | `ActionWaitTime("Chopping"|"Mining"|"Fishing"|"Catching")` | não é stat | — | 4 ramos constantes (16-17 caracteres) |

## Loot e dinheiro

Tela no app: Items (stats); Codex › Cards para cartas; Death Note para multikill.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Drop Rate | `TotalStats("Drop_Rarity")` | já no app | 2414 / 3 (+14 laço) | dropRate; página própria |
| Per-item drop chance | `DropOdds(0)` | gravada sem conta | 754 / 7 (+3 laço) | valor 0: a chance-base é posta por quem chama |
| Monster coins | `ArbitraryCode("MonsterCash")` | provada | 2380 / 6 (+10 laço) |  |
| Coin drop multiplier | `Stuff2("CoinDropMulti", 0, 0)` | provada | 5 / 0 | 5 linhas |
| Card drop chance multiplier | `ArbitraryCode("CardChanceMulti")` | provada | 42 / 1 |  |
| Daily card chance of the AFK target | `ArbitraryCode("CardChanceDaily")` | gravada sem conta | 1 / 0 | 1 linha (lê um cache) |
| Crystal mob spawn chance | `ArbitraryCode("CrystalSpawn")` | provada | 127 / 0 |  |
| Crystal spawn (capped) | `ArbitraryCode("CrystalEmbiggener")` | provada | 129 / 0 |  |
| Crystal spawn cap | `ArbitraryCode("CrystalSpawnCAP")` | não é stat | — | constante |
| Giant mob spawn chance | `ArbitraryCode("GiantMob")` | provada | 65 / 0 |  |
| Kills per kill (AFK) | `ArbitraryCode("KillPerKill")` | provada | 691 / 6 (+3 laço) | difere em ~1 do KillPerKill de dentro do ActiveKillPerKill (DECISOES, Cobertura N) |
| Kills per kill (active) | `Stuff2("ActiveKillPerKill", 0, 0)` | provada | 701 / 6 (+3 laço) |  |
| Multikill per overkill tier | `WorkbenchStuff("MultiKillTOTAL", 0, 0)` | provada | 441 / 2 (+3 laço) | MultiKill_base, MultiKill_perTier e OverkillStuffs entram dentro |
| Overkill tier of the AFK map | `WorkbenchStuff("OverkillQTY", i, 0)` | candidata | — | 11 chamadas; hoje folha "?" (causa F da Cobertura H) |
| Death Note rank | `WorkbenchStuff("DeathNoteRank", i, 0)` | candidata | — | 8 chamadas |
| Quests completed | `ArbitraryCode("TotalQuestsComplete")` | candidata | — | contador (TomeQTY); entra no AllEfficiencies |

## AFK (geral e combate)

Tela no app: AFK Gains (overlay) e Menu › AFK Info.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| AFK gain rate, Fighting | `AFKgainrates("Fighting")` | já no app | 1040 / 1 (+10 laço) | afkGains |
| AFK kills per hour | `HourlyKillRate("Fighting")` | precisa do jogo vivo | 4176 / 94 (+9 laço) | total null de propósito: HP do monstro do mapa (MapMonstersList) só no jogo vivo |
| AFK survivability % | `HourlyKillRate("SurvivabilityPCT")` | precisa do jogo vivo | 2388 / 7 (+7 laço) | gravada com o stub G7 (100) |
| AFK food time reduction, fighting | `AFKfoodsTimeRedux("Fighting")` | precisa do jogo vivo | 2388 / 19 (+3 laço) | total null (usa HourlyKillRate Fighting); cópia em n-AFKfoodsTimeRedux-Fighting |

Já no app: o `AFKgainrates("Fighting")` (1 de 11). Os `AFKgainrates` de cada skill estão na seção do skill (10/10 sub-casos gravados).

## Capacidade (carry cap)

Tela no app: Items › Info › Carry Cap.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Carry cap % (all) | `MaxCapacity("AllCapBonuses")` | provada | 98 / 0 |  |
| Base carry cap | `MaxCapacity("AllCapBASE")` | provada | 15 / 3 |  |
| Carry cap, ores / bars / oil | `MaxCapacity("bOre")` | provada | 193 / 0 | um só ramo para bOre, bBar e cOil (njs-index): bBar e cOil não precisam de árvore própria |
| Carry cap, logs / leaves | `MaxCapacity("bLog")` | provada | 193 / 0 | um só ramo para bLog e bLeaf |
| Carry cap, fish | `MaxCapacity("dFish")` | provada | 193 / 0 |  |
| Carry cap, bugs | `MaxCapacity("dBugs")` | provada | 193 / 0 |  |
| Carry cap, food | `MaxCapacity("cFood")` | provada | 175 / 0 |  |
| Carry cap, critters | `MaxCapacity("dCritters")` | provada | 175 / 0 |  |
| Carry cap, souls | `MaxCapacity("dSouls")` | provada | 175 / 0 |  |
| Carry cap, materials | `MaxCapacity("bCraft")` | provada | 198 / 0 |  |
| Carry cap, materials of another character | `MaxCapacity("bCraftOtherPlayer")` | candidata | — | 1 chamada, ramo de 728 caracteres |
| Hard cap / unlimited slots | `MaxCapacity("HardCappy"|"dCurrency"|"dQuest"|"dStatueStone"|"dExpOrb"|"dStone"|"dFishToolkit"|"d…"|"a")` | não é stat | — | constantes (2,05e9 ou 999999999) |

## Skills em geral

Tela no app: Items › Skills.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| All skill efficiency % | `SkillStats("AllEfficiencies")` | provada | 421 / 3 (+3 laço) |  |
| Base efficiency, all skills | `SkillStats("AllBaseSkillEff")` | provada | 580 / 5 (+3 laço) |  |
| All skill EXP % | `SkillStats("AllSkillxpz")` | provada | 1071 / 3 (+6 laço) | cópia em h-SkillStats-AllSkillxpz |
| All skill EXP multiplier | `SkillStats("AllSkillxpMULTI")` | provada | 16 / 0 |  |
| Town production speed % | `SkillStats("TownProdSpeedPCT")` | provada | 32 / 0 |  |
| Win bonus piece of skill EXP | `ExpMulti(999)` | não é stat | — | peça interna do AllSkillxpz |

## Mining (skill 1)

Tela no app: Items › Skills; World Map (AFK em minério); Menu › AFK Info.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Mining Power | `TotalStats("Mining_Power")` | provada | 290 / 0 (+1 laço) |  |
| Mining efficiency | `SkillStats("MiningEfficiency")` | provada | 2247 / 8 (+9 laço) |  |
| Mining speed | `SkillStats("MiningSpeed")` | provada | 406 / 0 (+1 laço) |  |
| Mining multi-drop chance | `SkillStats("MiningMultiOre")` | provada | 411 / 0 (+1 laço) |  |
| Mining amount per hit | `SkillStats("MiningOreValue")` | provada | 86 / 0 | vale 1 neste save (o alvo AFK não é desse skill); a árvore abre |
| Mining EXP multiplier | `ExpMulti(1)` | provada | 1359 / 3 (+8 laço) |  |
| AFK gain rate, Mining | `AFKgainrates("Mining")` | provada | 1063 / 1 (+11 laço) |  |
| Mining AFK actions per hour | `HourlyKillRate("Mining")` | precisa do jogo vivo | 2632 / 32 (+10 laço) | gravada com o stub G7; lê o ator vivo do jogador |
| Mining max per node | `SkillStats("MiningMaxOre")` | não é stat | — | constante |
| Mining minigame bonus | `SkillStats("MiningMinigame")` | candidata | — |  |
| Mining prowess | `ArbitraryCode("MiningProwess")` | provada | 82 / 0 | entra no MiningOreValue |
| Chance to harvest, mining | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Mining")` | precisa do jogo vivo | 2240 / 8 (+9 laço) | gravada com o stub G7 (1 = 100%) |
| AFK food time reduction, mining | `AFKfoodsTimeRedux("Mining")` | candidata | — | depende de HourlyKillRate Mining |

## Smithing (skill 2)

Tela no app: Anvil › Produce, Anvil › Craft, Forge.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Smithing EXP multiplier | `ExpMulti(2)` | provada | 1119 / 3 (+6 laço) |  |
| Smithing efficiency | `SkillStats("SmithingEfficiency")` | não é stat | 1 / 0 | ramo vazio (27 caracteres): 1 linha |
| Special craft chance | `SkillStats("SmithingSpecCraftPCT")` | provada | 5 / 0 | 0 neste save |
| Anvil production speed | `AnvilProduceStats("ProductionSpeed")` | provada | 1475 / 2 (+5 laço) |  |
| Anvil EXP bonus | `AnvilProduceStats("ProdExpBonus")` | provada | 1121 / 3 (+6 laço) |  |
| Anvil production cap | `AnvilProduceStats("Cap")` | provada | 199 / 0 |  |
| Anvil speed bonus | `AnvilProduceStats("ProdSpdBonus")` | candidata | — | parte do ProductionSpeed |
| Anvil speed from AGI | `AnvilProduceStats("ProdSpdBonusFromAGI")` | candidata | — | parte do ProductionSpeed |
| Forge capacity | `ForgeStats(1)` | provada | 83 / 0 |  |
| Forge speed | `ForgeSpeeed(0)` | provada | 24 / 0 |  |
| Forge upgrade stats 2-5 | `ForgeStats(2|3|4|5)` | candidata | — | 4 sub-casos; ForgeStats(0) só lê FurnaceLevels[0] (não é stat) |

## Choppin (skill 3)

Tela no app: Items › Skills; World Map; Menu › AFK Info.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Choppin Power | `TotalStats("Choppin_Power")` | provada | 129 / 0 (+1 laço) |  |
| Choppin efficiency | `SkillStats("ChoppinEfficiency")` | provada | 1961 / 8 (+9 laço) |  |
| Choppin speed | `SkillStats("ChoppinSpeed")` | provada | 269 / 0 (+1 laço) |  |
| Choppin multi-drop chance | `SkillStats("ChoppinMultiOre")` | provada | 228 / 0 (+1 laço) |  |
| Choppin amount per hit | `SkillStats("ChoppinOreValue")` | provada | 206 / 0 (+1 laço) | vale 1 neste save (o alvo AFK não é desse skill); a árvore abre |
| Choppin EXP multiplier | `ExpMulti(3)` | provada | 132 / 1 |  |
| AFK gain rate, Choppin | `AFKgainrates("Choppin")` | provada | 1041 / 1 (+11 laço) |  |
| Choppin AFK actions per hour | `HourlyKillRate("Choppin")` | precisa do jogo vivo | 2173 / 9 (+10 laço) | gravada com o stub G7; lê o ator vivo do jogador |
| Choppin max per node | `SkillStats("ChoppinMaxOre")` | não é stat | — | constante |
| Choppin minigame bonus | `SkillStats("ChoppinMinigame")` | candidata | — |  |
| Choppin prowess | `ArbitraryCode("ChopProwess")` | provada | 82 / 0 |  |
| Chance to harvest, choppin | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Choppin")` | precisa do jogo vivo | — | nunca gravada; mesmo caminho do Mining (stub G7) |
| AFK food time reduction, choppin | `AFKfoodsTimeRedux("Choppin")` | candidata | — |  |

## Fishing (skill 4)

Tela no app: Items › Skills; Fishing Toolkit; Menu › AFK Info.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Fishing Power | `TotalStats("Fishing_Power")` | provada | 182 / 0 |  |
| Fishing efficiency | `SkillStats("FishingEfficiency")` | provada | 2158 / 8 (+8 laço) |  |
| Fishing speed | `SkillStats("FishingSpeed")` | provada | 132 / 0 |  |
| Fishing multi-drop chance | `SkillStats("FishingMultiOre")` | provada | 236 / 0 |  |
| Fishing amount per hit | `SkillStats("FishingOreValue")` | provada | 215 / 0 | vale 1 neste save (o alvo AFK não é desse skill); a árvore abre |
| Fishing EXP multiplier | `ExpMulti(4)` | provada | 1316 / 3 (+7 laço) |  |
| AFK gain rate, Fishing | `AFKgainrates("Fishing")` | provada | 1076 / 1 (+11 laço) |  |
| Fishing AFK actions per hour | `HourlyKillRate("Fishing")` | precisa do jogo vivo | 169 / 20 | gravada com o stub G7; lê o ator vivo do jogador |
| Fishing max per node | `SkillStats("FishingMaxOre")` | não é stat | — | constante |
| Fishing minigame bonus | `SkillStats("FishingMinigame")` | candidata | — |  |
| Fishing prowess | `ArbitraryCode("FishProwess")` | provada | 82 / 0 |  |
| Chance to harvest, fishing | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Fishing")` | precisa do jogo vivo | — | nunca gravada |
| Toolkit speed / EXP / power | `FishingToolkit("SPEED"|"EXP"|"POW")` | candidata | — | 3 sub-casos; SPEED entra no FishingSpeed |
| Toolkit chance tiers | `FishingToolkit("Pct1".."Pct4")` | candidata | — | 4 sub-casos (EffReq1-3 e D0-D3 são requisitos e tabelas) |
| AFK food time reduction, fishing | `AFKfoodsTimeRedux("Fishing")` | candidata | — |  |

## Alchemy (skill 5)

Tela no app: Alchemy, Alchemy › Brewing, Alchemy › Liquid, Alchemy › Vials.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Alchemy EXP multiplier | `ExpMulti(5)` | provada | 1115 / 4 (+6 laço) |  |
| Brew speed per cauldron | `CauldronStats("ResearchSpeed", 0, 0, 0)` | provada | 155 / 1 |  |
| Liquid per hour | `CauldronStats("LiquidHRrate", 0, 0, 0)` | provada | 177 / 1 |  |
| Liquid cap | `CauldronStats("LiquidCap", 0, 0, 0)` | provada | 292 / 3 |  |
| New bubble chance | `CauldronStats("PctChanceNewBubble", 0, 0, 0)` | provada | 27 / 1 |  |
| Per-cauldron speed bonus | `CauldronStats("SpecificSpdBonuses", 0, 0, 0)` | provada | 52 / 0 |  |
| Alchemy EXP per point brewed | `CauldronStats("ExpPerPtBrewed", 0, 0, 0)` | provada | 1120 / 5 (+6 laço) |  |
| Cauldron level brew bonus | `CauldronStats("CauldronLvsBrewBonus", i, 0, 0)` | candidata | — | 11 chamadas; entra no LiquidHRrate |
| Max cauldron level | `CauldronStats("MaxCauldronQTY", i, 0, 0)` | candidata | — | 17 chamadas |
| Sigil charge speed | `Labb("SigilBonusSpeed", "Blank", 0, 0)` | provada | 150 / 0 | tela Alchemy (sigilos) |
| Alchemy talent value | `TalentCalc(493)` | provada | 17 / 11 | 0 neste personagem; 11 "?" |

## Catching (skill 6)

Tela no app: Items › Skills › Catching; Menu › AFK Info.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Catching Power | `TotalStats("Catching_Power")` | provada | 115 / 0 |  |
| Catching efficiency | `SkillStats("CatchingEfficiency")` | provada | 1900 / 5 (+9 laço) |  |
| Catching speed | `SkillStats("CatchingSpeed")` | provada | 41 / 0 |  |
| Catching multi-drop chance | `SkillStats("CatchingMultiOre")` | provada | 137 / 0 |  |
| Catching amount per hit | `SkillStats("CatchingOreValue")` | provada | 198 / 0 | vale 1 neste save (o alvo AFK não é desse skill); a árvore abre |
| Catching EXP multiplier | `ExpMulti(6)` | provada | 1217 / 3 (+6 laço) |  |
| AFK gain rate, Catching | `AFKgainrates("Catching")` | provada | 1035 / 1 (+11 laço) |  |
| Catching AFK actions per hour | `HourlyKillRate("Catching")` | precisa do jogo vivo | 1946 / 5 (+9 laço) | gravada com o stub G7; lê o ator vivo do jogador |
| Catching max per node | `SkillStats("CatchingMaxOre")` | não é stat | — | constante |
| Catching minigame bonus | `SkillStats("CatchingMinigame")` | candidata | — |  |
| Catching prowess | `ArbitraryCode("CatchProwess")` | provada | 82 / 0 |  |
| Catching nest time | `SkillStats("CatchingNestTime")` | provada | 198 / 0 |  |
| Chance to harvest, catching | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Catching")` | precisa do jogo vivo | — | nunca gravada |
| AFK food time reduction, catching | `AFKfoodsTimeRedux("Catching")` | candidata | — |  |

## Trapping (skill 7)

Tela no app: Trapping, Eagle Eye Trap-O-Vision, Trapper Drone.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Trapping Power | `TotalStats("Trapping_Power")` | provada | 34 / 0 |  |
| Trapping efficiency | `SkillStats("TrappingEfficiency")` | provada | 1540 / 4 (+5 laço) | roteado para skillstats2 |
| Trapping EXP multiplier | `ExpMulti(7)` | provada | 1212 / 3 (+6 laço) |  |
| Critters per trap | `TrappingStuffs("TotalQTY", 0)` | provada | 1878 / 6 (+5 laço) |  |
| Trapping EXP per trap | `TrappingStuffs("TotalEXP", 0)` | provada | 1310 / 4 (+6 laço) |  |
| Shiny critter chance | `TrappingStuffs("TotalRareChance", 0)` | provada | 25 / 1 |  |
| Traps you can place | `TrappingStuffs("NumOfTrapsPlaceable", i)` | candidata | — | 10 chamadas |
| Base critters per trap | `TrappingStuffs("BaseQTY")` | candidata | — | 4 chamadas |
| Trap QTY / EXP / shiny bonus | `TrappingStuffs("TrapQtyBonus"|"TrapEXPBonus"|"TrapRareBonus")` | candidata | — | 3 sub-casos, partes do TotalQTY/EXP/RareChance |
| Collect-all % (critters / EXP) | `TrappingStuffs("CollectAllPCT"|"CollectAllPCTexp")` | candidata | — | 2 sub-casos |
| Trap efficiency bonus | `TrappingStuffs("EfficiencyBonusQTY")` | candidata | — |  |
| Shiny bonus on open | `TrappingStuffs("RareBonusOnOpen"|"RareBonusOnOpenMULTI")` | candidata | — | 2 sub-casos |
| Trapping minigame bonus | `SkillStats("TrappingMinigame")` | candidata | — | skillstats2 |
| Trapping speed / multi / max / value | `SkillStats("TrappingSpeed"|"TrappingMultiOre"|"TrappingMaxOre"|"TrappingOreValue")` | não é stat | — | 4 ramos constantes |

## Construction (skill 8)

Tela no app: Construction, Construction › Build, Construction › Cogs, 3D Printer, Talent Library, Shrines, Refinery.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Construction EXP multiplier | `ExpMulti(8)` | não é stat | 1 / 0 | SkillStats("ConstructionEXPmulti") não tem ramo: 1 linha, valor padrão. A EXP real é o PlayerConExp |
| Construction EXP per hour | `WorkbenchStuff("PlayerConExp", 0, 0)` | provada | 129 / 1 | rótulo de um filho errado: diz build speed de um personagem, mas guarda o termo da potência (DECISOES) |
| Build speed per hour | `WorkbenchStuff("PlayerBuildSpd", 0, 0)` | provada | 249 / 1 |  |
| Printer sample size % | `WorkbenchStuff("SampleSizeBONUS", 0, 0)` | provada | 170 / 0 (+1 laço) | cópia em n- |
| Talent Library: time per book | `WorkbenchStuff("BookReqTime", 0, 0)` | provada | 139 / 0 |  |
| Talent Library: max book level | `WorkbenchStuff("maxBookLv", 0, 0)` | provada | 47 / 0 |  |
| Cog build speed bonus | `WorkbenchStuff("CogBuildSpdBonus", 0, 0)` | provada | 13 / 0 |  |
| Shrine EXP bonus | `WorkbenchStuff("ShrineExpBonus", 0, 0)` | provada | 82 / 0 |  |
| Gilded stamp slots | `WorkbenchStuff("TotalGildedSlots", 0, 0)` | provada | 136 / 0 |  |
| Flag speed | `WorkbenchStuff("FlagSpeed", 0, 0)` | não é stat | 1 / 1 | lê o estado da tela (GenINFO[12][2]): 1 linha |
| Extra build speed / flag rate / Con EXP multi | `WorkbenchStuff("ExtraBuildSPDmulti"|"ExtraFlaggyRatemulti"|"ExtraConEXPmulti")` | candidata | — | 3 sub-casos, partes dos de cima |
| Construction mastery bonus | `WorkbenchStuff("ConstMasteryBonus", i, 0)` | candidata | — | 9 chamadas |
| Printer slots / extra printing | `WorkbenchStuff("PrinterSampleSlots"|"PrinterBigSlots"|"ExtraPrinting"|"AdditionExtraPrinting")` | candidata | — | 4 sub-casos |
| Cog slots / tower slots | `WorkbenchStuff("CogSlots"|"TowerBuildSlots")` | candidata | — | contagens de espaço |
| Talent Library: min book level | `WorkbenchStuff("minBookLv", 0, 0)` | candidata | — |  |
| Prayer max level / extra atom max level | `WorkbenchStuff("PrayerMaxLv"|"ExtraMaxLvAtom")` | candidata | — | 2 sub-casos |
| Refinery cycle time | `Refinery("CycleInitialTime", 0)` | provada | 169 / 0 |  |
| Refinery power per cycle | `Refinery("PowerPerCycle", 0)` | gravada sem conta | 2 / 0 | o argumento é o rank do sal: a -0 dá 0; a -100 dá 796 em 2 linhas |
| Refinery power cap / cap multi / reward % | `Refinery("PowerCAP"|"CapMulti"|"RewardPct")` | candidata | — | 3 sub-casos (CostsMulti e FuelCalc são custo) |

## Worship (skill 9)

Tela no app: Worship Totem, Prayers, Shrines.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Worship Power | `TotalStats("Worship_Power")` | provada | 34 / 0 |  |
| Worship efficiency | `SkillStats("WorshipEfficiency")` | provada | 1484 / 5 (+4 laço) |  |
| Worship charge speed | `SkillStats("WorshipSpeed")` | provada | 59 / 0 |  |
| Worship max charge | `SkillStats("WorshipChargeMax")` | provada | 144 / 0 |  |
| Worship EXP multiplier | `ExpMulti(9)` | provada | 1170 / 3 (+6 laço) |  |
| Souls per wave | `WorshipStuff("SoulRewards", w)` | candidata | — | 8 chamadas |
| Worship EXP per wave | `WorshipStuff("ExpRewards", w)` | candidata | — | 4 chamadas |
| Wave multiplier | `WorshipStuff("WaveMultiplier", w)` | candidata | — |  |
| Totem HP | `WorshipStuff("TotemHPtotal")` | candidata | — |  |
| Tower crit damage | `WorshipStuff("TowerCritDmg", i)` | candidata | — | 8 chamadas |
| Worship efficiency bonus / skull currency | `WorshipStuff("EfficiencyBonusQTY"|"SkullCurrency")` | candidata | — | 2 sub-casos |
| Worship minigame bonus | `SkillStats("WorshipMinigame")` | candidata | — | skillstats2 |
| Worship multi / max / value | `SkillStats("WorshipMultiOre"|"WorshipMaxOre"|"WorshipOreValue")` | não é stat | — | 3 ramos constantes |

## Cooking (skill 10)

Tela no app: Cooking, Dinner Menu.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Cooking efficiency | `SkillStats("CookingEfficiency")` | provada | 1744 / 4 (+7 laço) |  |
| Base ladles per day | `SkillStats("CookingBaseLadlePerDay")` | provada | 1789 / 4 (+7 laço) |  |
| Cooking EXP multiplier | `ExpMulti(10)` | provada | 2350 / 6 (+13 laço) |  |
| AFK gain rate, Cooking | `AFKgainrates("Cooking")` | provada | 1046 / 1 (+11 laço) |  |
| Chance to harvest, cooking | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Cooking")` | precisa do jogo vivo | — | nunca gravada; mostrada no AFK Info |
| Meal cooking speed | `CookingR("CookingSPEED", 0, 0)` | provada | 686 / 20 (+1 laço) |  |
| Recipe (fire) speed | `CookingR("CookingFIRE", 0, 0)` | provada | 346 / 4 (+1 laço) |  |
| Cooking luck | `CookingR("CookingLUCK", 0, 0)` | provada | 7 / 1 |  |
| Meal max level | `CookingR("CookingMealMaxLVlol", 0, 0)` | provada | 14 / 0 |  |
| New recipe odds | `CookingR("CookingNewRecipeOdds", 0, 0)` | gravada sem conta | 3 / 0 | com 0 0 devolve 1 (receita já achada); a chamada real é por receita |
| Meal bonus multiplier | `CookingR("CookingMealBonusMultioo")` | candidata | — | 2 chamadas |
| Ribbon max level | `CookingR("RibbonsMaxLV")` | candidata | — | 6 chamadas |

## Breeding (skill 11)

Tela no app: Breeding, Breeding › Breeding, Breeding › Upgrade.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Breeding EXP multiplier | `ExpMulti(11)` | provada | 385 / 0 |  |
| Time per egg | `Breeding("TotalTimeForEgg", "0", 0, 0)` | provada | 151 / 0 |  |
| Breedability speed | `Breeding("BreedabilitySpdMulti", "0", 0, 0)` | provada | 84 / 1 |  |
| Shiny level speed | `Breeding("ShinySpdMulti", "0", 0, 0)` | provada | 418 / 1 |  |
| Egg capacity | `Breeding("TotalEggCapacity", "0", 0, 0)` | gravada sem conta | 2 / 0 | 2 linhas (15) |
| New pet chance | `Breeding("TotalBreedChance", …)` | candidata | — | 5 chamadas; BaseBreedChance (7) é a parte base |
| Pets per breed | `Breeding("PetQTYonBreed", …)` | candidata | — |  |
| Crystal mob drop multiplier | `Breeding("crystalmob_DropMulti", …)` | candidata | — | 4 chamadas |
| Genetics per trashed pet | `Breeding("GeneticsPerTrashPet", …)` | candidata | — | 4 chamadas |
| Fence / battle slots | `Breeding("FenceYardSlots"|"PetBattleSlots", …)` | candidata | — | contagens de espaço |

## Laboratory (skill 12)

Tela no app: Lab, Lab › Mainframe, Chip Repository.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Laboratory efficiency | `SkillStats("LaboratoryEfficiency")` | provada | 1539 / 4 (+7 laço) |  |
| Laboratory EXP multiplier | `ExpMulti(12)` | provada | 1823 / 6 (+7 laço) | LaboratoryEXPmulti_DispA/B entram dentro |
| AFK gain rate, Laboratory | `AFKgainrates("Laboratory")` | provada | 1000 / 1 (+11 laço) |  |
| Chance to harvest, laboratory | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Laboratory")` | precisa do jogo vivo | — | nunca gravada; mostrada no AFK Info |
| Lab connection range | `Labb("Dist", …)` | candidata | — | 6 chamadas |
| Lab bonus line width | `Labb("BonusLineWidth", …)` | candidata | — | 7 chamadas |

## Sailing (skill 13)

Tela no app: Sailing, Sailing › Map, Sailing › Crew, Captain Recruitment.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Sailing EXP multiplier | `ExpMulti(13)` | sem bloco | — | ExpMulti não tem ramo 13; a EXP é o SailingExpMulti |
| Sailing EXP multiplier | `Sailing("SailingExpMulti", 0, 0)` | provada | 156 / 0 |  |
| Captain EXP multiplier | `Sailing("CaptainEXPmulti", 0, 0)` | provada | 233 / 0 (+1 laço) |  |
| Boat speed | `Sailing("BoatSpeed", 0, 0)` | provada | 374 / 0 (+1 laço) |  |
| Sailing loot multiplier | `Sailing("LootMulti", 0, 0)` | provada | 190 / 0 |  |
| Max chests | `Sailing("MaxChests", 0, 0)` | provada | 11 / 0 |  |
| Minimum travel time | `Sailing("Minimumtraveltime", 0, 0)` | provada | 9 / 0 (+1 laço) |  |
| Artifact find chance | `Sailing("ArtifactChance", …)` | candidata | — | 2 chamadas |
| Rarity chances (Ancient … Verisimilitude) | `Sailing("AncientChances"|"EldritchChances"|"SovereignChances"|"OmnipotentChances"|"TranscendentChances"|"VerisimilitudeChances")` | candidata | — | 6 sub-casos |
| Boat loot value / artifact multi | `Sailing("BoatValue"|"BoatArtiMulti", b, 0)` | candidata | — | 7 e 8 chamadas |
| Captain EXP gain | `Sailing("CaptainEXPgain", …)` | candidata | — |  |
| Rare treasure chance / cloud discover bonus | `Sailing("RareTreasureChance"|"CloudDiscoverBonus")` | candidata | — | 1 chamada cada |

## Divinity (skill 14)

Tela no app: Divinity, Divinity › Offerings, Divinity › Divinity per Character.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Divinity EXP multiplier | `ExpMulti(14)` | não é stat | 1 / 0 | SkillStats("DivinityEXPmulti") não tem ramo: 1 linha, valor padrão; a EXP real é o DivPerHr_EXP |
| Divinity points per hour | `Divinity("DivPTSPerHr", 0, 0)` | provada | 236 / 0 |  |
| Divinity EXP per hour | `Divinity("DivPerHr_EXP", 0, 0)` | provada | 594 / 0 (+1 laço) |  |
| Divinity multiplier | `Divinity("DivMultiTOTAL", 0, 0)` | provada | 99 / 0 |  |
| AFK gain rate, Divinity | `AFKgainrates("Divinity")` | provada | 880 / 1 (+7 laço) | valor 1 neste save |
| Divinity efficiency | `SkillStats("DivinityEfficiency")` | não é stat | — | constante (skillstats2) |
| Chance to harvest, divinity | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Divinity")` | precisa do jogo vivo | — | nunca gravada |
| Divinity multi (per god) / per hour base | `Divinity("DivMulti"|"DivPerHr", …)` | candidata | — | partes do DivMultiTOTAL e do DivPTSPerHr |
| Offering odds | `Divinity("OfferingOdds", …)` | candidata | — | 3 chamadas |
| Blessing max level | `Divinity("BlessingMaxLV", …)` | candidata | — |  |

## Gaming (skill 15)

Tela no app: Gaming, Gaming › Log Book.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Gaming EXP multiplier | `ExpMulti(15)` | sem bloco | — | sem ramo 15; a EXP é o GamingExpPCT |
| Gaming EXP % | `GamingStatType("GamingExpPCT", 0, 0)` | provada | 354 / 0 |  |
| Sprout growth time | `GamingStatType("SproutGrowthTime", 0, 0)` | provada | 62 / 0 |  |
| Sprout capacity | `GamingStatType("SproutCapacity", …)` | candidata | — | 10 chamadas |
| Sprout growth chance | `GamingStatType("SproutGrowthCHANCE"|"SproutGrowthCHANCEperMUT", …)` | candidata | — | 9 + 9 chamadas |
| Sprout value | `GamingStatType("SproutValueTOTAL", …)` | candidata | — | SproutValueBase e SproutValueNonPlantMulti são as partes |
| Sprout max evolution | `GamingStatType("SproutMaxEvo", …)` | candidata | — | 5 chamadas |
| Mutant chance / level-up chance / palette luck | `GamingStatType("NewMutantChanceDEC"|"LVupChance"|"PaletteLuck", …)` | candidata | — | 3 sub-casos |
| Log book multiplier | `GamingStatType("LogGameMulti", …)` | candidata | — |  |

## Farming (skill 16)

Tela no app: Farming, Farming Market.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Farming EXP multiplier | `ExpMulti(16)` | sem bloco | — | sem ramo 16; a EXP é o FarmingEXP |
| Farming EXP | `FarmingStuffs("FarmingEXP", 0, 0)` | provada | 569 / 2 |  |
| Crop growth rate | `FarmingStuffs("GrowthRate", 0, 0)` | provada | 76 / 2 |  |
| Crop evolution chance | `FarmingStuffs("NextCropChance", 99, 99)` | provada | 814 / 2 | parcial: raiz sem linha de fórmula (Cobertura N) |
| Land rank EXP multiplier | `FarmingStuffs("LandRankEXPmulti", 0, 0)` | provada | 185 / 0 |  |
| Beans per trade | `FarmingStuffs("BeanTradeQTY", 0, 0)` | provada | 132 / 73 | 73 "?" em 132 linhas: a pior razão das árvores de skill |
| Overgrowth chance | `FarmingStuffs("NextOGchance", …)` | candidata | — | 6 chamadas |
| Overgrowth multiplier | `FarmingStuffs("OGmulti", …)` | candidata | — | 11 chamadas |
| Crops per harvest | `FarmingStuffs("CropsBonusValue", …)` | candidata | — | 6 chamadas |
| Plot rank gain | `FarmingStuffs("PlotRankGain", …)` | candidata | — | 6 chamadas |
| Sticker odds | `FarmingStuffs("StickerOdds"|"StickerOddsMulti", …)` | candidata | — | 2 sub-casos |

## Sneaking (skill 17)

Tela no app: Sneaking, Jade Emporium.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Sneaking EXP multiplier | `ExpMulti(17)` | sem bloco | — | sem ramo 17; a EXP é o Ninja xp |
| Sneaking EXP | `Ninja("xp", 0, 0)` | provada | 558 / 6 |  |
| Jade coin gain | `Ninja("coin", 0, 0)` | provada | 673 / 8 |  |
| Sneaking action speed | `Ninja("ActionSpd", 0, 0)` | provada | 24 / 1 | nome "Way of Haste" errado (DECISOES) |
| Stealth | `Ninja("Stealth", 0, 0)` | provada | 562 / 12 |  |
| Detection reduction | `Ninja("DetectionDEC", 0, 0)` | provada | 598 / 12 |  |
| Knock-out time | `Ninja("KOtime", 0, 0)` | provada | 24 / 2 |  |
| Item find odds | `Ninja("ItemFindOdds", 0, 1)` | provada | 42 / 4 |  |
| Door max HP / door damage | `Ninja("DoorMaxHP"|"door", …)` | candidata | — | 12 e 2 chamadas |
| Untie speed / glove speed | `Ninja("untie"|"gloveSPD", …)` | candidata | — | 2 sub-casos |

## Summoning (skill 18)

Tela no app: Summoning Upgrades, Summoner's Table.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Summoning EXP multiplier | `ExpMulti(18)` | sem bloco | — | sem ramo 18; a EXP é o SummEXPgain |
| Summoning EXP gain | `Summoning("SummEXPgain", 0, 0)` | provada | 340 / 1 (+1 laço) |  |
| Summoning mana regen | `Summoning("ManaRegen", 0, 0)` | provada | 33 / 3 |  |
| Summoning max mana | `Summoning("MaxMana", 0, 0)` | provada | 5 / 1 | 5 linhas |
| Unit damage | `Summoning("UnitDMG", -1, 0)` | provada | 195 / 5 |  |
| Unit HP | `Summoning("UnitHP", -1, 0)` | provada | 50 / 3 |  |
| Unit speed | `Summoning("UnitSpd", 0, 0)` | provada | 15 / 0 |  |
| Starting mana | `Summoning("ManaStart", …)` | candidata | — | 4 chamadas |
| Unit dodge | `Summoning("UnitDODGE", …)` | candidata | — |  |
| Spike placement damage | `Summoning("SpikePlacementDMG", …)` | candidata | — | 6 chamadas |

## Spelunking (skill 19)

Tela no app: Spelunking, Spelunking › Upgrades, Spelunking › Elixir Belt.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Spelunking EXP multiplier | `ExpMulti(19)` | provada | 1391 / 3 (+6 laço) | via Spelunk("SpelunkingExpMulti") |
| AFK gain rate, Spelunking | `AFKgainrates("Spelunking")` | provada | 1031 / 1 (+11 laço) |  |
| Spelunking power | `Spelunk("POW", 0, 0)` | provada | 480 / 20 | 20 "?" |
| Spelunking efficiency | `Spelunk("SpelunkingEfficiency", 0, 0)` | provada | 573 / 3 (+3 laço) |  |
| Spelunking speed | `Spelunk("SpelunkingSpeed", 0, 0)` | provada | 65 / 0 |  |
| Spelunking multi-ore | `Spelunk("SpelunkingMultiOre", 0, 0)` | provada | 4 / 0 | 4 linhas |
| Spelunking ore value | `Spelunk("SpelunkingOreValue", 0, 0)` | gravada sem conta | 1 / 0 | 1 linha: vale 1 sem alvo de spelunking |
| Max stamina | `Spelunk("StaminaMax", 0, 0)` | provada | 83 / 0 |  |
| Stamina regen | `Spelunk("StaminaRegenRate", 0, 0)` | provada | 118 / 0 |  |
| Amber gain | `Spelunk("AmberGain", 0, 0)` | provada | 396 / 4 |  |
| Spelunking AFK actions per hour | `HourlyKillRate("Spelunking")` | precisa do jogo vivo | 629 / 3 (+3 laço) | gravada com o stub G7 (266) |
| Chance to harvest, spelunking | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Spelunking")` | precisa do jogo vivo | 577 / 3 (+3 laço) | gravada com o stub G7 (1) |
| Power base / power multi | `Spelunk("POW_base"|"POW_multi", 0, 0)` | candidata | — | partes do POW |
| Bonus damage | `Spelunk("BonusDMG", …)` | candidata | — |  |
| Stamina cost multiplier / overstim fill rate | `Spelunk("StaminaCostMulti"|"OverstimFillRate", …)` | candidata | — | 6 e 1 chamadas |
| Amber daily haul / amber drop chance | `Spelunk("AmberDailyHaul"|"AmberDropChance"|"AmberDropChance2nd", …)` | candidata | — | 3 sub-casos |
| Shadow strike / nova blast / escape rope chance | `Spelunk("ShadowStrikeChance"|"NovaBlastHitChance"|"EscapeRopeChance", …)` | candidata | — | 3 sub-casos |
| Exalted / prisma drop chance | `Spelunk("ExaltDropChance"|"PrismaDropChance", …)` | candidata | — | 2 sub-casos (Misc, GoldPiece, w7item, blingbag: mais 4) |
| Spelunking AFK % of all | `Spelunk("SpelunkingAFKgains_PCTofALL", …)` | candidata | — |  |

## Research (skill 20)

Tela no app: Items › Skills › Research; Research.

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Research EXP multiplier | `ExpMulti(20)` | sem bloco | — | sem ramo 20; a EXP é o ResearchEXPmulti |
| AFK gain rate, Research | `AFKgainrates("Research")` | provada | 1164 / 1 (+11 laço) |  |
| Research EXP multiplier | `ResearchStuff("ResearchEXPmulti", 0, 0)` | provada | 371 / 0 (+2 laço) |  |
| Research EXP rate | `ResearchStuff("ResearchEXPrateTOT", 0, 0)` | provada | 505 / 2 (+2 laço) |  |
| Research AFK gain rate % | `ResearchStuff("AFKgainsRatePCT", …)` | candidata | — |  |
| Research EXP rate per object | `ResearchStuff("ResearchEXPrateObj", …)` | candidata | — | 2 chamadas |
| Observation insight EXP rate | `ResearchStuff("ObservationInsightExpRate", …)` | candidata | — | 2 chamadas |
| Rolls per day / min roll / max roll | `ResearchStuff("RollsPerDay"|"MinRoll"|"MaxRoll", …)` | candidata | — | 3 sub-casos |
| Kaleidoscope multiplier | `ResearchStuff("Kalei_MultiTot", …)` | candidata | — | Kalei_MultiBase é a parte |

## Talentos (TalentCalc)

Tela no app: Talents (as abas de classe).

| Árvore | Chamada do jogo | Estado | Linhas / "?" | Nota |
|---|---|---|---|---|
| Talent value 31 | `TalentCalc(31)` | provada | 9 / 1 | 0 neste personagem |
| Talent value 57 | `TalentCalc(57)` | provada | 33 / 0 | 0 neste personagem |
| Talent value 59 | `TalentCalc(59)` | provada | 36 / 0 |  |
| Talent value 110 | `TalentCalc(110)` | provada | 11 / 0 | 0 neste personagem |
| Talent value 125 | `TalentCalc(125)` | provada | 9 / 0 | usa PlayerAccTot |
| Talent value 209 | `TalentCalc(209)` | provada | 7 / 0 | 0 neste personagem |
| Talent value 305 | `TalentCalc(305)` | provada | 7 / 1 | 0 neste personagem |
| Talent value 430 | `TalentCalc(430)` | provada | 96 / 1 |  |
| Talent value 470 | `TalentCalc(470)` | provada | 9 / 1 | 0 neste personagem |
| Talent value 485 | `TalentCalc(485)` | provada | 9 / 1 | 0 neste personagem |
| Talent value 643 | `TalentCalc(643)` | provada | 12 / 1 | overkill |
| Talent value 644 | `TalentCalc(644)` | provada | 13 / 0 |  |
| Talent value 656 | `TalentCalc(656)` | provada | 93 / 75 | 75 "?" em 93 linhas |
| Talent values 146, 616, 620, 645, 650 | `TalentCalc(146|616|620|645|650)` | candidata | — | 5 sub-casos; 616 = Weapon Power, 645 = accuracy |
| Talent values -2, -3, -4, -6, -7, -9 | `TalentCalc(-2|-3|-4|-6|-7|-9)` | candidata | — | 6 sub-casos negativos (o -2 e o -9 só medidos no G1 F11) |

## Páginas da bancada fora destas tabelas (71)

Não são stat de skill nem stat geral: membros de sistema de bônus gravados pela Cobertura H (prefixo `h-`, 1 a 591 linhas; os `h-fixA-` são as regravações da correção A), leituras de cache (`read-`, `h-read-`), as páginas de sistema inteiro e os testes de erro. Ficam para as frentes de sistema: `Summoning-VaultUpgBonus-32-0`, `h-AchieveStatus-120`, `h-ArcadeBonus-27`, `h-ArcaneType-ArcaneUpgBonus-3-0`, `h-Breeding-PetArenaBonus-s0-5-0`, `h-Breeding-ShinyBonusS-Nah-3--1`, `h-CardBonusREAL-10`, `h-CardSetBonuses-0-s3`, `h-CauldronStats-VialBonus-4-10-0`, `h-Companions-27`, `h-Divinity-Bonus_Minor--1-2`, `h-EtcBonuses-s2`, `h-FarmingStuffs-ExoticBonusQTY-10-0`, `h-GamingStatType-SuperBitType-5-0`, `h-GetBribeBonus-s3`, `h-GetBuffBonuses-107-1`, `h-GetSetBonus-EMPEROR_SET-Bonus-0-0`, `h-GetTalentNumber-1-227`, `h-GetTalentNumber-2-120`, `h-GoldFoodBonuses-MonsterCash`, `h-GuildBonuses-3`, `h-Holes-MeasurementBonusTOTAL-2-0`, `h-Holes2-Fountain_BonTOT-0-0`, `h-Labb-SigilBonus-Blank-3-0`, `h-MainframeBonus-9`, `h-MealBonus-TotDmg`, `h-MenagerieStuff-BoostQTY-1-0`, `h-Minehead-BonusQTY-3-0`, `h-Ninja-EmporiumBonus-8-0`, `h-ResearchStuff-Grid_Bonus-31-0`, `h-RoyalG-ArmoryUpgBonus-2-0`, `h-Sailing-ArtifactBonus-10-0`, `h-SaltLick-3`, `h-Shrine-2`, `h-Spelunk-BigFishBonuses-2-0`, `h-Spelunk-ShopUpgBonus-7-0`, `h-StampBonusOfTypeX-BaseDmg`, `h-Summoning-EventShopOwned-33-0`, `h-Summoning-WinBonus-5`, `h-Summoning-WinBonus-5-0`, `h-Summoning2-MeritocBonusz-4-0`, `h-SushiStuff-RoG_BonusQTY-2-0`, `h-TalentEnh-42`, `h-Thingies-LegendPTS_bonus-5-0`, `h-Thingies-ZenithMarketBonus-3-0`, `h-TotalStats-NotAStat`, `h-Windwalker-CompassBonus-10-0`, `h-chipBonuses-dr`, `h-fixA-CauldronStats-VialBonus-4-10-0`, `h-fixA-Holes2-Fountain_BonTOT-0-0`, `h-fixA-MenagerieStuff-BoostQTY-1-0`, `h-fixA-Spelunk-ShopUpgBonus-7-0`, `h-fixA-StampBonusOfTypeX-BaseDmg`, `h-fixA-Thingies-LegendPTS_bonus-5-0`, `h-fixA-Thingies-ZenithMarketBonus-3-0`, `h-fixA-Windwalker-CompassBonus-10-0`, `h-fixA-prayersReal-1-0`, `h-getbonus2-1-432--1`, `h-getbonus2-1-53--1`, `h-prayersReal-1-0`, `h-read-DNSM.BoxRewards-DropRate`, `h-read-DNSM.DungeonStats-attackSpd`, `h-read-DNSM.FamBonusQTYs-s80`, `h-read-DNSM.LabMFbonuses-s9`, `h-read-DNSM.SpelunkyUpgTOT-s7`, `h-read-DNSM.StarSigns-Drop`, `h-read-DNSM.TalENHNC-s42`, `h-system-arcade`, `h-system-owl`, `read-DNSM.AlchBubbles-DropRate`, `system-vault`.

## Totais por estado

Uma linha de tabela = uma árvore, menos as candidatas e os "não é stat" agrupados (ex.: `Sailing("AncientChances"|…)`), que juntam vários sub-casos numa linha.

| Estado | Linhas de tabela | Sub-casos |
|---|---|---|
| já no app | 11 | 11 |
| provada | 185 | 185 |
| gravada sem conta | 9 | 9 |
| precisa do jogo vivo | 18 | 18 (12 com página, 6 nunca gravadas) |
| candidata | 88 | 143 |
| não é stat | 16 | 32 |
| sem bloco | 6 | 6 |
| **Total** | **333** | **404** |

Páginas: 296 na bancada = 225 usadas nestas tabelas (221 árvores + 4 cópias: `h-SkillStats-AllSkillxpz`, `n-AFKfoodsTimeRedux-Fighting`, `n-WorkbenchStuff-SampleSizeBONUS-0-0`, `o-Refinery-PowerPerCycle-0`) + 71 que não são stat de skill (lista acima).

"Provada" vem de duas provas: a raiz igual ao valor gravado na regravação do BASELINE-3/3.1 (244 de 248 páginas de cobertura com o mesmo valor; 0 raiz mudada no 3.1) e a auditoria contra o N.js das Coberturas N e O. As parciais da Cobertura N (raiz sem linha de fórmula ou folhas "Working value of the game") ficaram como "provada" com nota, porque o total confere.

## Despachantes: sub-casos no N.js × gravados

| Bloco | Sub-casos no N.js | Gravados (página ou dentro de outra) | Falta / por quê |
|---|---|---|---|
| TotalStats | 16 | 15 | `calcEtcBonuses` é interno |
| SkillStats | 37 (+ o padrão) | 29 (24 diretos + 5 `*EXPmulti` dentro do `ExpMulti`) | 4 `*MaxOre` constantes; 4 `*Minigame` candidatas |
| skillstats2 (via SkillStats) | 24 (+ o padrão) | 14 (7 diretos + 5 `*EXPmulti` + 2 `_Disp` dentro do `ExpMulti`) | 8 constantes; 2 `*Minigame` candidatas |
| ExpMulti | 16 | 15 | 999 é interno; 8 e 14 gravados mas sem ramo (valor padrão); não há ramo para 13, 15, 16, 17, 18, 20 |
| AFKgainrates | 10 | 10 | — |
| HourlyKillRate | 7 | 7 | Fighting sai null offline |
| RunCodeOfTypeXforThingY `ChanceToHarvest` | 8 skills (Mining, Choppin, Fishing, Catching, Cooking, Laboratory, Divinity, Spelunking) | 2 | 6 nunca gravadas (stub G7 já destrava) |
| AFKfoodsTimeRedux | 5 | 1 | Fighting null; 4 de skill candidatas |
| DamageDealed | 4 | 3 | `RNG` é um golpe sorteado |
| ArbitraryCode | 33 (19 são stat) | 18 | `TotalQuestsComplete`; os outros 14 são UI, mapa, chat, estátuas |
| MaxCapacity | 24 (11 ramos com conta) | 10 | `bCraftOtherPlayer`; bBar/cOil e bLeaf dividem ramo com bOre e bLog; 9 constantes |
| ActionWaitTime | 10 | 6 | 4 constantes |
| TalentCalc | 25 | 14 | 146, 616, 620, 645, 650 e os 6 negativos |
| WorkbenchStuff | 41 (25 de stat) | 10 (+ 2 dentro do MultiKillTOTAL) | 15 candidatas (Construction, Printer, Library, Death Note) |
| CauldronStats | 15 (8 de stat) | 6 | 2 |
| CookingR | 17 (7 de stat) | 5 | 2 |
| Breeding | 29 (11 de stat) | 4 | 7 |
| Sailing | 37 (18 de stat) | 6 | 12 |
| Divinity | 15 (7 de stat) | 3 | 4 |
| FarmingStuffs | 43 (11 de stat) | 5 | 6 |
| GamingStatType | 44 (11 de stat) | 2 | 9 |
| Ninja | 28 (11 de stat) | 7 | 4 |
| Summoning | 71 (9 de stat) | 6 | 3 |
| Spelunk | 86 (23 de stat) | 9 (8 + `SpelunkingExpMulti` dentro do ExpMulti 19) | 14 |
| ResearchStuff | 48 (9 de stat) | 2 | 7 |
| TrappingStuffs | 16 (13 de stat) | 3 | 10 |
| WorshipStuff | 16 (7 de stat) | 0 | 7: o único bloco de skill sem nenhuma árvore |
| FishingToolkit | 14 (7 de stat) | 0 | 7 |
| Refinery | 7 (5 de stat) | 2 | 3 |
| AnvilProduceStats | 10 (5 de stat) | 3 | 2 |
| ForgeStats | 6 (5 de stat) | 1 | 4 |
| Labb | 15 (3 de stat) | 1 | 2 |
| Stuff2 | 19 (2 de stat) | 2 | — |

"De stat" = sub-casos que dão um número de skill ou de personagem (taxa, eficiência, EXP, velocidade, tempo, capacidade, chance). Ficam de fora os membros de bônus, custos, contagens, posições de UI e testes de "desbloqueado", que são das frentes de sistema.

## Os 5 achados mais importantes

1. **Toda skill já tem árvore provada; o app mostra só 11 números de combate.** 185 árvores provadas cobrem as 20 skills e os grupos gerais (combate, tempo, loot, carry cap). Um painel por skill já tem pelo menos 2 árvores provadas para cada skill. Exceção: em Worship e no Fishing Toolkit, os blocos próprios (`WorshipStuff`, `FishingToolkit`) não têm nenhuma árvore. Worship só tem os stats de `SkillStats`.
2. **O "EXP multiplier" de 8 skills não vem do `ExpMulti`.** Sailing, Gaming, Farming, Sneaking, Summoning e Research (índices 13, 15-18, 20) não têm ramo. Construction (8) e Divinity (14) caem num `SkillStats` sem ramo e valem 1. A árvore certa é `SailingExpMulti`, `GamingExpPCT`, `FarmingEXP`, `Ninja xp`, `SummEXPgain`, `ResearchEXPmulti`, `PlayerConExp` e `DivPerHr_EXP`. Sem esse mapa, o painel mostraria 1 para Construction e Divinity.
3. **O AFK Info só fecha com o jogo vivo.** O `ChanceToHarvest` tem 8 skills e só Mining e Spelunking foram gravados. As outras 6 são uma gravação cada com o stub G7 que já existe. O `HourlyKillRate("Fighting")` (4.176 linhas, 94 "?") e o `AFKfoodsTimeRedux("Fighting")` saem null offline. No app, que roda ao lado do jogo, são os primeiros a ganhar com o estado vivo.
4. **Algumas árvores dependem do alvo ou de quem chama, e precisam de outro modo de chamar.** Os `*OreValue` do W1 e o `SpelunkingOreValue` valem 1 quando o alvo AFK é de outro skill: o app deve escolher a árvore pelo alvo AFK. `DropOdds` e `MonsterDamage` precisam da chance ou do dano que o chamador põe. `TotalTalentPoints` e `DamageMultipliers("Boss")` devolvem listas. `CookingNewRecipeOdds` com 0 0 dá 1, porque a chamada real é por receita.
5. **Onde a conta ainda é rasa.** `BeanTradeQTY` tem 73 "?" em 132 linhas e `TalentCalc(656)` tem 75 em 93: são as piores razões. `DamageDealed("Max")` tem 24 e `Spelunk POW` tem 20. O `ExpMulti(3)` (Choppin) tem só 132 linhas, contra 1.316 do Fishing. Talvez seja o "shown earlier" do lego, a conferir. Há nomes errados conhecidos: o rótulo de build speed por personagem no PlayerConExp e "Way of Haste" no ActionSpd. As candidatas de maior valor para o jogador são `WorkbenchStuff OverkillQTY`, `TrappingStuffs NumOfTrapsPlaceable`, `WorshipStuff SoulRewards`, `FarmingStuffs OGmulti`, `Breeding TotalBreedChance` e `Sailing ArtifactChance`.

---

# Frente 3: sistemas dos mundos 1 a 3 (12/11/2026)

Pesquisa só de leitura. Fontes: índice das páginas de sistema (`formula-006\systems\pages\index.html`, colunas Linhas e Folhas "?"),
cabeçalho de cada página (`N rows, X of Y branches with ⓘ, Z leaves still "?"`) em `systems\pages` e `any\pages`, receitas de
`systems.cjs` + `systems-b2..b9.cjs`, catálogos de tela (`telas-globais-e-mundos-1-2.md`, `telas-mundos-3-a-5.md`), nomes de tela em
`src\shared\screens\rules\*.json` e o njs-index (`block`, `search_code`) para cada candidata: o bloco e o sub-caso existem no N.js.

Legenda.

- **Tipo:** `sistema` (a árvore do sistema inteiro, uma raiz por membro), `stat do sistema` (um número do próprio sistema que o
  jogo mostra), `não mostrado` (o jogo calcula e não mostra), `alimenta` (stat geral que o sistema alimenta; a árvore já existe e o
  sistema aparece como galho dentro dela).
- **Estado:** `provada` (página montada; dou linhas / "?"), `gravada sem conta` (gravou, mas a árvore não abre a conta: folha única
  ou "?" na raiz), `candidata` (o bloco e o sub-caso existem no N.js, nunca gravada), `sem bloco` (a conta mora num evento, numa
  tabela ou num estado, não num bloco: precisaria de conta à mão, não serve), `precisa do jogo vivo` (o valor só existe com o mapa
  ou a cena aberta).
- "alimenta": conto as árvores gravadas de `any\pages` (sem as `h-`) que citam o bloco do sistema (busca de texto, aproximada) e se
  ele entra no Drop Rate (`any\pages\droprate.html`).
- Chamada: bloco + argumentos como o jogo chama. `t` = aba/índice, `i` = membro, `L` = nível; "0" = argumento sem uso.

---

## Stamps (W1)

Tela no app: própria, `Stamps` (+ `Stamps › Combat`, `› Skills`, `› Misc`).

| Árvore                                         | Tipo            | Chamada do jogo                                                 | Estado    | Nota                                                                                                                                                                            |
| ---------------------------------------------- | --------------- | --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stamps (all bonus types)                       | sistema         | `StampBonusOfTypeX(type)` × 3 abas (`CL.StampBonusIndex[0..2]`) | provada   | 1215 linhas, 1 "?" (acumulador `Stamp_TOTAL_bonus_of_type_X`); 424/427 ⓘ; 2 pulados                                                                                             |
| One stamp type (ex. Base Damage)               | stat do sistema | `StampBonusOfTypeX("BaseDmg")`                                  | provada   | 36 linhas, 0 "?" com a Correção A (`h-fixA-…`); antes 27/1                                                                                                                      |
| Next level cost                                | não mostrado    | `StampCostss(tab, i)`                                           | candidata | devolve uma **lista** `StampCostLIST` (material e quantidade, ou ouro), com Atom 0, Sigil 6 e o desconto de `OptionsListAccount[154]`. Precisa de raiz de lista ou ler o `[1]`  |
| Over-level deficit                             | não mostrado    | `StampOverLevel(tab*1000 + i)`                                  | candidata | coeficiente 3 fixo; desligado por `Ninja("EmporiumBonus",5,0)`; lê `Lv0` do skill do selo. Já é chamado dentro de `StampBonusOfTypeX` (aparece como galho), mas nunca como raiz |
| Gilded stamp chance                            | não mostrado    | `RiftStuff("gildedStampChance", 0)`                             | candidata | 0 antes do Rift 25; sorteado a cada segundo em `Every1sec`                                                                                                                      |
| Exalted stamp multiplier                       | não mostrado    | `Windwalker("StampDoubler", 0, 0)`                              | candidata | `StampBonusOfTypeX` grava `DNSM.StampExalted_double = 1 + StampDoubler/100` para os selos em `Compass[4]`; a árvore certa é a do `StampDoubler` (Atom 12 e outros)              |
| Max level (cap)                                | não mostrado    | estado `StampLevelMAX[tab][i]`                                  | sem bloco | o teto é estado salvo; sobe por evento (`Every1sec`, `_event_STAMPS2`). Dá para mostrar o número, não uma árvore                                                                |
| Stamp feeds (Drop Rate, carry cap, multi-ore…) | alimenta        | `StampBonusOfTypeX(...)`                                        | provada   | citado em 113 árvores gravadas; 14 vezes no Drop Rate                                                                                                                           |

## Bribes (W1, dentro de Stamps)

Tela no app: própria, `Stamps › Bribes`.

| Árvore                     | Tipo            | Chamada do jogo                               | Estado    | Nota                                                    |
| -------------------------- | --------------- | --------------------------------------------- | --------- | ------------------------------------------------------- |
| Bribes                     | sistema         | `GetBribeBonus("i")` (`CL.BribeDescriptions`) | provada   | dentro da página de Stamps (1215 / 1)                   |
| One bribe                  | stat do sistema | `GetBribeBonus("3")`                          | provada   | 4 linhas, 0 "?"                                         |
| Shop buy price after bribe | não mostrado    | `RunCodeOfTypeXforThingY("BuyPrice", item)`   | candidata | 4× o preço de venda × (1 − Bribe 2)                     |
| Bribe cost                 | não mostrado    | tabela `BribeDescriptions`                    | sem bloco | custo fixo de tabela                                    |
| Bribe feeds                | alimenta        | `GetBribeBonus`                               | provada   | 74 árvores; 1 no Drop Rate; `CogSlots`, `ForgeStats(1)` |

## Event Shop (W1)

Tela no app: própria, `Event Shop`.

| Árvore           | Tipo            | Chamada do jogo                                | Estado            | Nota                                                                                                           |
| ---------------- | --------------- | ---------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Event Shop       | sistema         | `Summoning("EventShopOwned", i, 0)`            | provada           | 71 linhas, 0 "?"; 0/0 ⓘ: cada membro é 0/1 (comprado ou não), honesto                                          |
| One item owned   | stat do sistema | `Summoning("EventShopOwned", 33, 0)`           | gravada sem conta | 1 linha; é só a leitura do estado (`OptionsListAccount[311]`)                                                  |
| Next free claim  | não mostrado    | `Thingies("EventTimeToNextFreeClaimio", 0, 0)` | candidata         | tempo; depende do relógio (valor muda a cada segundo)                                                          |
| Event item feeds | alimenta        | `EventShopOwned`                               | provada           | 110 árvores; 4 no Drop Rate (vira multiplicador ou soma, ex. `TotalGildedSlots`, `AtomMaxLv`, `MeatsliceRate`) |

## Statues (W1)

Tela no app: própria, `Statues` (+ `› Deposit`, `› Upgrade`).

| Árvore                   | Tipo         | Chamada do jogo                                             | Estado    | Nota                                                                                               |
| ------------------------ | ------------ | ----------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| Statues                  | sistema      | `ArbitraryCode("StatueBonusGivenNN")`                       | provada   | 617 linhas, 0 "?"; 194/195 ⓘ                                                                       |
| Statue EXP to next level | não mostrado | `ArbitraryCode("StatueExpReqNN")`                           | candidata | sub-caso por prefixo (`e.substring(0,12)`), o índice vai no texto                                  |
| Statue gold cost         | não mostrado | `Tower2Stats("StatueGoldCost", 0, L)`                       | candidata | teto 2,1 bi; só fórmula de L                                                                       |
| Onyx / Zenith owned      | não mostrado | `ArbitraryCode("StatueOnyxOwned")`, `("StatueZenithOwned")` | candidata | DECISOES: fora do sistema (multiplicam o EXP da estátua, não o bônus); valem como árvore de "tier" |
| Statue feeds             | alimenta     | `StatueBonusGiven`                                          | provada   | 59 árvores (dano, crit, EXP, `AnvilProduceStats`); 0 no Drop Rate                                  |

## Star Signs (W1)

Tela no app: própria, `Star Signs` (+ `› Chronus`, `› Hydron`, `› Seraph`).

| Árvore                                     | Tipo            | Chamada do jogo                                            | Estado    | Nota                                                                          |
| ------------------------------------------ | --------------- | ---------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| Star Signs                                 | sistema         | `@read DNSM.StarSigns.<chave>` (construtor `StarSigns(0)`) | provada   | 255 linhas, 0 "?"; só 47/68 ⓘ (21 ramos sem fórmula); 0 peças (forma `@read`) |
| One sign stat (ex. Drop)                   | stat do sistema | `@read DNSM.StarSigns.Drop`                                | provada   | 27 linhas, 0 "?"; raiz sem ⓘ (causa D da Cobertura H)                         |
| Infinite star signs unlocked               | não mostrado    | `RiftStuff("enabledStarSigns", 0)`                         | candidata | 0 antes do Rift 10, depois 5 + `Breeding("ShinyBonusS","Nah",3,-1)`           |
| Conditional signs (Grim Reaper Major etc.) | não mostrado    | dentro de `StarSigns(0)`                                   | provada   | aparecem como Condição na página do sistema                                   |
| Star sign feeds                            | alimenta        | `DNSM.StarSigns`                                           | provada   | 78 árvores; 2 no Drop Rate; `BaseQTY` do Trapping                             |

## Smithing: Anvil e Forge (W1, skill sem bônus de sistema)

Tela no app: própria, `Anvil › Produce`, `Anvil › Craft`, `Forge` (+ `› Furnace 1..4`, `› Upgrades`). Não há árvore de "sistema"
(a skill não dá bônus para outros): só stats.

| Árvore                                        | Tipo         | Chamada do jogo                                | Estado            | Nota                                                        |
| --------------------------------------------- | ------------ | ---------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| Anvil production speed                        | não mostrado | `AnvilProduceStats("ProductionSpeed")`         | provada           | 1475 linhas, 2 "?"                                          |
| Anvil EXP bonus                               | não mostrado | `AnvilProduceStats("ProdExpBonus")`            | provada           | 1121 linhas, 3 "?"                                          |
| Anvil capacity                                | não mostrado | `AnvilProduceStats("Cap")`                     | provada           | 199 linhas, 0 "?" (teto 2e9)                                |
| AGI bonus to production                       | não mostrado | `AnvilProduceStats("ProdSpdBonusFromAGI")`     | candidata         | curva muda de forma acima de 1.000 AGI; já é galho da Speed |
| Production point costs                        | não mostrado | `AnvilProduceStats("Costs1")`, `("Costs2")`    | candidata         |                                                             |
| Forge capacity                                | não mostrado | `ForgeStats(1)`                                | provada           | 83 linhas, 0 "?"                                            |
| Forge speed                                   | não mostrado | `ForgeSpeeed(0)`                               | provada           | 24 linhas, 0 "?"                                            |
| Forge other stats (furnace level, tiers 2..5) | não mostrado | `ForgeStats(0/2/3/4/5)`                        | candidata         | 6 sub-casos numéricos                                       |
| Bars per cycle                                | não mostrado | `ForgeEtcDetails("BarsMade", slot)`            | candidata         | multiplica por `ForgeStats(4)` e por gema 104               |
| Forge card chance bonus                       | não mostrado | `ForgeEtcDetails("CardChanceBONUS", 0)`        | candidata         | `CardChance` é constante por slot                           |
| Smithing special craft %                      | não mostrado | `SkillStats("SmithingSpecCraftPCT")`           | provada           | 5 linhas, 0 "?"                                             |
| Smithing EXP                                  | alimenta     | `ExpMulti(2)`                                  | provada           | 1119 linhas, 3 "?" (o índice 2 é Smithing, não Choppin)     |
| Smithing efficiency                           | não mostrado | `SkillStats("SmithingEfficiency")`             | gravada sem conta | 1 linha: ramo vazio no jogo (stub)                          |
| AFK production until full                     | não mostrado | `AFKcode("AnvilPA")`, `event_AnvilProdCFShold` | sem bloco         | evento                                                      |

## Obols (W1/W2)

Tela no app: própria, `Obols` (+ `› Personal`, `› Family`, `› Upgrades`, `› Totals`).

| Árvore                      | Tipo         | Chamada do jogo                                        | Estado    | Nota                                                                                                |
| --------------------------- | ------------ | ------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------- |
| Obol bonuses (as equipment) | alimenta     | dentro de `EtcBonuses(...)`                            | provada   | Cobertura H #13: `EtcBonuses s:2` (258 linhas, 0 "?") soma os obols; não há sistema próprio de obol |
| Reroll cost (money)         | não mostrado | `RunCodeOfTypeXforThingY("ObolRerollCostMoney", item)` | candidata | arg = nome do item                                                                                  |
| Reroll cost (fragments)     | não mostrado | `RunCodeOfTypeXforThingY("ObolRerollCostFrag", item)`  | candidata |                                                                                                     |
| Upgrade fail chance         | não mostrado | `event_ObolUpgrades`                                   | sem bloco | evento (10% / 5% / 0%)                                                                              |

## Alchemy: Bubbles, Vials, Sigils, Liquids (W2; Sigils W4)

Tela no app: própria, `Alchemy` (+ `› Brewing`, `› Liquid`, `› Vials`, `› Pay2Win`). Sigils: só do pai (não há tela de Sigils
reconhecida).

| Árvore                                  | Tipo            | Chamada do jogo                                                                                                                                           | Estado    | Nota                                                                     |
| --------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| Alchemy (bubbles, vials, sigils)        | sistema         | `@read DNSM.AlchBubbles.<chave>` × 4 caldeirões, `CauldronStats("VialBonus",4,i,0)`, `Labb("SigilBonus","Blank",i,0)`, `Labb("TotalGreenSigils","0",0,0)` | provada   | 2265 linhas, 2 "?"; 527/567 ⓘ; 7 pulados                                 |
| One bubble                              | stat do sistema | `@read DNSM.AlchBubbles.DropRate`                                                                                                                         | provada   | `any\pages\read-DNSM.AlchBubbles-DropRate` (montada no BASELINE)         |
| One bubble (by cauldron and slot)       | stat do sistema | `CauldronStats("BubbleBonus", t, i, 0)`                                                                                                                   | candidata | a mesma conta sem o cache; com o multiplicador Prisma (`isBubbleSuperr`) |
| One vial                                | stat do sistema | `CauldronStats("VialBonus", 4, 10, 0)`                                                                                                                    | provada   | 26 linhas, 0 "?"                                                         |
| One sigil                               | stat do sistema | `Labb("SigilBonus","Blank",3,0)`                                                                                                                          | provada   | 19 linhas, 0 "?" (C-: "1 + Chilled Yarn" dobrado)                        |
| Brew speed per cauldron                 | não mostrado    | `CauldronStats("ResearchSpeed", c, 0, 0)`                                                                                                                 | provada   | 155 linhas, 1 "?"                                                        |
| Liquid per hour                         | não mostrado    | `CauldronStats("LiquidHRrate", c, 0, 0)`                                                                                                                  | provada   | 177 linhas, 1 "?"                                                        |
| Liquid cap                              | não mostrado    | `CauldronStats("LiquidCap", c, 0, 0)`                                                                                                                     | provada   | 292 linhas, 3 "?"                                                        |
| New bubble chance                       | não mostrado    | `CauldronStats("PctChanceNewBubble", c, 0, 0)`                                                                                                            | provada   | 27 linhas, 1 "?"                                                         |
| Per-cauldron speed bonuses              | não mostrado    | `CauldronStats("SpecificSpdBonuses", c, 0, 0)`                                                                                                            | provada   | 52 linhas, 0 "?"                                                         |
| Alchemy EXP per point brewed            | não mostrado    | `CauldronStats("ExpPerPtBrewed", c, 0, 0)`                                                                                                                | provada   | 1120 linhas, 5 "?"                                                       |
| Bubble upgrade cost                     | não mostrado    | `CauldronStats("CauldronCosts", t, i, 0)`                                                                                                                 | candidata |                                                                          |
| Vial upgrade cost                       | não mostrado    | `CauldronStats("VialCosts", t, i, L)`                                                                                                                     | candidata |                                                                          |
| Bubbles unlocked / max per cauldron     | não mostrado    | `CauldronStats("NumBubblesUnlocked", c,0,0)`, `("MaxCauldronQTY", c,0,0)`                                                                                 | candidata |                                                                          |
| Cauldron level brew requirement / bonus | não mostrado    | `CauldronStats("CauldronLvsBrewREQ", …)`, `("CauldronLvsBrewBonus", …)`                                                                                   | candidata | o Bonus já é galho de `LiquidHRrate`                                     |
| Pay2Win upgrades                        | não mostrado    | `cauldronp2wbonuses("CauldronBonus", …)`, `("CauldronCosts", …)`                                                                                          | candidata | bloco próprio                                                            |
| Atom bubble upgrade cost (Boron)        | não mostrado    | `AtomCollider("AtomBubbleUpgCost", L, custo)`                                                                                                             | candidata | fórmula curta                                                            |
| Prisma bubble (is super)                | não mostrado    | `CauldronStats("isBubbleSuperr", t, i, 0)`                                                                                                                | candidata | 0/1 de `OptionsListAccount[384]` (vira Condição)                         |
| Sigil charge speed                      | não mostrado    | `Labb("SigilBonusSpeed","Blank",0,0)`                                                                                                                     | provada   | 150 linhas, 0 "?"                                                        |
| Purple sigils total                     | não mostrado    | `Labb("TotalPurpleSigils", …)`                                                                                                                            | candidata |                                                                          |
| Sigil next tier requirement             | não mostrado    | tabela `SigilDesc`                                                                                                                                        | sem bloco |                                                                          |
| Kruk daily bubbles                      | não mostrado    | `Thingies("KrukBubblesDaily", 0, 0)`                                                                                                                      | candidata | `KrukLottoBubble` sempre 0 (catálogo)                                    |
| Alchemy EXP                             | alimenta        | `ExpMulti(5)`                                                                                                                                             | provada   | 1115 linhas, 4 "?"                                                       |
| Bubble / vial / sigil feeds             | alimenta        | `DNSM.AlchBubbles`, `DNSM.AlchVials`, `SigilBonus`                                                                                                        | provada   | 131 / 69 / 72 árvores; 5 / 1 / 3 no Drop Rate                            |

## Voting / Bonus Ballot (W2)

Tela no app: própria, `Bonus Ballot`.

| Árvore            | Tipo         | Chamada do jogo                                                              | Estado  | Nota                                                       |
| ----------------- | ------------ | ---------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| Voting            | sistema      | `Summoning("VotingBonusz", 0..34, 0)` + `Summoning("VotingBonuszMulti",0,0)` | provada | 216 linhas, 0 "?"; 43/45 ⓘ                                 |
| Ballot multiplier | não mostrado | `Summoning("VotingBonuszMulti", 0, 0)`                                       | provada | dentro da página; G3: o rótulo "Multiplier" ainda pendente |
| Voting feeds      | alimenta     | `VotingBonusz`                                                               | provada | 83 árvores; 6 no Drop Rate                                 |

## Killroy (W2)

Tela no app: nenhuma (catálogo: "sem janela mapeada").

| Árvore                | Tipo         | Chamada do jogo                                                        | Estado    | Nota                                                                      |
| --------------------- | ------------ | ---------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------- |
| Killroy               | sistema      | `RiftStuff("KillroyDMG",0)` + `RandomEvent("KillroyBonuses", 0..7, 0)` | provada   | 46 linhas, 0 "?" (perde 3 linhas por envoltório com o mesmo nome, aceito) |
| Killroy damage        | não mostrado | `RiftStuff("KillroyDMG", 0)`                                           | provada   | dentro da página (soma de `KRbest` ^0,4)                                  |
| Prime Killroy total   | não mostrado | `Stuff2("PrimeKillroyTOT", 0, 0)`                                      | candidata | soma em laço                                                              |
| Extra fights unlocked | não mostrado | `RiftStuff("KillroyXtra",0)`, `("KillroyXtra2",0)`                     | candidata | portões 0/1 (DECISOES: fora do sistema)                                   |
| Room unlocked         | não mostrado | `RunCodeOfTypeXforThingY("KillroyRoom", 0)`                            | candidata | 0/1 de `NONdummies[46]`                                                   |
| Shop 3rd fight chance | não mostrado | `event_Click2`                                                         | sem bloco |                                                                           |
| Killroy feeds         | alimenta     | `KillroyBonuses`                                                       | provada   | 73 árvores; 1 no Drop Rate                                                |

## Arcade (W2)

Tela no app: própria, `Arcade`.

| Árvore            | Tipo            | Chamada do jogo                              | Estado    | Nota                                                                                   |
| ----------------- | --------------- | -------------------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| Arcade            | sistema         | `ArcadeBonus(i)` (`CL.ArcadeShopInfo`)       | provada   | 583 linhas, 0 "?"; 152/152 ⓘ; 6 pulados. Também `h-system-arcade` (583 / 0)            |
| One arcade bonus  | stat do sistema | `ArcadeBonus(27)`                            | provada   | 12 linhas, 0 "?" (C-: Companions 27 vira "Fixed ×2")                                   |
| Seconds per ball  | não mostrado    | `DungeonStat("Arcade_SecPerBall")`           | candidata |                                                                                        |
| Max claim time    | não mostrado    | `DungeonStat("Arcade_MaxClaimTime")`         | candidata | 48 h + carimbo                                                                         |
| Ball bonus        | não mostrado    | `DungeonStat("Arcade_BallBonus")`            | candidata |                                                                                        |
| Gold ball extra % | não mostrado    | `Summoning("ArcadeGballsExtraPCT", 0, 0)`    | candidata | 6 fontes (Palette, Arcane, Exotic, Companions)                                         |
| Omega ball chance | não mostrado    | `MenagerieStuff("OmegaArcBallChance", 0, 0)` | candidata | bloco do W7                                                                            |
| Upgrade cost      | não mostrado    | `DungeonCalc("ArcadeCost", i)`               | candidata |                                                                                        |
| Arcade feeds      | alimenta        | `ArcadeBonus`                                | provada   | 118 árvores; 5 no Drop Rate; conflito de peça no Defence (`ArcadeBonus[54]`) em aberto |

## Post Office (W2)

Tela no app: própria, `Post Office` (+ `› Orders`, `› Upgrade`).

| Árvore                         | Tipo            | Chamada do jogo                                      | Estado    | Nota                                                  |
| ------------------------------ | --------------- | ---------------------------------------------------- | --------- | ----------------------------------------------------- |
| Post Office                    | sistema         | `@read DNSM.BoxRewards.<chave>`                      | provada   | 438 linhas, 0 "?"; 125/125 ⓘ; 0 peças (forma `@read`) |
| One box reward (ex. Drop Rate) | stat do sistema | `@read DNSM.BoxRewards.DropRate`                     | provada   | 7 linhas, 0 "?"                                       |
| Box bonus amount (by tier)     | não mostrado    | `PostOfficeINFO("BonusAmount", box, tier)`           | candidata | 3 tiers (`i` = 0/1/2)                                 |
| Points available               | não mostrado    | `PostOfficeINFO("AvailablePoints", 0, 0)`            | candidata | soma em laço                                          |
| Specific bonus                 | não mostrado    | `PostOfficeINFO("SpecificBonus", box, j)`            | candidata |                                                       |
| Daily extra boxes              | não mostrado    | `Thingies("DailyPOboxes", 0, 0)`                     | candidata | 5 × Event Shop 21                                     |
| Orders, swaps, refresh         | não mostrado    | `OfficeboxOrders(...)`, `TimeAway.PostOfficeRefresh` | sem bloco | `OfficeboxOrders` é ação, não valor                   |
| Post Office feeds              | alimenta        | `DNSM.BoxRewards`                                    | provada   | 61 árvores; 1 no Drop Rate                            |

## Islands (W2)

Tela no app: própria, `Island Selection` (e `Raft Travel`).

| Árvore        | Tipo     | Chamada do jogo                                                                                                             | Estado  | Nota                                |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------- |
| Islands       | sistema  | `Dreamstuff("AllShimmerBonuses",0)`, `RandomEvent("FractalIslandBonus", 1..6, 999)`, `RandomEvent("BottleIslandBonus",0,0)` | provada | 46 linhas, 0 "?"                    |
| Islands feeds | alimenta | `FractalIslandBonus`                                                                                                        | provada | 3 árvores (talent points, Sneaking) |

## Owl, Kangaroo, Bubba (Clickers; W1, W2, W3)

Tela no app: própria, `Orion` (Owl), `Poppy` (Kangaroo), `Bubba`.

| Árvore                               | Tipo         | Chamada do jogo                                                                                                                         | Estado    | Nota                                                                    |
| ------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Clickers (Owl, Kangaroo, Bubba)      | sistema      | `Summoning("OwlBonuses"/"OwlMegafeather"/"RooBonuses"/"RooMegafeather", i, 0)`, `Bubbastuff("MegafleshOwned"/"BubbaRoG_Bonuses", i, 0)` | provada   | 263 linhas, 0 "?"; Owl sozinho `h-system-owl` 131 / 0                   |
| Feather rate                         | não mostrado | `Summoning2("OwlFeatherRate", 0, 0)`                                                                                                    | candidata |                                                                         |
| Shiny feather chance                 | não mostrado | `Summoning2("OwlFeatherShinyGen", 0, 0)`                                                                                                | candidata | cresce 1,1^contador                                                     |
| Owl next upgrade / cost              | não mostrado | `Summoning2("OwlNextUpgReq", …)`, `Summoning("OwlCost", i, 0)`                                                                          | candidata |                                                                         |
| Roo catch rate / requirement / shiny | não mostrado | `Summoning("RooCatchRate"/"RooCatchREQ"/"RooShinyMulti"/"RooShinyLuck", …)` (+ `_S`, `_T`)                                              | candidata | 13 sub-casos Roo no bloco                                               |
| Roo reset bonus                      | não mostrado | `Summoning("RooRESETbon", t, 0)`                                                                                                        | candidata |                                                                         |
| Bubba meat per second                | não mostrado | `Bubbastuff("MeatsliceRate", 0, 0)`                                                                                                     | candidata | produto de 10+ fatores (Happiness, Dice, Smoke, Charisma, Sushi, Jelly) |
| Bubba happiness bonus / loss         | não mostrado | `Bubbastuff("HappinessBonus",0,0)`, `("HappinessLoss",0,0)`                                                                             | candidata |                                                                         |
| Bubba dice / smoker / spare coins    | não mostrado | `Bubbastuff("Dice_Multi"/"SmokeMeat_Multi"/"SmokeMeat_2xChancePCT"/"SpareCoins_FindChance", 0, 0)`                                      | candidata | `Dice_Result` é sorteio (não serve como árvore)                         |
| Bubba upgrade cost                   | não mostrado | `Bubbastuff("UpgCost", i, 0)`                                                                                                           | candidata |                                                                         |
| Owl / Roo / Bubba feeds              | alimenta     | `OwlBonuses`, `RooBonuses`, `BubbaRoG_Bonuses`                                                                                          | provada   | 44 / 23 / 9 árvores; Owl 2 no Drop Rate                                 |

## Colosseum (W1 a W5)

Tela no app: própria, `Colosseum`.

| Árvore                 | Tipo         | Chamada do jogo                            | Estado               | Nota                                |
| ---------------------- | ------------ | ------------------------------------------ | -------------------- | ----------------------------------- |
| Chest tiers from score | não mostrado | `event_Colosseum`, `customEvent_NextRound` | sem bloco            | `ColosseumStuff` existe mas é vazio |
| Score in the run       | não mostrado | cena do Colosseum                          | precisa do jogo vivo |                                     |

## Construction: Workbench (cogs, flags), Towers, Talent Library (W3)

Tela no app: própria, `Construction`, `Construction › Build`, `Construction › Cogs`, `Talent Library`.

| Árvore                                                       | Tipo         | Chamada do jogo                                                                        | Estado            | Nota                                                                                |
| ------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| Construction (workbench, shrines, salt lick, atoms, printer) | sistema      | `WorkbenchStuff(...)`, `Shrine(i)`, `SaltLick(i)`, `AtomCollider("AtomBonuses",i,0)`   | provada           | 590 linhas, 0 "?"; 95/96 ⓘ; 1 progresso de laço                                                       |
| Build speed per hour                                         | não mostrado | `WorkbenchStuff("PlayerBuildSpd", 0, 0)`                                               | provada           | 249 linhas, 1 "?"                                                                   |
| Construction EXP per hour                                    | não mostrado | `WorkbenchStuff("PlayerConExp", 0, 0)`                                                 | provada           | 129 linhas, 1 "?" (`ExpMulti(8)` cai no padrão: 1 linha)                            |
| Cog build speed bonus                                        | não mostrado | `WorkbenchStuff("CogBuildSpdBonus", 0, 0)`                                             | provada           | 13 linhas, 0 "?"                                                                    |
| Flag speed                                                   | não mostrado | `WorkbenchStuff("FlagSpeed", 0, 0)`                                                    | gravada sem conta | 1 linha, 1 "?"                                                                      |
| Gilded slots (cap 8)                                         | não mostrado | `WorkbenchStuff("TotalGildedSlots", 0, 0)`                                             | provada           | 136 linhas, 0 "?" (6 fontes)                                                        |
| Gilded boost                                                 | não mostrado | `WorkbenchStuff("TotalGildedBoostio", 0, 0)`                                           | candidata         |                                                                                     |
| Cog slots (cap 120)                                          | não mostrado | `WorkbenchStuff("CogSlots", 0, 0)`                                                     | candidata         |                                                                                     |
| Flag requirement                                             | não mostrado | `WorkbenchStuff("FlagReq", n, 0)`                                                      | candidata         | regra muda a partir da 96                                                           |
| Cog build requirement / claims                               | não mostrado | `WorkbenchStuff("CogBuildReq", …)`, `("CogBuildClaims", …)`                            | candidata         |                                                                                     |
| Extra build / flag / EXP multipliers                         | não mostrado | `WorkbenchStuff("ExtraBuildSPDmulti"/"ExtraFlaggyRatemulti"/"ExtraConEXPmulti", 0, 0)` | candidata         |                                                                                     |
| Cog final effect with neighbours                             | não mostrado | `CogMatrices`, `CogMapSurroundDisp`                                                    | sem bloco         | estado montado na tela                                                              |
| Tower build requirement                                      | não mostrado | `WorkbenchStuff("TowerBuildReq", t, 0)`                                                | candidata         |                                                                                     |
| Tower salt / material cost                                   | não mostrado | `WorkbenchStuff("TowerSaltCost", t, 0)`, `("TowerMatCost", t, 0)`                      | candidata         | Cost Cruncher; teto 1e7                                                             |
| Tower build slots                                            | não mostrado | `WorkbenchStuff("TowerBuildSlots", 0, 0)`                                              | candidata         |                                                                                     |
| Extra max level from atoms                                   | não mostrado | `WorkbenchStuff("ExtraMaxLvAtom", t, 0)`                                               | candidata         |                                                                                     |
| Construction mastery bonus                                   | não mostrado | `WorkbenchStuff("ConstMasteryBonus", i, 0)`                                            | candidata         | só a partir do Rift 40; regra 128 pendente                                          |
| Talent book time                                             | não mostrado | `WorkbenchStuff("BookReqTime", 0, 0)`                                                  | provada           | 139 linhas, 0 "?"                                                                   |
| Talent book max level                                        | não mostrado | `WorkbenchStuff("maxBookLv", 0, 0)`                                                    | provada           | 47 linhas, 0 "?"                                                                    |
| Talent book min level                                        | não mostrado | `WorkbenchStuff("minBookLv", 0, 0)`                                                    | candidata         |                                                                                     |
| Construction power / EXP                                     | alimenta     | `ExpMulti(8)`                                                                          | gravada sem conta | 1 linha: `SkillStats("ConstructionEXPmulti")` sem ramo; a EXP real é `PlayerConExp` |
| Workbench feeds (extra EXP/DR, damage)                       | alimenta     | `WorkbenchStuff("AdditionExtraEXPnDR"/"AdditionExtraDMG",0,0)`                         | provada           | 20 árvores; 1 no Drop Rate                                                          |


## Refinery (W3)

Tela no app: própria, `Refinery` (+ `› Combustion`, `› Synthesis`, `› Polymerize`).

| Árvore                                | Tipo         | Chamada do jogo                                    | Estado    | Nota                                                 |
| ------------------------------------- | ------------ | -------------------------------------------------- | --------- | ---------------------------------------------------- |
| Cycle time                            | não mostrado | `Refinery("CycleInitialTime", tab)`                | provada   | 169 linhas, 0 "?" (tab 0; o tab 2 soma `PolyRefSpd`) |
| Power per cycle                       | não mostrado | `Refinery("PowerPerCycle", rank)`                  | provada   | 2 linhas, 0 "?" (rank 0 e 100)                       |
| Power cap / cap multiplier            | não mostrado | `Refinery("PowerCAP", rank)`, `("CapMulti", rank)` | candidata |                                                      |
| Cost multiplier (Salty Spitoon merit) | não mostrado | `Refinery("CostsMulti", n)`                        | candidata | troca o expoente 1,5 → 1,3                           |
| Fuel / reward %                       | não mostrado | `Refinery("FuelCalc", …)`, `("RewardPct", …)`      | candidata |                                                      |
| Cycles possible from stock            | não mostrado | `event_1sec`                                       | sem bloco |                                                      |
| Refinery feeds (salts → EXP)          | alimenta     | `Refinery`                                         | provada   | 28 árvores (EXP de skills)                           |

## Shrines (W3)

Tela no app: própria, `Shrines`.

| Árvore                     | Tipo            | Chamada do jogo                          | Estado    | Nota                             |
| -------------------------- | --------------- | ---------------------------------------- | --------- | -------------------------------- |
| Shrines                    | sistema         | `Shrine(-1)` (cache) + `Shrine(i)`       | provada   | dentro de Construction (590 / 0) |
| One shrine                 | stat do sistema | `Shrine(2)`                              | provada   | 15 linhas, 0 "?"                 |
| Shrine EXP bonus           | não mostrado    | `WorkbenchStuff("ShrineExpBonus", 0, 0)` | provada   | 82 linhas, 0 "?"                 |
| Hours to next shrine level | não mostrado    | `WorkbenchStuff("ShrineHrREQ", L, 0)`    | candidata | curva 1,63^L                     |
| Shrine feeds               | alimenta        | `Shrine(`                                | provada   | 51 árvores; 1 no Drop Rate       |

## Salt Lick (W3)

Tela no app: própria, `Salt Lick`.

| Árvore          | Tipo            | Chamada do jogo                               | Estado    | Nota                                |
| --------------- | --------------- | --------------------------------------------- | --------- | ----------------------------------- |
| Salt Lick       | sistema         | `SaltLick(i)` (`CL.SaltLicks`)                | provada   | dentro de Construction              |
| One upgrade     | stat do sistema | `SaltLick(3)`                                 | provada   | 4 linhas, 0 "?" (C-: nome cru)      |
| Upgrade cost    | não mostrado    | tabela `SaltLicks[2]`/`[5]`, `event_killDNQT` | sem bloco |                                     |
| Salt Lick feeds | alimenta        | `SaltLick`                                    | provada   | 24 árvores (EXP, `SampleSizeBONUS`) |

## Atom Collider (W3)

Tela no app: própria, `Atom Collider`.

| Árvore                   | Tipo         | Chamada do jogo                                     | Estado    | Nota                                                       |
| ------------------------ | ------------ | --------------------------------------------------- | --------- | ---------------------------------------------------------- |
| Atoms                    | sistema      | `AtomCollider("AtomBonuses", i, 0)` (`CL.AtomInfo`) | provada   | dentro de Construction                                     |
| Atom upgrade cost        | não mostrado | `AtomCollider("AtomCost", i, 0)`                    | candidata | desconto de Super Bits e outros                            |
| Atom max level           | não mostrado | `AtomCollider("AtomMaxLv", 0, 0)`                   | candidata | 20 + Super Bit 23, Compass 53, Event Shop 28, Menagerie 17 |
| Atoms available          | não mostrado | `AtomCollider("AtomsAvailableAtAll", 0, 0)`         | candidata | 11 + 6 portões de W6/W7                                    |
| Chest condense threshold | não mostrado | `AtomCollider("AtomThreshold", 0, 0)`               | candidata | escolha do jogador (`OptionsListAccount[133]`)             |
| Atom feeds               | alimenta     | `AtomBonuses`                                       | provada   | 77 árvores; 1 no Drop Rate; custo dos selos e das bolhas   |

## 3D Printer (W3)

Tela no app: própria, `3D Printer`.

| Árvore                  | Tipo         | Chamada do jogo                                                          | Estado    | Nota                                             |
| ----------------------- | ------------ | ------------------------------------------------------------------------ | --------- | ------------------------------------------------ |
| Printer                 | sistema      | `WorkbenchStuff("AdditionExtraPrinting",0,0)`, `("ExtraPrinting", c, 0)` | provada   | dentro de Construction                           |
| Sample size %           | não mostrado | `WorkbenchStuff("SampleSizeBONUS", 0, 0)`                                | provada   | 170 linhas, 0 "?" (teto 0,9)                     |
| Sample / big slots      | não mostrado | `WorkbenchStuff("PrinterSampleSlots",0,0)`, `("PrinterBigSlots",0,0)`    | candidata |                                                  |
| Daily printing counters | não mostrado | `OptionsListAccount[125,323,354,364,479]`                                | sem bloco | estado; já entram como folhas em `ExtraPrinting` |

## Worship: Prayers e Totems (W3)

Tela no app: própria, `Prayers`, `Worship Totem`.

| Árvore                                | Tipo            | Chamada do jogo                                                                     | Estado    | Nota                                                                             |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| Prayers                               | sistema         | `prayersReal(i, 0)` (bônus) e `prayersReal(i, 1)` (maldição)                        | provada   | 473 linhas, 0 "?"; 14 pulados                                                    |
| One prayer                            | stat do sistema | `prayersReal(1, 0)`                                                                 | provada   | 22 linhas, 0 "?"                                                                 |
| Prayer cost                           | não mostrado    | `WorshipStuff("PrayerCost", i)`                                                     | candidata |                                                                                  |
| Prayer max level                      | não mostrado    | `WorkbenchStuff("PrayerMaxLv", i, 0)`                                               | candidata | só leitura de tabela (folha)                                                     |
| Worship efficiency                    | não mostrado    | `SkillStats("WorshipEfficiency")`                                                   | provada   | 1484 linhas, 5 "?"                                                               |
| Charge speed                          | não mostrado    | `SkillStats("WorshipSpeed")`                                                        | provada   | 59 linhas, 0 "?"                                                                 |
| Max charge                            | não mostrado    | `SkillStats("WorshipChargeMax")`                                                    | provada   | 144 linhas, 0 "?"                                                                |
| Worship power                         | stat do sistema | `TotalStats("Worship_Power")`                                                       | provada   | 34 linhas, 0 "?"                                                                 |
| Worship EXP                           | alimenta        | `ExpMulti(9)`                                                                       | provada   | 1170 linhas, 3 "?"                                                               |
| Souls per wave                        | não mostrado    | `WorshipStuff("SoulRewards", w)`                                                    | candidata |                                                                                  |
| Worship EXP per wave                  | não mostrado    | `WorshipStuff("ExpRewards", w)`                                                     | candidata |                                                                                  |
| Totem wave multiplier                 | não mostrado    | `WorshipStuff("WaveMultiplier", L)`                                                 | candidata |                                                                                  |
| Efficiency bonus above requirement    | não mostrado    | `WorshipStuff("EfficiencyBonusQTY", map)`                                           | candidata |                                                                                  |
| Totem HP / next wave / new tower cost | não mostrado    | `WorshipStuff("TotemHPtotal",0)`, `("NextWaveCountdown", w)`, `("NewTowerCost", t)` | candidata |                                                                                  |
| Tower defense tower stats             | não mostrado    | `TowerStats("damage"/"cost"/"atkcd"/"range"/"maxlv", t, L)`                         | candidata | lê `PixelHelperActor[7]` (estado da cena de Worship); pode precisar do jogo vivo |
| Skull points / currency               | não mostrado    | `WorshipStuff("SkullPts"/"SkullCurrency", …)`                                       | candidata |                                                                                  |
| Prayer feeds                          | alimenta        | `prayersReal`                                                                       | provada   | 71 árvores; 1 no Drop Rate                                                       |

## Trapping (W3)

Tela no app: própria, `Trapping`, `Eagle Eye Trap-O-Vision`.

| Árvore                                 | Tipo            | Chamada do jogo                                                                                                                            | Estado    | Nota                                                    |
| -------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------- |
| Trapping bonuses                       | sistema         | `TrappingStuffs("TrapMGbonus", 0..8)`, `("BaseQTY",1)`, `("CollectAllPCT"/"CollectAllPCTexp"/"RareBonusOnOpen"/"RareBonusOnOpenMULTI", 0)` | provada   | 326 linhas, 0 "?"; 78/80 ⓘ (Condição do minijogo sem ⓘ) |
| Critters per trap                      | não mostrado    | `TrappingStuffs("TotalQTY", 0)`                                                                                                            | provada   | 1878 linhas, 6 "?"                                      |
| Trapping EXP per trap                  | não mostrado    | `TrappingStuffs("TotalEXP", 0)`                                                                                                            | provada   | 1310 linhas, 4 "?"                                      |
| Shiny critter chance                   | não mostrado    | `TrappingStuffs("TotalRareChance", 0)`                                                                                                     | provada   | 25 linhas, 1 "?"                                        |
| Trapping efficiency                    | não mostrado    | `SkillStats("TrappingEfficiency")`                                                                                                         | provada   | 1540 linhas, 4 "?"                                      |
| Trapping power                         | stat do sistema | `TotalStats("Trapping_Power")`                                                                                                             | provada   | 34 linhas, 0 "?"                                        |
| Trapping EXP                           | alimenta        | `ExpMulti(7)`                                                                                                                              | provada   | 1212 linhas, 3 "?"                                      |
| Efficiency bonus above map requirement | não mostrado    | `TrappingStuffs("EfficiencyBonusQTY", map)`                                                                                                | candidata |                                                         |
| Per-trap qty / EXP / rare bonus        | não mostrado    | `TrappingStuffs("TrapQtyBonus"/"TrapEXPBonus"/"TrapRareBonus", t)`                                                                         | candidata |                                                         |
| Traps placeable                        | não mostrado    | `TrappingStuffs("NumOfTrapsPlaceable", c)`                                                                                                 | candidata |                                                         |
| Time left on all traps                 | não mostrado    | estado `PldTraps` de cada personagem                                                                                                       | sem bloco | leitura do save, não conta                              |
| Card chance by trap duration           | não mostrado    | `event_01sec`                                                                                                                              | sem bloco |                                                         |
| Minigame bonus to skill                | não mostrado    | `skillstats2("TrappingMinigame")`                                                                                                          | candidata |                                                         |

## Hat Rack (W3)

Tela no app: própria, `The Hat Rack`.

| Árvore    | Tipo     | Chamada do jogo                                                                                        | Estado  | Nota                           |
| --------- | -------- | ------------------------------------------------------------------------------------------------------ | ------- | ------------------------------ |
| Hat Rack  | sistema  | `Gallery("InitializePremHatBonuses",0,0)`, `Gallery("HatrackBonusMulti"/"PremHatBonusesSystemON",0,0)` | provada | 24 linhas, 0 "?"               |
| Hat feeds | alimenta | `InitializePremHatBonuses`, `HatrackBonusMulti`                                                        | provada | 63 árvores; 4 + 3 no Drop Rate |

## Death Note (W3)

Tela no app: própria, `Death Note` (+ `› Minibosses` e uma aba por mundo).

| Árvore                       | Tipo         | Chamada do jogo                                           | Estado    | Nota                                                                 |
| ---------------------------- | ------------ | --------------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| Death Note (eclipse skulls)  | sistema      | `RiftStuff("eclipseSkulls", 0)`                           | provada   | 5 linhas, 0 "?"                                                      |
| Skull rank from kills        | não mostrado | `WorkbenchStuff("DeathNoteRank", kills, 0)` e `(…, 7842)` | candidata | 2 tabelas de degraus (o `7842` escolhe a segunda); kills = argumento |
| Overkill tier of the AFK map | não mostrado | `WorkbenchStuff("OverkillQTY", map, 0)`                   | candidata | hoje aparece como "?" (causa F) dentro de `MeasurementBonusTOTAL`    |
| Multikill per overkill tier  | alimenta     | `WorkbenchStuff("MultiKillTOTAL", 0, 0)`                  | provada   | 441 linhas, 2 "?"                                                    |
| Kills left per map           | não mostrado | `KillsLeft2Advance` por personagem                        | sem bloco | estado                                                               |

## Equinox (W3)

Tela no app: nenhuma (catálogo: "sem janela mapeada").

| Árvore                           | Tipo         | Chamada do jogo                                        | Estado    | Nota                            |
| -------------------------------- | ------------ | ------------------------------------------------------ | --------- | ------------------------------- |
| Equinox                          | sistema      | `Dreamstuff("CloudBonus", i)` + leitura `Dream[2..15]` | provada   | 250 linhas, 0 "?"; 76/77 ⓘ      |
| Bar fill requirement             | não mostrado | `Dreamstuff("BarFillReq", 0)`                          | candidata | cresce 1,02^nível total         |
| Bar fill rate                    | não mostrado | `Dreamstuff("BarFillRate", 0)`                         | candidata |                                 |
| Upgrade max level                | não mostrado | `Dreamstuff("UpgMaxLV", i)`                            | candidata | cada upgrade com as suas nuvens |
| Upgrades unlocked / clouds owned | não mostrado | `Dreamstuff("UpgUnlocked",0)`, `("CloudsOwned",0)`     | candidata | soma de 12 `CloudBonus`         |
| Challenge progress               | não mostrado | `WeeklyBoss.h["d_N"]`                                  | sem bloco | estado                          |
| Equinox feeds                    | alimenta     | `CloudBonus`, `Dream`                                  | provada   | 91 árvores; 8 no Drop Rate      |

## Dungeons e Dungeon stats (W3)

Tela no app: nenhuma (catálogo: "Party Dungeon, sem janela mapeada").

| Árvore                                                | Tipo            | Chamada do jogo                                                                            | Estado               | Nota                                                                                |
| ----------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| Dungeons (Flurbo shop, traits)                        | sistema         | `FlurboShop(i)`, `DungeonCalc("TraitBonus", i)`, `DungeonCalc("BonusCalcs", 0/1)`          | provada              | 101 linhas, 0 "?" (MAX_DEPTH 12); `BonusCalcs(-1)` nunca gravar (esvazia os caches) |
| Dungeon stats                                         | sistema         | `DungeonStat("DEF"/"MASTERY"/"CRITDMG"/"BossDMG"/"DropRarity")`                            | provada              | 18 linhas, 0 "?"                                                                    |
| Dungeon power                                         | stat do sistema | `TotalStats("Dung_Power")`                                                                 | provada              | 15 linhas, 0 "?"                                                                    |
| Other dungeon stats (HP, MP, DMG, SPEED, CardChance…) | stat do sistema | `DungeonStat("HP"/"MP"/"DMG"/"SPEED"/"CRITCHANCE"/"CardChance"/"FOODHP"/…)`                | candidata            | 27 sub-casos; o sistema grava 5                                                     |
| In-dungeon cache (attack speed etc.)                  | stat do sistema | `@read DNSM.DungeonStats.attackSpd`                                                        | precisa do jogo vivo | 1 linha, 1 "?": o cache só é escrito dentro da masmorra                             |
| Party drop / boss HP adjust                           | não mostrado    | `DungeonStat("DropRate_Adjust")`, `("BossHP_Adjust")`                                      | precisa do jogo vivo | dependem de `PartySize` na masmorra                                                 |
| Next happy hour                                       | não mostrado    | `DungeonStat("TimeToEndOfNextHappyHour")`                                                  | candidata            | lê `HappyHours` do servidor (precisa da lista do servidor no retrato)               |
| Passive stat cost                                     | não mostrado    | `DungeonCalc("PassiveStatCost", i)`, `("PassiveStatCost2", i)`                             | candidata            |                                                                                     |
| Credit / keychain fragment bonus                      | não mostrado    | `DungeonCalc("DungeonCredit_Bonus"/"DungeonCredit_Bonus2"/"DungeonKeychainFrag_Bonus", 0)` | candidata            |                                                                                     |
| Rarity up chance / RNG upgrade / enhance cost         | não mostrado    | `DungeonCalc("EquipRarityUPchance"/"RngUpgCost"/"Enhance_DRcost", …)`                      | candidata            |                                                                                     |
| Trait level requirement                               | não mostrado    | `DungeonCalc("TraitLvReq", i)`                                                             | candidata            |                                                                                     |

## Fishing Toolkit (W2)

Tela no app: própria, `Fishing Toolkit`.

| Árvore             | Tipo            | Chamada do jogo                                            | Estado    | Nota                                     |
| ------------------ | --------------- | ---------------------------------------------------------- | --------- | ---------------------------------------- |
| Toolkit bonuses    | stat do sistema | `FishingToolkit("EXP"/"SPEED"/"POW")`                      | candidata | já são galhos de `FishingSpeed` e outras |
| Catch tier chances | não mostrado    | `FishingToolkit("Pct1".."Pct4")`, `("EffReq1".."EffReq3")` | candidata |                                          |

## Weekly Boss (W2)

Tela no app: nenhuma.

| Árvore             | Tipo         | Chamada do jogo                                                | Estado    | Nota |
| ------------------ | ------------ | -------------------------------------------------------------- | --------- | ---- |
| Boss power curve   | não mostrado | `WeeklyBoss("POW", 0)`                                         | candidata |      |
| Boss max HP        | não mostrado | `WeeklyBoss("BossHPmax", 0)`                                   | candidata |      |
| Damage multipliers | não mostrado | `WeeklyBoss("BonusDmgAll"/"BonusDmgATTACK"/"BonusBuffAll", 0)` | candidata |      |

## Na fronteira (itens do W1, de personagem): Golden Food, Boost Food, Armor Smithy

Tela no app: `Items › Equipment › Foods` (comidas); `Armor-Set Smithy`. Prováveis de outra frente; listo só o estado.

| Árvore                         | Tipo            | Chamada do jogo                                        | Estado  | Nota              |
| ------------------------------ | --------------- | ------------------------------------------------------ | ------- | ----------------- |
| Golden Food                    | sistema         | `GoldFoodBonuses(type)`                                | provada | 830 linhas, 0 "?" |
| One golden food (Monster Cash) | stat do sistema | `GoldFoodBonuses("MonsterCash")`                       | provada | 591 linhas, 0 "?" |
| Boost Food                     | sistema         | `TotalFoodBonuses(type)`, `FoodBonuses(type)`          | provada | 449 linhas, 0 "?" |
| Armor Smithy (set bonuses)     | sistema         | `GetSetBonus(set, "Bonus"/"PartsOn"/"PartsReq", 0, 0)` | provada | 77 linhas, 0 "?"  |

---

## Totais por estado

Contados nas linhas das tabelas acima (cada linha = uma árvore possível).

| Estado               | Linhas  |
| -------------------- | ------- |
| provada              | 101     |
| gravada sem conta    | 4       |
| candidata            | 99      |
| sem bloco            | 16      |
| precisa do jogo vivo | 3       |
| **Total**            | **223** |

Por tipo: 27 `sistema`, 20 `stat do sistema`, 149 `não mostrado`, 27 `alimenta` (uma linha pode juntar 2 a 4 sub-casos do mesmo bloco).

## Os 5 achados mais importantes

1. **Quase tudo dos mundos 1 a 3 já tem a árvore do sistema provada**, e com poucos "?": Stamps 1215/1, Alchemy 2265/2,
   Statues 617/0, Arcade 583/0, Construction 590/0, Worship 473/0, Post Office 438/0, Trapping 326/0, Star Signs 255/0,
   Equinox 250/0. Faltam sistema só onde não há bônus próprio (Smithing, Obols, Colosseum, Fishing Toolkit, Weekly Boss).
2. **Os "números que o jogo não mostra" são quase todos candidatas baratas**: o bloco e o sub-caso existem e nunca foram gravados
   (99 linhas). Os blocos-mãe concentram a maior parte: `WorkbenchStuff` (40 sub-casos, ~20 sem árvore), `CauldronStats`,
   `Bubbastuff` (39), `Summoning`/`Summoning2` (Owl/Roo), `Dreamstuff`, `DungeonCalc`, `AtomCollider`, `Refinery`, `WorshipStuff`.
   A Cobertura H mostrou 5 a 20 s por gravação, então uma rodada de ~100 cabe em menos de uma hora (gravações uma por vez).
3. **Stamps, combinado com o dono, se confirma com uma troca:** `StampOverLevel(tab*1000+i)` e `RiftStuff("gildedStampChance",0)`
   são blocos de valor; o "exaltado" não é `StampExalted_double` (cache) e sim `Windwalker("StampDoubler",0,0)`; o teto
   (`StampLevelMAX`) é estado e não tem conta; e **`StampCostss` devolve uma lista** (material e quantidade), então precisa de
   uma raiz de lista ou de ler o elemento `[1]`. É o primeiro caso de raiz não numérica.
4. **Custos são a maior lacuna sem bloco**: Bribes, Salt Lick, Sigils (próximo tier) e Shrines (só tem `ShrineHrREQ`) moram em
   tabelas e eventos; Colosseum (`ColosseumStuff` é vazio), falha de Obol e pedidos do Post Office são eventos. Esses só podem
   aparecer como número lido, nunca como árvore.
5. **Telas sem painel**: Killroy, Equinox, Dungeons e Weekly Boss não têm tela reconhecida no app (catálogo: "sem janela
   mapeada"); Sigils só pela Alchemy. E três árvores dependem do jogo vivo: o cache `DNSM.DungeonStats` (só dentro da masmorra),
   `DropRate_Adjust`/`BossHP_Adjust` (tamanho do grupo) e o placar do Colosseum; `TowerStats` lê o ator da cena de Worship e pode
   ser o quarto.

---

# Árvores possíveis — sistemas dos Mundos 4 e 5 (frente 4)

Pesquisa só de leitura, 12/11/2026. Base: BASELINE-3.1 da bancada `formula-006` (páginas `systems\pages\*.html` remontadas; contagens lidas do `const D` de cada página e de `systems\data\<página>-audit.json`), páginas de cobertura `any\pages\{g,h,n}-*.html`, receitas `systems*.cjs`, catálogo `docs\product\telas-mundos-3-a-5.md`, regras de tela do app (`src\shared\screens\rules\*.json`) e o índice do N.js (`njs-index`: `block`, `search_code`, `callees`).

Como ler:

- **Tipo**: `sistema` (de onde vêm os bônus do sistema), `stat do sistema` (um número que o sistema mostra ou entrega), `não mostrado` (número que o jogo calcula e não mostra: custo, teto, chance, tempo, taxa), `alimenta` (peça que entra em outra árvore).
- **Estado**: `provada` (página montada; dou linhas e "?" reais, sem contar o progresso de laço), `gravada sem conta` (gravação existe, mas a página não abre a conta ou não existe), `candidata` (sub-caso existe no N.js, nunca gravado), `sem bloco` (o jogo faz a conta fora de um bloco ou em evento de tela; precisaria de conta à mão, então não serve), `precisa do jogo vivo` (o bloco lê o ator da tela, `PixelHelperActor[n]._GenINFO`, ou uma variável do servidor que o retrato isolado não tem).
- "?" = folha sem tipo; "prog" = progresso de laço (o total das voltas anteriores), contado à parte, como no índice da bancada.
- As páginas `n-*` e `g-*` são cobertura: a árvore abre e o valor da raiz confere com a gravação, mas não tiveram auditoria linha a linha como as de sistema.

---

## 1. Breeding (Shiny Pets, Pet Arena, ovos, pets, territórios)

**Tela no app:** própria — `Breeding`, `Breeding › Breeding`, `Breeding › Teams`, `Breeding › Upgrade`, `Breeding › Database` (`› Storage`, `› Genetics`, `› Shinies`).

| Árvore                                                  | Tipo            | Chamada do jogo                                                                                                 | Estado                                          | Nota                                                                                                                                           |
| ------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Breeding bonuses                                        | sistema         | `Breeding("ShinyBonusS"…)`, `("SpecialPassives"…)`, `("PetArenaBonus"…)`                                        | provada — 882 linhas, 0 "?" (5 prog), ⓘ 227/227 | página `breeding.html`, 110 membros, 0 pulados                                                                                                 |
| Shiny bonus by stat (26 stats)                          | stat do sistema | `Breeding("ShinyBonusS","Nah",k,-1)`                                                                            | provada — 471 linhas, 0 "?"                     | cobertura `h-Breeding-ShinyBonusS-Nah-3--1`: 43 linhas, 0 "?"                                                                                  |
| Shiny level of each pet                                 | stat do sistema | `Breeding("SpecialPassives","Lv",w,p)`                                                                          | provada — 341 linhas, 0 "?"                     | uma raiz por pet                                                                                                                               |
| Pet Arena bonuses                                       | stat do sistema | `Breeding("PetArenaBonus","0",k,0)`                                                                             | provada — 65 linhas, 0 "?"                      | `h-…PetArenaBonus-s0-5-0`: 19 linhas                                                                                                           |
| Pet Arena Cruc bonuses                                  | alimenta        | `Breeding("PetArenaCrucBonus","0",k,0)`                                                                         | candidata                                       | 16 sub-índices chamados por ExpMulti, CookingR, Summoning, MenagerieStuff, o próprio Breeding                                                  |
| Pet upgrades                                            | sistema         | `Breeding("PetUpgBONUS","0",k,0)`                                                                               | candidata                                       | receita pronta (`systems-b9.cjs`, `pet-upgrades`), desligada no grupo B ("produção, não bônus")                                                |
| Egg time                                                | não mostrado    | `Breeding("TotalTimeForEgg",…)`                                                                                 | provada — 151 linhas, 0 "?"                     | `g-Breeding-TotalTimeForEgg-s0-0-0`, ⓘ 31/37                                                                                                   |
| Egg capacity                                            | não mostrado    | `Breeding("TotalEggCapacity",…)`                                                                                | provada — 2 linhas, 0 "?"                       | `n-…TotalEggCapacity`; o modo `"UsingEggInv"` conta os ovos ocupados (candidata)                                                               |
| Breedability speed                                      | não mostrado    | `Breeding("BreedabilitySpdMulti",…)`                                                                            | provada — 84 linhas, 1 "?"                      | "?" = `Star signs: 57a`                                                                                                                        |
| Shiny level speed                                       | não mostrado    | `Breeding("ShinySpdMulti",…)`                                                                                   | provada — 418 linhas, 1 "?"                     | "?" = `Star signs: 57b`                                                                                                                        |
| New species chance (per pet)                            | não mostrado    | `Breeding("TotalBreedChance","0",w,p)`                                                                          | candidata                                       | a tela chama com mundo e pet; soma das cozinhas (`PetszzBrTOTALKITCHEN`) montada no próprio bloco, × `BaseBreedChance` × `1stMulti`…`5thMulti` |
| Base breed chance and its 5 multipliers                 | alimenta        | `Breeding("BaseBreedChance"/"1stMulti"…"5thMulti","0",w,p)`                                                     | candidata                                       | a tela mostra "1 in N" e os multiplicadores; a árvore mostraria de onde vêm                                                                    |
| Pets per breed                                          | não mostrado    | `Breeding("PetQTYonBreed",…)`                                                                                   | candidata                                       |                                                                                                                                                |
| Genetics cost                                           | não mostrado    | `Breeding("GeneticCost","0",w,p)`                                                                               | candidata                                       | custo exato do próximo gene                                                                                                                    |
| Next pet upgrade cost (2 moedas)                        | não mostrado    | `Breeding("PetUpgCostREAL","0",k,0\|1)`                                                                         | candidata                                       | custo do próximo nível; `0` e `1` são as duas moedas                                                                                           |
| Pet upgrade max level                                   | não mostrado    | `Breeding("PetUpgMaxLV","0",k,0)`                                                                               | candidata                                       | teto (o `OnPlayStart2` corta o nível acima dele)                                                                                               |
| Fenceyard / battle slots                                | não mostrado    | `Breeding("FenceYardSlots")`, `("PetBattleSlots")`                                                              | candidata                                       |                                                                                                                                                |
| Genetics per trashed pet                                | não mostrado    | `Breeding("GeneticsPerTrashPet","0",0,0)`                                                                       | candidata                                       |                                                                                                                                                |
| Special passives over level 20                          | não mostrado    | `Breeding("SpecialzOverLVL","0",0,0)`                                                                           | candidata                                       | multiplica o dano do pet e o Shiny                                                                                                             |
| Crystal mob drop multi                                  | alimenta        | `Breeding("crystalmob_DropMulti",tipo,0,0)`                                                                     | candidata                                       | arg = tipo do monstro (enumerável)                                                                                                             |
| Pets found                                              | alimenta        | `Breeding("TotPetsFound")`                                                                                      | candidata                                       | entra no Mainframe 0                                                                                                                           |
| Breeding EXP multiplier                                 | stat do sistema | `ExpMulti(11)` → `skillstats2 BreedingEXPmulti`                                                                 | gravada sem conta                               | `any\rec\g-ExpMulti-11.json` (12,9 MB), sem página                                                                                             |
| Territory trekking per hour / requirement / fight power | não mostrado    | `PetStuff("TotalTrekkingHR"/"TotalTrekkingREQ"/"TotalTrekkingFightPOW"/"TotalTrekkingFightPowREQ", território)` | candidata                                       | lê `Pets` e `Breeding`, não o ator da tela                                                                                                     |
| Pet fight stats (HP, damage, crit, block)               | não mostrado    | `PetStuff("TotalHP"/"TotalDMG"/"CritChance"/"BlockChance",…,slot)`                                              | precisa do jogo vivo                            | lê o time em `PixelHelperActor[22]` (ator 548) `_GenINFO[22]`                                                                                  |
| Days until next species                                 | não mostrado    | —                                                                                                               | sem bloco                                       | = tempo de ovo ÷ chance: conta à mão                                                                                                           |

## 2. Cooking (Meals, Kitchens, Mastery, Ribbons)

**Tela no app:** própria — `Cooking`, `Dinner Menu`.

| Árvore                                  | Tipo            | Chamada do jogo                                                                 | Estado                                  | Nota                                                                                     |
| --------------------------------------- | --------------- | ------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cooking bonuses                         | sistema         | `MealBonus(key)`, `Summoning2("BonusAmountcook"…)`, `Summoning("RibbonBonus"…)` | provada — 1190 linhas, 0 "?", ⓘ 278/281 | página `cooking.html`, 70 membros                                                        |
| Meal bonus by stat                      | stat do sistema | `MealBonus("TotDmg"…)`                                                          | provada — 952 linhas, 0 "?"             | `h-MealBonus-TotDmg`: 197 linhas, 0 "?"; subsistema "keys no meal gives" com valor 0     |
| Cooking mastery bonuses                 | stat do sistema | `Summoning2("BonusAmountcook",k,99)`                                            | provada — 44 linhas, 0 "?"              |                                                                                          |
| Mastery EXP rate / EXP required         | não mostrado    | `Summoning2("ExpRateCook",0,0)`, `("ExpReqCook",0,0)`                           | provada — 136 + 10 linhas, 0 "?"        | dentro da página (2 ramos sem ⓘ)                                                         |
| Mastery points left                     | não mostrado    | `Summoning2("PtsLeftCook_P"/"PtsLeftCook_Y")`                                   | candidata                               |                                                                                          |
| Mastery rank requirement                | não mostrado    | `Summoning2("RankREQcook",…)`                                                   | candidata                               |                                                                                          |
| Mastery multiplier                      | alimenta        | `Summoning2("BonusMultiCook",…)`                                                | candidata                               |                                                                                          |
| Mastery unlocked                        | alimenta        | `Summoning2("isMasteryUnlocked")`                                               | candidata                               | Condição: Rift > 58 ou companheiro 87                                                    |
| Ribbon bonus by tier                    | stat do sistema | `Summoning("RibbonBonus",tier,0)`                                               | provada — 37 linhas, 0 "?"              |                                                                                          |
| Ribbon max level                        | não mostrado    | `CookingR("RibbonsMaxLV")`                                                      | candidata                               | teto                                                                                     |
| Meal cooking speed (kitchen)            | não mostrado    | `CookingR("CookingSPEED",k,0)`                                                  | provada — 686 linhas, 20 "?" (1 prog)   | `g-CookingR-CookingSPEED-0-0`; "?" = `Cooking[0][6]`, "Menagerie unlock 8 ≥ 1", "Part N" |
| Recipe (fire) speed                     | não mostrado    | `CookingR("CookingFIRE",k,0)`                                                   | provada — 346 linhas, 4 "?" (1 prog)    | "?" = `Cooking[0][6..8]` (níveis da cozinha sem tipo)                                    |
| Cooking luck                            | não mostrado    | `CookingR("CookingLUCK",k,0)`                                                   | provada — 7 linhas, 1 "?"               | "?" = `Cooking[0][8]`                                                                    |
| New recipe odds                         | não mostrado    | `CookingR("CookingNewRecipeOdds",k,…)`                                          | provada — 3 linhas, 0 "?"               | gravada com arg 0,0 (valor 1): precisa do arg da cozinha real                            |
| Meal max level                          | não mostrado    | `CookingR("CookingMealMaxLVlol",…)`                                             | provada — 14 linhas, 0 "?"              | teto de 5 fontes                                                                         |
| Meal bonus multiplier                   | alimenta        | `CookingR("CookingMealBonusMultioo")`                                           | candidata                               | a tooltip do jogo mostra linha sem multiplicador                                         |
| Next meal level cost                    | não mostrado    | `CookingR("CookingMenuMealCosts",meal)`                                         | candidata                               | custo exato do próximo nível                                                             |
| Kitchen upgrade cost (spice and amount) | não mostrado    | `CookingR("CookingUpgSpiceCostType"/"CookingUpgSpiceCostQty",k,upg)`            | candidata                               |                                                                                          |
| New kitchen cost                        | não mostrado    | `CookingR("CookingNewKitchenCoinCost")`                                         | candidata                               |                                                                                          |
| Fire required per recipe                | não mostrado    | `CookingR("CookingFireREQ"/"CookingFireREQlv"/"CookingFireREQlvMULTI")`         | candidata                               |                                                                                          |
| Can cook / recipe requirement           | não mostrado    | `CookingR("CookingReqToCook",…)`                                                | candidata                               |                                                                                          |
| Possible recipes with these spices      | não mostrado    | `CookingR("PossibleRecipes2",k)`                                                | candidata                               | devolve lista (painel, não árvore); `PossibleRecipes` sem arg lê o ator 510 (jogo vivo)  |
| Cooking efficiency                      | stat do sistema | `skillstats2 CookingEfficiency`                                                 | provada — 1744 linhas, 4 "?" (7 prog)   | `g-SkillStats-CookingEfficiency`; "?" = `OptionsListAccount[422]/[180]` e passo anterior |
| Base ladles per day                     | não mostrado    | `skillstats2 CookingBaseLadlePerDay`                                            | provada — 1789 linhas, 4 "?" (7 prog)   | mesmos "?"                                                                               |
| Cooking AFK rate                        | stat do sistema | `AFKgainrates("Cooking")`                                                       | provada — 1046 linhas, 1 "?" (11 prog)  |                                                                                          |
| Cooking EXP multiplier                  | stat do sistema | `ExpMulti(10)` → `skillstats2 CookingEXPmulti`                                  | gravada sem conta                       | `g-ExpMulti-10.json` 16,1 MB, sem página                                                 |
| Hours to next meal level                | não mostrado    | —                                                                               | sem bloco                               | = custo ÷ velocidade: conta à mão                                                        |

## 3. Laboratory (Mainframe, Jewels, Chips, conexões)

**Tela no app:** própria — `Lab`, `Lab › Mainframe`, `Lab › Console`, `Chip Repository`.

| Árvore                          | Tipo            | Chamada do jogo                            | Estado                                 | Nota                                                                                            |
| ------------------------------- | --------------- | ------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Laboratory bonuses              | sistema         | `MainframeBonus(n)`, `chipBonuses(key)`    | provada — 248 linhas, 1 "?", ⓘ 59/60   | página `laboratory.html`, 64 membros                                                            |
| Mainframe bonuses               | stat do sistema | `MainframeBonus(0..)`                      | provada — 107 linhas, 0 "?"            | `h-MainframeBonus-9`: 20 linhas; a leitura `@read DNSM.LabMFbonuses` dá 1 "?" (passo anterior)  |
| Jewels                          | stat do sistema | `MainframeBonus(100+)`                     | provada — 111 linhas, 0 "?"            |                                                                                                 |
| Chips                           | stat do sistema | `chipBonuses(key)`                         | provada — 24 linhas, 1 "?"             | "?" = `Crys`; cache `ChipBbonusz` montado por `ActionBlock("RecalcChipBonuses")` por personagem |
| Connection radius per character | não mostrado    | `Labb("Dist", jogador\|"Gem"\|"Bonus", i)` | candidata                              | raio real; casos fixos por joia                                                                 |
| Line width                      | não mostrado    | `Labb("BonusLineWidth")`                   | candidata                              |                                                                                                 |
| Who is connected to whom        | não mostrado    | `Labb("Player",…)`                         | precisa do jogo vivo                   | depende da posição na grade; o catálogo marca a posição como "da sessão" `[?]`                  |
| Bubonic links (green/purple)    | alimenta        | `Labb("BubonicGreen"/"BubonicPurple")`     | candidata                              | liga Lab e Divinity                                                                             |
| Chip / jewel repository         | não mostrado    | `Labb("ChipRepoCHIP"/"ChipRepoJEWEL")`     | candidata                              | conferir o que devolve antes de gravar                                                          |
| Gene spiral quantity            | alimenta        | `Labb("GeneSpiralQTY")`                    | candidata                              |                                                                                                 |
| Laboratory efficiency           | stat do sistema | `skillstats2 LaboratoryEfficiency`         | provada — 1539 linhas, 4 "?" (7 prog)  | `g-SkillStats-LaboratoryEfficiency`                                                             |
| Laboratory AFK rate             | stat do sistema | `AFKgainrates("Laboratory")`               | provada — 1000 linhas, 1 "?" (11 prog) |                                                                                                 |
| Laboratory EXP multiplier       | stat do sistema | `ExpMulti(12)` → `LaboratoryEXPmulti`      | gravada sem conta                      | `g-ExpMulti-12.json` 15,8 MB, sem página                                                        |
| Sigil charge speed              | não mostrado    | `Labb("SigilBonusSpeed","Blank",0,0)`      | provada — 150 linhas, 0 "?"            | `g-Labb-SigilBonusSpeed`; Sigils mora na página `alchemy`                                       |
| Sigil bonus                     | stat do sistema | `Labb("SigilBonus","Blank",n,0)`           | provada — 19 linhas, 0 "?"             | `h-Labb-SigilBonus-Blank-3-0`                                                                   |
| Hours to next sigil tier        | não mostrado    | —                                          | sem bloco                              | limiar de `SigilDesc` ÷ velocidade: conta à mão                                                 |

## 4. Cape Vines

**Tela no app:** própria — `The Cape Vine`.

| Árvore                       | Tipo            | Chamada do jogo                                                                                         | Estado                               | Nota                                                                                           |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Cape Vine bonuses            | sistema         | `Gallery("CapevineBonusMulti",n,0)`, `Stuff2("GoldCapeVinesOwned")`, `Gallery("InitializeCapeBonuses")` | provada — 113 linhas, 2 "?", ⓘ 29/29 | página `cape-vines.html`, 26 membros; "?" = "Value from an earlier step" (vinhas 0 e 7)        |
| Golden vines owned           | stat do sistema | `Stuff2("GoldCapeVinesOwned",0,0)`                                                                      | provada — 4 linhas, 0 "?"            |                                                                                                |
| Next golden vine requirement | não mostrado    | —                                                                                                       | sem bloco                            | `1000 + 500 × OptionsListAccount[669]` só existe nos eventos `_event_11/_event_12` do ator 713 |

## 5. Tome

**Tela no app:** própria — `The Tome`.

| Árvore                    | Tipo            | Chamada do jogo                   | Estado                               | Nota                                                                                                                      |
| ------------------------- | --------------- | --------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Tome bonuses              | sistema         | `Summoning("TomeBonus",k,0)`      | provada — 151 linhas, 0 "?", ⓘ 42/44 | página `tome.html`, 8 membros; 2 ramos sem ⓘ no "Tome Bonus 3"                                                            |
| Points per Tome line      | não mostrado    | `Summoning("TomePTS",linha,0)`    | candidata                            | pontos exatos de cada linha                                                                                               |
| Fill of each Tome line    | alimenta        | `Summoning("TomePCT",linha,0)`    | candidata                            |                                                                                                                           |
| Level that unlocks a line | não mostrado    | `Summoning("TomeLvReq",linha,0)`  | candidata                            | fórmula fechada                                                                                                           |
| Total Tome points         | stat do sistema | `DNSM.TomeQTYtot`                 | sem bloco                            | soma montada no evento `_customEvent_TomeQTY` do ator 229; dá para mostrar como soma das `TomePTS`                        |
| Tome wish chance          | não mostrado    | `Thingies("TomeWish_chance",0,0)` | candidata                            | lê o ator 229 (`PixelHelperActor[4]`), que a gravação do TomeBonus já tem; o "pity" é `OptionsListAccount[490]` (leitura) |

## 6. Rift

**Tela no app:** nenhuma (o catálogo diz "sem janela mapeada"; nenhuma regra do app reconhece o Rift).

| Árvore                                         | Tipo            | Chamada do jogo                                                                                                | Estado                                               | Nota                                               |
| ---------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Rift bonuses                                   | sistema         | `RiftStuff("RiftSkillBonus,k",rank)`, `RiftStuff("RiftSkillETC",n)`, `WorkbenchStuff("ConstMasteryBonus",k,0)` | provada — 969 linhas, 0 "?" (5 prog), ⓘ 174/174      | página `rift.html`, 145 membros                    |
| Skill Mastery (rank of each skill)             | stat do sistema | `RiftStuff("RiftSkillBonus,k",rank)`                                                                           | provada — 886 linhas, 0 "?"                          |                                                    |
| Skill Mastery totals                           | stat do sistema | `RiftStuff("RiftSkillETC",n)`                                                                                  | provada — 44 linhas, 0 "?"                           |                                                    |
| Construct Mastery                              | stat do sistema | `WorkbenchStuff("ConstMasteryBonus",k,0)`                                                                      | provada — 38 linhas, 0 "?"                           |                                                    |
| Next Rift monster HP                           | não mostrado    | `RiftStuff("mobHP")`                                                                                           | candidata                                            | fórmula fechada de `Rift[0]`                       |
| Current task / monster                         | não mostrado    | `RiftStuff("Task")`, `("Mob")`                                                                                 | candidata                                            | leitura de tabela (árvore curta)                   |
| Rift reward unlocked                           | alimenta        | `RiftStuff("riftBonus",nome)`                                                                                  | candidata                                            | Condição por nível                                 |
| Skill level ranks                              | alimenta        | `RiftStuff("skillLvRanks",…)`                                                                                  | candidata                                            |                                                    |
| Gilded stamp chance                            | não mostrado    | `RiftStuff("gildedStampChance")`                                                                               | candidata                                            | vai para o painel de Stamps                        |
| Rift monster respawn                           | alimenta        | `RiftStuff("mobRespBase")`                                                                                     | candidata                                            |                                                    |
| Eclipse skulls / Killroy damage / 5-star cards | alimenta        | `RiftStuff("eclipseSkulls"/"KillroyDMG"/"5starCards")`                                                         | provada — 5 / 46 linhas (Death Note, Killroy), Cards | moram nas páginas `death-note`, `killroy`, `cards` |

## 7. The Hole (13 subsistemas + cavernas de coleta)

**Tela no app:** própria — `The Hole › Villagers` (`› Explorer`, `› Engineer`, `› Bonuses`, `› Measurements`, `› Study`), `The Well`, `Motherlode`, `The Den`, `Bravery`, `Justice`, `Wisdom`, `The Bell`, `The Harp`, `The Lamp`, `The Hive`, `Grotto`, `The Jars`, `Evertree`, `Gambit`, `Temple`, `Fountain`, `Trench`, `The Lair`. Majiks, Crystal Glunko Cove e Monuments não têm nome próprio no app (só do pai).

| Árvore                                                                                    | Tipo            | Chamada do jogo                                                                                                                                                                                                                                                              | Estado                                           | Nota                                                                                                                                                   |
| ----------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The Hole bonuses                                                                          | sistema         | `Holes(…)`, `Holes2(…)` (13 subsistemas)                                                                                                                                                                                                                                     | provada — 1819 linhas, **10 "?"**, ⓘ **391/497** | página `hole.html`, 381 membros, 22 pulados                                                                                                            |
| Schematic bonuses                                                                         | stat do sistema | `Holes("B_UPG",i,k)`                                                                                                                                                                                                                                                         | provada — 355 linhas, 0 "?"                      | 91 ramos sem ⓘ: cada esquema é só "construído ? k : 0" (Condição), sem conta                                                                           |
| Measurement bonuses                                                                       | stat do sistema | `Holes("MeasurementBonusTOTAL",n,0)`                                                                                                                                                                                                                                         | provada — 268 linhas, 0 "?"                      | `h-…MeasurementBonusTOTAL-2-0`: 25 linhas, 0 "?"; 1 ramo sem ⓘ                                                                                         |
| Monument bonuses (Bravery, Justice, Wisdom)                                               | stat do sistema | `Holes("MonumentROGbonuses",m,k)`, `("MonumentHRbonuses",m,k)`                                                                                                                                                                                                               | provada — 287 + 64 linhas, 0 "?"                 |                                                                                                                                                        |
| Majik bonuses                                                                             | stat do sistema | `Holes("CosmoBonusQTY",c,k)`                                                                                                                                                                                                                                                 | provada — 18 linhas, 0 "?"                       | 1 linha por membro; 16 pulados ("Confused_Bonus", placeholders)                                                                                        |
| Fountain upgrades                                                                         | stat do sistema | `Holes2("Fountain_BonTOT",w,k)`                                                                                                                                                                                                                                              | gravada sem conta                                | 61 linhas = 1 por membro: cache `FountBonT` sem BUILDER (cobertura H #54, qualidade P)                                                                 |
| Crystal Glunko Cove                                                                       | stat do sistema | `Holes2("Cglunko_DR"…)`, `("Cglunko_upgBon",n,0)`                                                                                                                                                                                                                            | provada — 164 linhas, **6 "?"**                  | "?" = `OptionsListAccount[654..657,664,665]` (estado sem tipo de folha), todos no "Cove: Drop Rarity multiplier"                                       |
| Bell bonuses                                                                              | stat do sistema | `Holes("BellBonuss",n,0)`                                                                                                                                                                                                                                                    | provada — 22 linhas, 0 "?"                       |                                                                                                                                                        |
| Harp string bonuses                                                                       | stat do sistema | `Holes("HarpStringLVbonus",n,0)`, `("HarpStringAllBonus",0,0)`                                                                                                                                                                                                               | provada — 39 linhas, **1 "?"**                   | "?" = `_GenINFO[128]` do ator 670 (lido do ator da caverna); 3 ramos sem ⓘ                                                                             |
| Lamp wish bonuses                                                                         | stat do sistema | `Holes("LampBonuses",w,k)`                                                                                                                                                                                                                                                   | provada — 48 linhas, 0 "?"                       |                                                                                                                                                        |
| Jar collectibles                                                                          | stat do sistema | `Holes2("JarCollectibleBonus",n,0)`                                                                                                                                                                                                                                          | provada — 144 linhas, 0 "?"                      | 2 pulados (valor 1, sem chamador)                                                                                                                      |
| Gambit bonuses                                                                            | stat do sistema | `Holes2("GambitBonuses",n,0)`                                                                                                                                                                                                                                                | provada — 233 linhas, **3 "?"**                  | "?" = "Value from an earlier step" no `GambitPtsREQ` do "Summoning Doublers"; 11 ramos sem ⓘ; 3 pulados                                                |
| Temple torch bonuses                                                                      | stat do sistema | `Holes2("TempleTorchBonuses",n,0)`                                                                                                                                                                                                                                           | provada — 20 linhas, 0 "?"                       |                                                                                                                                                        |
| Bolaia's Study bonuses                                                                    | stat do sistema | `Holes2("StudyBolaiaBonuses",n,0\|99)`                                                                                                                                                                                                                                       | provada — 82 linhas, 0 "?"                       |                                                                                                                                                        |
| Study to mushroom kills                                                                   | alimenta        | `Holes2("XtraMushKillz",0,0)`                                                                                                                                                                                                                                                | provada — 9 linhas, 0 "?"                        | página `the-hole-derived-bonuses`                                                                                                                      |
| Villager EXP per hour / EXP required                                                      | não mostrado    | `Holes("VillagerExpPerHour",v)`, `("VillagerExpREQ",v)`                                                                                                                                                                                                                      | candidata                                        | tempo até o próximo nível de cada aldeão                                                                                                               |
| Opals to invest / fewest opals                                                            | não mostrado    | `Holes("OpalsOwnedToInvest")`, `Holes2("LeastOpalsInVillager")`                                                                                                                                                                                                              | precisa do jogo vivo                             | o primeiro lê `_GenINFO[69]` do ator 670                                                                                                               |
| Schematic cost / schematics available                                                     | não mostrado    | `Holes("BuildCost",i)`, `("SchematicsAvailable")`, `("CanWeAffordCreate",i)`                                                                                                                                                                                                 | candidata                                        | custo exato do próximo esquema                                                                                                                         |
| Majik points left / enhance max level                                                     | não mostrado    | `Holes("CosmoPtsLeft")`, `("EnhanceMaxLV")`, `("CosmoUpgCoded")`                                                                                                                                                                                                             | candidata                                        |                                                                                                                                                        |
| Measurement cost / base / quantity found / multiplier                                     | não mostrado    | `Holes("MeasurementCost",n)`, `("MeasurementBaseBonus")`, `("MeasurementQTYfound")`, `("MeasurementMulti")`                                                                                                                                                                  | candidata                                        | o multiplicador vai até 5 e depois +8 por unidade                                                                                                      |
| Study rate / study requirement                                                            | não mostrado    | `Holes("BolaiaStudyRate")`, `Holes2("StudyReqForBolaia")`                                                                                                                                                                                                                    | candidata                                        |                                                                                                                                                        |
| Well: buckets, sediment cap, fill rate, opal cost                                         | não mostrado    | `Holes("BucketsOwned")`, `("SedimentMax")`, `("BucketFillRate",tipo)`, `("WellOpal_cost")`                                                                                                                                                                                   | candidata                                        | "balde cheio às…"                                                                                                                                      |
| Motherlode / Hive / Evertree layer requirement and efficiency                             | não mostrado    | `Holes("TotalOreREQ",caverna)`, `("MotherlodeEffBase")`                                                                                                                                                                                                                      | candidata                                        |                                                                                                                                                        |
| Monument AFK multiplier and its linear limit                                              | não mostrado    | `Holes("MonumentRewardMulti",m)`, `("MonumentRewardMulti_MaxLinearTime")`                                                                                                                                                                                                    | candidata                                        | o "joelho" do AFK                                                                                                                                      |
| Monument opal / blue chest chance                                                         | não mostrado    | `Holes("Bravery_OpalRewardChanceDEC"/"Bravery_BlueChestChanceDEC"/"Justice_*")`, `Holes2("Wisdom_OpalRewardChanceDEC")`                                                                                                                                                      | candidata                                        |                                                                                                                                                        |
| Bravery sword damage, swords, rerolls                                                     | não mostrado    | `Holes("Bravery_MinDMG"/"Bravery_MaxDMG"/"Bravery_SwordsOwned"/"MaxRerolls"/"MaxRevisions")`                                                                                                                                                                                 | candidata                                        | `Bravery_MaxDMG` multiplica por um `_GenINFO` do ator 670: conferir                                                                                    |
| Bravery monster HP / Wisdom attempts                                                      | não mostrado    | `Holes("Bravery_MonsterHP")`, `Holes2("W_attempts"/"W_timePerMatch"/"W_instamatches")`                                                                                                                                                                                       | precisa do jogo vivo                             | leem `_GenINFO[76]` / `[210]` do ator 670 (o minigame)                                                                                                 |
| Bell cost, new method odds, EXP per hour                                                  | não mostrado    | `Holes("BellCosts")`, `("BellMethodsNewODDS")`, `("BellExpPerHR",t)`, `("BellEXPreq")`                                                                                                                                                                                       | candidata                                        |                                                                                                                                                        |
| Harp string EXP required, new note cost, power per hour                                   | não mostrado    | `Holes("HarpStringExpREQ")`, `("HarpNewNote_Cost")`, `("HarpPOWperHR")`                                                                                                                                                                                                      | candidata                                        |                                                                                                                                                        |
| Harp notes produced / opal odds / EXP gain                                                | não mostrado    | `Holes("HarpNoteProduced")`, `("HarpOpalOdds")`, `("HarpEXPgain")`                                                                                                                                                                                                           | precisa do jogo vivo                             | leem `_GenINFO[112]`/`[128]` do ator 670; o EXP gain tem `randomFloat`                                                                                 |
| Lamp wish cost / wishes per day                                                           | não mostrado    | `Holes("LampWishCost")`, `("LampWishPerDay")`                                                                                                                                                                                                                                | candidata                                        |                                                                                                                                                        |
| Monarch HP / mushroom kills left                                                          | não mostrado    | `Holes("MonarchHP")`, `("MushKillsLeft")`, `("CanFightMatriarch")`                                                                                                                                                                                                           | candidata                                        |                                                                                                                                                        |
| Golden Hound next opal score                                                              | não mostrado    | `Holes("HoundNextOpalScoreReq")`                                                                                                                                                                                                                                             | candidata                                        |                                                                                                                                                        |
| Jar cost, production per hour, rupie value, opal / collectible / enchant chance           | não mostrado    | `Holes("JarNewJar_Cost")`, `("JarProductionPerHR")`, `("JarRupieValue")`, `("JarOpalChance")`, `("JarNewCollectibleChance")`, `("JarEnchantChance")`, `("JarProductionREQ")`                                                                                                 | candidata                                        | "esperar ou quebrar"                                                                                                                                   |
| Gambit points, multiplier, next requirement, doublers left                                | não mostrado    | `Holes2("GambitPts",c)`, `("GambitPTSmulti")`, `("GambitPtsREQ")`, `("Gambit_SummoningDoublersLeft")`                                                                                                                                                                        | provada (parcial)                                | `GambitPts`/`GambitPTSmulti`/`GambitPtsREQ` já aparecem dentro da árvore do Gambit com ⓘ; o `GambitPtsREQ` é onde estão os 3 "?"; doublers = candidata |
| Temple torch cost / extra torches                                                         | não mostrado    | `Holes2("TempleTorchCost",n)`, `("TempleExtraTorches")`                                                                                                                                                                                                                      | candidata                                        |                                                                                                                                                        |
| Fountain coin value, cap, bar speed, duck / lucky / royal chance, upgrade and marble cost | não mostrado    | `Holes2("Fount_CurrencyTotValue")`, `("MaxCoinz")`, `("FountainBar_Speed")`, `("FountainBar_ActiveSpdMulti")`, `("Fount_DuckChance")`, `("Fount_LuckyCoinChance")`, `("Fount_RoyalChance")`, `("Cost_FountainUPG")`, `("Fount_MarbleizeCost")`, `("Fountain_MarbleBonNEXT")` | candidata                                        | ~20 sub-casos; "transbordo da Fountain"                                                                                                                |
| Glunko upgrade cost and AFK gains                                                         | não mostrado    | `Holes2("Cglunko_upgCost",n)`, `("Cglunko_AFKgains")`, `("Cglunko_MKtier")`, `("Cglunko_Respawn")`                                                                                                                                                                           | candidata                                        |                                                                                                                                                        |
| Next opal anywhere / cavern overview                                                      | não mostrado    | —                                                                                                                                                                                                                                                                            | sem bloco                                        | junta taxas de 15+ cavernas: conta à mão                                                                                                               |

## 8. Amps (W5, The Den)

**Tela no app:** só do pai (`The Den`).

| Árvore                          | Tipo         | Chamada do jogo                                        | Estado                            | Nota                                                                                 |
| ------------------------------- | ------------ | ------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------ |
| Amp kill multiplier             | sistema      | `Holes("AmpMulti",0,0)`                                | provada — 31 linhas, 1 "?", ⓘ 4/5 | página `amps.html`; "?" = `HoleozDNamptot` (acumulador do laço "Amplifier Stackin'") |
| Amp stones owned / max          | não mostrado | `Holes("AmpStonesOwned")`, `("AmpStoneMAX")`           | candidata                         | teto                                                                                 |
| Amp debuff / fear max / MP cost | não mostrado | `Holes("AmpDebuff")`, `("FearMAX")`, `("MPcostboost")` | candidata                         | penalidade contra bônus                                                              |

## 9. Divinity (gods, links, Blessings)

**Tela no app:** própria — `Divinity`, `Divinity › Offerings`, `› Style Choices`, `› Divinity per Character`, `› Minor Link Bonus`.

| Árvore                                     | Tipo            | Chamada do jogo                                                    | Estado                                          | Nota                                                                                                                 |
| ------------------------------------------ | --------------- | ------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Divinity bonuses                           | sistema         | `Divinity("Bonus_Minor"…)`, `("Bonus_MAJOR"…)`, `("BlesssBonus"…)` | provada — 743 linhas, 5 "?" (6 prog), ⓘ 156/160 | página `divinity.html`, 30 membros                                                                                   |
| Minor link bonuses                         | stat do sistema | `Divinity("Bonus_Minor",-1,n)`                                     | provada — 216 linhas, 0 "?"                     | `h-Divinity-Bonus_Minor--1-2`: 30 linhas, 0 "?"                                                                      |
| Major link bonuses                         | stat do sistema | `Divinity("Bonus_MAJOR",char,god)`                                 | provada — 31 linhas, 0 "?"                      | só o personagem do retrato; por personagem = candidata (mesmo bloco)                                                 |
| Blessing bonuses                           | stat do sistema | `Divinity("BlesssBonus",god,0)`                                    | provada — 490 linhas, 5 "?"                     | todos no Nobisect: `OptionsListAccount[422]/[180]`, bolhas Void Vial e Spanish Sahara, passo anterior; 4 ramos sem ⓘ |
| Divinity points per hour                   | não mostrado    | `Divinity("DivPTSPerHr",0,0)`                                      | provada — 236 linhas, 0 "?"                     | `n-Divinity-DivPTSPerHr`                                                                                             |
| Divinity EXP per hour                      | não mostrado    | `Divinity("DivPerHr_EXP",0,0)`                                     | provada — 594 linhas, 0 "?" (1 prog)            |                                                                                                                      |
| Divinity multiplier                        | alimenta        | `Divinity("DivMultiTOTAL",0,0)`                                    | provada — 99 linhas, 0 "?"                      |                                                                                                                      |
| Is this character meditating               | alimenta        | `Divinity("DivPerHr",char)`                                        | candidata                                       | Condição (estilo 5, AFK em Divinity, Lab com Major…)                                                                 |
| Style level requirement                    | não mostrado    | `Divinity("StyleLvReq",t)`                                         | candidata                                       | fórmula fechada                                                                                                      |
| Blessing max level                         | não mostrado    | `Divinity("BlessingMaxLV",…)`                                      | candidata                                       | teto                                                                                                                 |
| Offering cost / offering odds              | não mostrado    | `Divinity("OfferingCost",…)`, `("OfferingOdds",…)`                 | candidata                                       | "oferta certa"                                                                                                       |
| Minor bonus per character / god multiplier | alimenta        | `Divinity("DivMinorBonus",…)`, `("DivMulti",…)`                    | candidata                                       |                                                                                                                      |
| W7 god chosen / pocket god                 | alimenta        | `Divinity("W7divChosen")`, `Holes("PocketDivOwned")`               | candidata                                       |                                                                                                                      |
| Divinity AFK rate                          | stat do sistema | `AFKgainrates("Divinity")`                                         | provada — 880 linhas, 1 "?" (7 prog)            | valor 1 no retrato                                                                                                   |
| Divinity EXP multiplier                    | stat do sistema | `ExpMulti(14)` → `SkillStats("DivinityEXPmulti")`                  | sem bloco                                       | o sub-caso não existe e cai no padrão (gravação de 862 B); a EXP real é `DivPerHr_EXP`                               |

## 10. Sailing (Artifacts, boats, captains, Slab)

**Tela no app:** própria — `Sailing`, `Sailing › Map`, `Sailing › Crew`, `The Slab`, `Captain Recruitment`.

| Árvore                                        | Tipo            | Chamada do jogo                                                               | Estado                                           | Nota                                                                                      |
| --------------------------------------------- | --------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Sailing bonuses                               | sistema         | `Sailing("ArtifactBonus"…)`, `("BoatSpeed"…)`, `("SlabboBonus"…)`…            | provada — 4229 linhas, 2 "?" (6 prog), ⓘ 618/694 | página `sailing.html`, 137 membros                                                        |
| Artifact bonuses                              | stat do sistema | `Sailing("ArtifactBonus",n,0)`                                                | provada — 1682 linhas, 2 "?"                     | "?" no Crystal Steak (passo anterior); 15 ramos sem ⓘ; `h-…ArtifactBonus-10-0`: 44 linhas |
| Artifact extra bonus (second form)            | stat do sistema | `Sailing("ArtifactBonus",n,1)`                                                | provada — 72 linhas, 0 "?"                       |                                                                                           |
| Boat speed                                    | stat do sistema | `Sailing("BoatSpeed",b,0)`                                                    | provada — 895 linhas, 0 "?"                      | 21 ramos sem ⓘ; `g-Sailing-BoatSpeed-0-0`: 374 linhas                                     |
| Artifact find multiplier per boat             | stat do sistema | `Sailing("BoatArtiMulti",b,0)`                                                | provada — 976 linhas, 0 "?"                      | 39 ramos sem ⓘ                                                                            |
| Cloud discover / Davey Jones                  | stat do sistema | `Sailing("CloudDiscoverBonus",b,0)`, `("DaveyJonesBonus",b,0)`                | provada — 155 + 61 linhas, 0 "?"                 |                                                                                           |
| Loot, Captain EXP and Sailing EXP multipliers | stat do sistema | `Sailing("LootMulti"/"CaptainEXPmulti"/"SailingExpMulti",0,0)`                | provada — 343 linhas, 0 "?"                      | também `n-*`: 190 / 233 / 156 linhas, 0 "?"                                               |
| Slab bonuses and multiplier                   | stat do sistema | `Sailing("SlabboBonus",k,0)`, `("SlabboBonus_AllMulti",0,0)`                  | provada — 39 linhas, 0 "?"                       |                                                                                           |
| Max chests                                    | não mostrado    | `Sailing("MaxChests",0,0)`                                                    | provada — 11 linhas, 0 "?"                       | teto 34                                                                                   |
| Minimum travel time                           | não mostrado    | `Sailing("Minimumtraveltime",0,0)`                                            | provada — 9 linhas, 0 "?" (1 prog)               |                                                                                           |
| Boat value (loot per trip)                    | não mostrado    | `Sailing("BoatValue",b,0)`                                                    | candidata                                        | usa `CaptBonusCalc`                                                                       |
| Captain bonus value                           | alimenta        | `CaptBonusCalc(tipo,capitão)`                                                 | candidata                                        | cache `CaptnBonuz`                                                                        |
| Artifact find chance (by rarity)              | não mostrado    | `Sailing("ArtifactChance",0\|1,0)` + `AncientChances`…`VerisimilitudeChances` | candidata                                        | depende do baú do topo (`SailChests[0]`)                                                  |
| Rare treasure chance                          | não mostrado    | `Sailing("RareTreasureChance",0,0)`                                           | candidata                                        |                                                                                           |
| Captain EXP required / EXP gain               | não mostrado    | `Sailing("CaptainExpReq",c,0)`, `("CaptainEXPgain",…)`                        | candidata                                        |                                                                                           |
| Boat upgrade cost                             | não mostrado    | `Sailing("BoatUpgCostType"/"BoatUpgCostQty",b,upg)`                           | candidata                                        | custo exato do próximo upgrade                                                            |
| Captain recruit cost                          | não mostrado    | `Sailing("BuyCaptainCost",0,0)`, `("BuyCaptainCostType",0,0)`                 | candidata                                        |                                                                                           |
| Gold bar conversion                           | não mostrado    | `Sailing("TreasureGoldBarConvert",tier,0)`                                    | candidata                                        |                                                                                           |
| Island distance                               | alimenta        | `Sailing("IslandDistance",i)`                                                 | candidata                                        | leitura de tabela                                                                         |
| Boat frame tier / captain and boat slots      | não mostrado    | `Sailing("BoatFrame",b)`, `("CaptainSlotsUnlocked")`, `("BoatSlotsUnlocked")` | candidata                                        | Tier por nível de upgrade                                                                 |
| Captain pedestal rolls                        | não mostrado    | `Sailing("CaptainPedastal*Gen")`                                              | sem bloco                                        | sorteio (`random`), não há número fixo para a árvore                                      |
| Chest pile full at…                           | não mostrado    | —                                                                             | sem bloco                                        | tempo de viagem × baús faltantes: conta à mão                                             |

## 11. Gaming (Super Bits, Palette, Sprouts, Rat, Snail)

**Tela no app:** própria — `Gaming`, `Gaming › Log Book`.

| Árvore                                   | Tipo            | Chamada do jogo                                                                                                     | Estado                                          | Nota                                                                            |
| ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Gaming bonuses                           | sistema         | `GamingStatType("SuperBitType"/"MSA_Bonus"/"PaletteBonus",n,0)`                                                     | provada — 551 linhas, 0 "?" (1 prog), ⓘ 167/167 | página `gaming.html`, 114 membros, 7 pulados (Super Bits e cores "Nothing yet") |
| Super Bits                               | stat do sistema | `GamingStatType("SuperBitType",n,0)`                                                                                | provada — 70 linhas, 0 "?"                      | a folha "tem a letra em `Gaming[12]`" vira Bônus cru (cobertura H, achado C)    |
| MSA bonuses                              | stat do sistema | `GamingStatType("MSA_Bonus",n,0)`                                                                                   | provada — 51 linhas, 0 "?"                      |                                                                                 |
| Palette colours / total                  | stat do sistema | `GamingStatType("PaletteBonus",n,0)`                                                                                | provada — 421 + 4 linhas, 0 "?"                 |                                                                                 |
| Gaming EXP %                             | stat do sistema | `GamingStatType("GamingExpPCT",0,0)`                                                                                | provada — 354 linhas, 0 "?"                     | `n-*`                                                                           |
| Sprout growth time                       | não mostrado    | `GamingStatType("SproutGrowthTime",0,0)`                                                                            | provada — 62 linhas, 0 "?"                      | `n-*`                                                                           |
| Sprout value                             | não mostrado    | `GamingStatType("SproutValueTOTAL",s)`, `("SproutValueBase")`, `("SproutValueNonPlantMulti")`                       | candidata                                       | por planta (`GamingSprout[s]`)                                                  |
| Mutation / evolution chance              | não mostrado    | `GamingStatType("NewMutantChanceDEC")`, `("SproutGrowthCHANCE")`, `("SproutGrowthCHANCEperMUT")`                    | candidata                                       |                                                                                 |
| Sprout max evolution / capacity          | não mostrado    | `GamingStatType("SproutMaxEvo")`, `("SproutCapacity")`                                                              | candidata                                       | teto                                                                            |
| Fertilizer upgrade cost                  | não mostrado    | `GamingStatType("FertilizerUpgCosts",k)`                                                                            | precisa do jogo vivo                            | expoente de `getServerVarLoad("GamingFertCostExpA")` (variável do servidor)     |
| Mutate / Super Bit / box cost            | não mostrado    | `GamingStatType("MutateUpgCosts")`, `("SuperbitCost",n)`, `("BoxCost")`                                             | candidata                                       |                                                                                 |
| Palette luck, level-up and unlock chance | não mostrado    | `GamingStatType("PaletteLuck")`, `("LVupChance")`, `("PalUnlockChance")`, `("ExtraLuckFromEvo")`                    | candidata                                       |                                                                                 |
| King Rat crown odds, currency gain, shop | não mostrado    | `GamingStatType("RatCrownOdds")`, `("RatCurrencyGain")`, `("RatShopCost")`, `("RatShopBonuses")`, `("RatBitMulti")` | candidata                                       |                                                                                 |
| Snail                                    | não mostrado    | `GamingStatType("SnailStuff",…)`, `("MaxSnailLV")`                                                                  | candidata                                       | risco do caracol                                                                |
| Import items (diminishing return)        | não mostrado    | `GamingStatType("ImportItemBonus",n)`, `("ImportItemCOST",n)`                                                       | candidata                                       | expoentes 0,75 / 0,44 / 0,85                                                    |
| Acorn shop / Log Book bits               | não mostrado    | `GamingStatType("AcornShopCost"/"AcornShopBonus"/"LogBookBitBonus")`                                                | candidata                                       |                                                                                 |

---

## Totais por estado (linhas das tabelas acima)

| Estado               | Linhas                                     |
| -------------------- | ------------------------------------------ |
| provada              | 77 (inclui 1 "provada (parcial)": Gambit)  |
| gravada sem conta    | 4 (ExpMulti 10, 11, 12; Fountain upgrades) |
| candidata            | 87                                         |
| sem bloco            | 9                                          |
| precisa do jogo vivo | 6                                          |
| **total**            | **183**                                    |

Por sistema (provadas / candidatas): Breeding 8/14, Cooking 13/12, Laboratory 8/5, Cape Vines 2/0, Tome 1/4, Rift 5/6, Hole 15/19, Amps 1/2, Divinity 8/6, Sailing 10/10, Gaming 6/9. (As candidatas da Hole e do Gaming agrupam vários sub-casos por linha: a Hole tem ~85 sub-casos candidatos nos blocos `Holes` (105 sub-casos) e `Holes2` (68); o Gaming, ~30 dos 44 de `GamingStatType`.)

## Os 5 achados mais importantes

1. **O "?" da Hole está em 3 lugares, e não onde parecia.** A página tem 10 "?" reais: 6 no Crystal Glunko Cove ("Cove: Drop Rarity multiplier", leituras `OptionsListAccount[654..657,664,665]` sem tipo de folha), 1 na Harp ("All strings": `_GenINFO[128]` do ator 670, só existe com a caverna carregada) e 3 no Gambit ("Summoning Doublers", três "Value from an earlier step" dentro do `GambitPtsREQ`). O número que assusta é outro: **106 ramos sem ⓘ** (91 nos Schematics, 11 no Gambit, 3 na Harp, 1 nas Measurements). Os 91 dos Schematics são honestos: cada esquema é só "construído ? k : 0". Fora isso, a **Fountain** é a parte fraca: 61 linhas, uma por membro, porque o cache `FountBonT` não tem BUILDER. E 22 membros pulados (16 Majiks "Confused_Bonus", 3 Gambit, 2 Jars, 1 Cove).
2. **A Hole é a maior mina de "não mostrado".** `Holes` + `Holes2` têm 173 sub-casos, e só ~15 viraram árvore. Custo, teto, chance e taxa por hora de quase todas as cavernas (Villager EXP/h, BuildCost, BucketFillRate, SedimentMax, MonumentRewardMulti e o limite linear dele, JarProductionPerHR, Fount_CurrencyTotValue, MaxCoinz, TempleTorchCost, MonarchHP…) são blocos de verdade com argumento enumerável. O limite: uns 10 sub-casos (Harp notes e opal odds, Bravery HP, Wisdom attempts, opals para investir) leem o ator 670 e precisam do jogo vivo.
3. **Os stats de skill dos Mundos 4 e 5 já estão quase todos provados.** São páginas `n-`/`g-` novas, que a STAT-MATRIX das 14h ainda dava como "missing": egg time, egg capacity, breedability e shiny speed, cooking speed, fire, luck e max level, Div pts/h, Div EXP/h, DivMulti, loot, captain e sailing EXP, max chests, min travel, Gaming EXP, sprout growth. Faltam só as páginas de `ExpMulti 10/11/12`: as gravações existem, de 13 a 16 MB. E `ExpMulti 14` (Divinity) não serve, porque cai no valor padrão.
4. **Custo exato do próximo nível existe como bloco em quase todo sistema**, como no exemplo combinado de Stamps: `PetUpgCostREAL`, `GeneticCost`, `CookingMenuMealCosts`, `CookingUpgSpiceCostQty`, `BoatUpgCostQty`, `BuyCaptainCost`, `OfferingCost`, `BuildCost`, `MeasurementCost`, `BellCosts`, `TempleTorchCost`, `Cglunko_upgCost`, `SuperbitCost`. Também há tetos e chances: `PetUpgMaxLV`, `RibbonsMaxLV`, `CookingMealMaxLVlol` (já provada), `BlessingMaxLV`, `MaxChests` (provada), `TotalBreedChance`, `ArtifactChance`, `OfferingOdds`, `JarEnchantChance`. Exceções que não servem: a próxima vinha dourada (só em evento de tela) e o total do Tome (soma num evento).
5. **Tela sem árvore e árvore sem tela.** O Rift tem página provada (969 linhas, 0 "?"), mas o app não reconhece tela de Rift. Pet Arena, Majiks, Glunko Cove e Monuments só aparecem pela tela do pai. Ao contrário, o app reconhece Well, Motherlode, Hive, Evertree, Trench, Lair, Den e Grotto, que não têm árvore de sistema: só os candidatos "não mostrado" acima. Os poucos que precisam do jogo vivo (luta dos pets, conexões do Lab, notas da Harp) são justamente telas que o app já reconhece, então dá para ler o ator nelas.

---

# Frente 5: sistemas dos mundos 6 e 7 e tardios: que árvores dá para fazer

Pesquisa só de leitura, 12/11/2026. Fontes: índice das páginas de sistema (`systems\pages\index.html`, BASELINE-3.1), os dados de cada página (`systems\data\<id>-data.json`, contados por subsistema), as auditorias das árvores de stat e cobertura (`any\data\*-audit.json`), o catálogo `telas-mundos-6-7-e-tardios.md`, as telas que o app reconhece (`src\shared\screens\rules\*.json`) e o njs-index (`block` para a lista de sub-casos de 15 blocos, `callees` e `search_code` para conferir leituras).

Como ler as colunas:

- **Tipo**: `sistema` = de onde vêm os bônus do sistema; `stat do sistema` = número que o sistema calcula e que o jogo mostra (ou mostra em parte); `não mostrado` = número que o jogo calcula e não mostra (custo, teto, chance, tempo, taxa); `alimenta` = o bônus do sistema como chega em outro número.
- **Estado**: `provada (L l., Q ?)` = gravada, montada e com valor conferido, com L linhas e Q folhas "?" (o progresso de laço vem à parte, quando há); `gravada sem conta` = grava e dá o valor, mas a árvore não abre a conta (folha única ou cache sem BUILDER); `candidata` = o sub-caso existe no N.js (conferido no njs-index), nunca foi gravado, e é conta pura sobre o estado; `sem bloco` = a conta vive num handler de evento ou no motor da luta, não num `_customBlock_` (precisaria de conta à mão, não serve); `precisa do jogo vivo` = lê o estado da tela aberta (`PixelHelperActor[...]._GenINFO`), o mapa atual ou uma variável de servidor.
- Linhas e "?" das páginas de sistema vêm do índice; os dos subsistemas, da contagem nos dados (podem diferir em 1 ou 2 da página, por causa da raiz). Os de stat vêm do audit (o "?" do audit inclui o progresso quando há; o progresso está dito à parte).

Observação geral: as folhas "?" das árvores de stat desta frente são quase todas leituras de estado sem nome (`Spelunk[i][j]`, `OptionsListAccount[i]`, `FarmCrop[i]`), mapas de trabalho (`DNSM.NJbonusMap0/1`, `DNSM.NjaDN3/4`) ou o estado da tela aberta (`_GenINFO`). O valor está certo; falta o nome.

---

## Summoning (W6)

Tela no app: própria (`Summoning Upgrades`, `Summoner's Table`). A arena da luta (tela 59) não está nas regras do app.

| Árvore                            | Tipo            | Chamada do jogo                                                                  | Estado                             | Nota                                                |
| --------------------------------- | --------------- | -------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Summoning bonuses                 | sistema         | página `summoning` (Winner bonuses + Summoning upgrades + Stone trials)          | provada (1182 l., 1 ?)             | o "?" é o acumulador `DNSM.SummWinBonus`            |
| Winner bonuses (32 slots)         | sistema         | `Summoning("WinBonus", 0..31, 0)`                                                | provada (696 l., 1 ?)              | inclui a parte do gem shop                          |
| Summoning upgrades                | sistema         | `Summoning("SummUpgBonus", 0..81, 0)`                                            | provada (469 l., 0 ?)              |                                                     |
| Stone trials                      | sistema         | `Thingies("SumStoneTrialz", t, 0)`                                               | provada (11 l., 0 ?)               |                                                     |
| Summoning EXP gain                | stat do sistema | `Summoning("SummEXPgain", 0, 0)`                                                 | provada (340 l., 2 ?, 1 progresso) |                                                     |
| Unit damage                       | stat do sistema | `Summoning("UnitDMG", -1, 0)`                                                    | provada (195 l., 5 ?)              | 4 "?" são `_GenINFO` do ator da arena               |
| Unit HP                           | stat do sistema | `Summoning("UnitHP", -1, 0)`                                                     | provada (50 l., 3 ?)               |                                                     |
| Unit speed                        | stat do sistema | `Summoning("UnitSpd", 0, 0)`                                                     | provada (15 l., 0 ?)               |                                                     |
| Mana regen                        | stat do sistema | `Summoning("ManaRegen", 0, 0)`                                                   | provada (33 l., 3 ?)               | os 3 "?" são `_GenINFO` da arena                    |
| Max mana                          | stat do sistema | `Summoning("MaxMana", 0, 0)`                                                     | provada (5 l., 1 ?)                | curva 20×1,5^n                                      |
| Starting mana                     | stat do sistema | `Summoning("ManaStart", 0, 0)`                                                   | candidata                          |                                                     |
| Unit dodge                        | stat do sistema | `Summoning("UnitDODGE", t, 0)`                                                   | candidata                          |                                                     |
| Next upgrade cost                 | não mostrado    | `Summoning("UpgCost", t, 0)`                                                     | candidata                          | custo exato do próximo nível                        |
| Unit cost                         | não mostrado    | `Summoning("UnitCost", t, 0)`                                                    | candidata                          |                                                     |
| Reroll cost                       | não mostrado    | `Summoning("RerollCost", n, 0)`                                                  | candidata                          | floor(5×n×1,2^n)                                    |
| Unit draw odds                    | não mostrado    | `Summoning2("UnitTypeDraw", t, 0)`                                               | candidata                          | 7 % / 4 % / 5 % de base                             |
| Enemy damage / HP / speed         | não mostrado    | `Summoning2("EnemyDMG"/"EnemyHP"/"EnemySpd", d, 0)`                              | candidata                          | 1,11^dificuldade                                    |
| Opponent difficulty               | não mostrado    | `Summoning2("OpponentDifficulty", t, 0)`                                         | candidata                          |                                                     |
| Essence per hour (per stone)      | não mostrado    | `Summoning2("SummRockEssGen", t, 0)`                                             | candidata                          | taxa por hora de cada cor                           |
| Endless next-wave modifier        | não mostrado    | `Summoning("EndlessModifierID", w, 0)`                                           | candidata                          | e `EndlessUnlocked`                                 |
| Total victories                   | não mostrado    | `Summoning("SummVictories", t, 0)`                                               | candidata                          | contagem                                            |
| Spike placement damage            | não mostrado    | `Summoning("SpikePlacementDMG", ...)`                                            | precisa do jogo vivo               | depende da posição na arena (não conferido a fundo) |
| Fight win chance                  | não mostrado    | —                                                                                | sem bloco                          | é o motor da luta, não um sub-caso                  |
| Winner bonuses → Drop Rate, meals | alimenta        | `Summoning("WinBonus", ...)` dentro de `TotalStats("Drop_Rarity")` e `MealBonus` | provada (na árvore do Drop Rate)   |                                                     |

## Farming (W6): plantações, Land Rank, Crop Depot, Market

Tela no app: própria (`Farming`, `Farming Market` com `Day Market`, `Night Market`, `Crop Depot`, `Exotic Market`, `Sticker Depot`).

| Árvore                                              | Tipo            | Chamada do jogo                                                                           | Estado                           | Nota                                                                                        |
| --------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| Farming bonuses                                     | sistema         | página `farming`                                                                          | provada (723 l., 0 ?)            |                                                                                             |
| Land Rank upgrades                                  | sistema         | `FarmingStuffs("LankRankUpgBonus", 0..19, 0)`                                             | provada (296 l., 0 ?)            |                                                                                             |
| Crop Depot bonuses + multi                          | sistema         | `FarmingStuffs("CropSCbonus", 0..9, 0)`, `("CropSCbonMulti", 0, 0)`                       | provada (106 l., 0 ?)            | portão do Jade Emporium em cada bônus                                                       |
| Exotic Market upgrades                              | sistema         | `FarmingStuffs("ExoticBonusQTY", 0..58, 0)`                                               | provada (316 l., 0 ?)            |                                                                                             |
| Crop growth rate                                    | stat do sistema | `FarmingStuffs("GrowthRate", 0, 0)`                                                       | provada (76 l., 2 ?)             | "?" = `_GenINFO`                                                                            |
| Crop evolution chance                               | stat do sistema | `FarmingStuffs("NextCropChance", 99, 99)`                                                 | provada (814 l., 2 ?)            | por lote: trocar 99 pelo lote                                                               |
| Farming EXP                                         | stat do sistema | `FarmingStuffs("FarmingEXP", 0, 0)`                                                       | provada (569 l., 2 ?)            |                                                                                             |
| Land Rank EXP multiplier                            | stat do sistema | `FarmingStuffs("LandRankEXPmulti", 0, 0)`                                                 | provada (185 l., 0 ?)            |                                                                                             |
| Beans per trade                                     | não mostrado    | `FarmingStuffs("BeanTradeQTY", 0, 0)`                                                     | provada (132 l., 73 ?)           | os 73 "?" são `FarmCrop[i]` (quantidade de cada crop, sem nome)                             |
| Overgrowth chance (per plot)                        | não mostrado    | `FarmingStuffs("NextOGchance", plot, 0)`                                                  | candidata                        | 0,4^(nível+1)                                                                               |
| Overgrowth multiplier (per plot)                    | não mostrado    | `FarmingStuffs("OGmulti", plot, 0)`                                                       | candidata                        | teto 1e9                                                                                    |
| Growth time required (per plot)                     | não mostrado    | `FarmingStuffs("GrowthReq", plot, 0)`                                                     | candidata                        | tipo 6 usa outra base                                                                       |
| Crops per harvest                                   | não mostrado    | `FarmingStuffs("CropsBonusValue", ...)`, `("CropsOnVine", ...)`                           | candidata                        |                                                                                             |
| Evolution chance denominator                        | não mostrado    | `FarmingStuffs("NextCropChanceDENOM", ...)`                                               | candidata                        |                                                                                             |
| Sticker odds (next megacrop)                        | não mostrado    | `FarmingStuffs("StickerOdds", t, 0)`, `("StickerOddsMulti", 0, 0)`                        | candidata                        | 5000×7^b no divisor                                                                         |
| Megacrop attempt                                    | não mostrado    | `FarmingStuffs("AttemptMegacropGrowth", ...)`                                             | precisa do jogo vivo             | é o sorteio em si; a árvore útil é Sticker odds                                             |
| Land Rank EXP required                              | não mostrado    | `FarmingStuffs("LankRankEXPreq", ...)`                                                    | candidata                        |                                                                                             |
| Plot rank gain                                      | não mostrado    | `FarmingStuffs("PlotRankGain", 0, 0)`                                                     | candidata                        |                                                                                             |
| Land Rank points left                               | não mostrado    | `FarmingStuffs("LankRankPTSleft", 0, 0)`                                                  | candidata                        |                                                                                             |
| Land Rank 5th column cap                            | não mostrado    | `FarmingStuffs("LandRank5thColumnMaxLV", 0, 0)`                                           | candidata                        | teto                                                                                        |
| Land Rank bonus total (per column)                  | alimenta        | `FarmingStuffs("LandRankUpgBonusTOTAL", c, 0)`                                            | candidata                        | soma de 3 a 4 upgrades por coluna                                                           |
| Exotic purchases per day                            | não mostrado    | `FarmingStuffs("ExoticPurchasesAllowed", 0, 0)`                                           | candidata                        | 5 fontes (Minehead, Event shop, Sushi, Dreams, Jelly)                                       |
| Free exotic purchase %                              | não mostrado    | `FarmingStuffs("PCTofExoticPurchasesFREE", 0, 0)`                                         | candidata                        |                                                                                             |
| Exotic organics left / level qty                    | não mostrado    | `FarmingStuffs("ExoticOrganicsLEFT"/"ExoticLVQTY", ...)`                                  | candidata                        |                                                                                             |
| Market upgrade cost                                 | não mostrado    | `FarmingStuffs("MarketCostQTY", t, 0)`, `("MarketCostType", t, 0)`                        | candidata                        |                                                                                             |
| Market upgrade cap                                  | não mostrado    | `FarmingStuffs("MarketMaxLV", t, 0)`                                                      | candidata                        | teto                                                                                        |
| Day/Night Market upgrade bonus                      | alimenta        | `FarmingStuffs("BasketUpgQTY", i, j)`                                                     | candidata                        | fora das páginas de propósito (Grupo B, produção); alimenta `PlotRankGain` e `NextOGchance` |
| Crops found                                         | não mostrado    | `FarmingStuffs("CropsFound", t, 0)`                                                       | candidata                        |                                                                                             |
| Beanstalk bonus                                     | não mostrado    | handler `event_6` do Ninja                                                                | sem bloco                        | não é sub-caso                                                                              |
| Crop Depot / Land Rank / Exotic → Drop Rate, damage | alimenta        | `CropSCbonus 7`, `LankRankUpgBonus 9`, `ExoticBonusQTY 59` em `TotalStats("Drop_Rarity")` | provada (na árvore do Drop Rate) |                                                                                             |

## Sneaking (W6): andares, ninjas, Jade Emporium

Tela no app: própria (`Sneaking`, `Jade Emporium`).

| Árvore                                      | Tipo            | Chamada do jogo                                                               | Estado                       | Nota                                                                                                            |
| ------------------------------------------- | --------------- | ----------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sneaking bonuses                            | sistema         | página `sneaking`                                                             | provada (147 l., 0 ?)        |                                                                                                                 |
| Pristine Charms                             | sistema         | `Ninja("PristineBon", 0..22, 0)`                                              | provada (93 l., 0 ?)         |                                                                                                                 |
| Jade Emporium items                         | sistema         | `Ninja("EmporiumBonus", 0..47, 0)`                                            | gravada sem conta            | 48 membros em 49 linhas: teste "a letra está no texto" (causa C da Cobertura H); 0/1 honesto, mas sem a leitura |
| Detection reduction                         | stat do sistema | `Ninja("DetectionDEC", 0, 0)`                                                 | provada (598 l., 12 ?)       | "?" = `Spelunk[i][j]`, `OptionsListAccount`, `DNSM.NjaDN3/4`, `NJbonusMap1`                                     |
| Stealth                                     | stat do sistema | `Ninja("Stealth", 0, 0)`                                                      | provada (562 l., 12 ?)       | mesmos "?"                                                                                                      |
| Sneaking EXP                                | stat do sistema | `Ninja("xp", 0, 0)`                                                           | provada (558 l., 6 ?)        |                                                                                                                 |
| Jade coin gain                              | stat do sistema | `Ninja("coin", 0, 0)`                                                         | provada (673 l., 8 ?)        |                                                                                                                 |
| Action speed                                | stat do sistema | `Ninja("ActionSpd", 0, 0)`                                                    | provada (24 l., 1 ?)         |                                                                                                                 |
| Knock-out time                              | não mostrado    | `Ninja("KOtime", 0, 0)`                                                       | provada (24 l., 2 ?)         | 7200 ÷ bônus                                                                                                    |
| Item find odds (per floor)                  | não mostrado    | `Ninja("ItemFindOdds", 0, floor)`                                             | provada (42 l., 4 ?)         | gravada no andar 1; os outros são só trocar o argumento                                                         |
| Action requirement                          | não mostrado    | `Ninja("ActionREQ", ...)`                                                     | candidata                    | constante 3600: árvore trivial                                                                                  |
| Floors unlocked                             | não mostrado    | `Ninja("FloorsUnlocked", 0, 0)`                                               | candidata                    | teto 12; lê `_GenINFO[87]` (folha única)                                                                        |
| Door max HP / door damage                   | não mostrado    | `Ninja("DoorMaxHP", f, 0)`, `("door", n, 0)`                                  | candidata                    | tempo para abrir a porta                                                                                        |
| Next Emporium cost                          | não mostrado    | `Ninja("EmporiumCost", t, 0)`                                                 | candidata                    | 4 bases exponenciais                                                                                            |
| Emporium shown / total                      | não mostrado    | `Ninja("EmporiumOptions", ...)`, `("AvailableEmporiumPurchases", ...)`        | candidata                    | total constante 48                                                                                              |
| Jade upgrade cost                           | não mostrado    | `Ninja("JadeUpgCost", t, 0)`                                                  | candidata                    |                                                                                                                 |
| Gemstone bonus                              | stat do sistema | `Ninja("GemstoneBonus", t, 0)`                                                | candidata                    |                                                                                                                 |
| Ninja knowledge bonuses                     | sistema         | `Ninja("NLbonuses", t, 0)`                                                    | candidata                    | fora das páginas de propósito (Grupo B)                                                                         |
| Ninja bonus map                             | alimenta        | `Ninja("NinjaBonus", t, i)`                                                   | candidata                    | é o `NJbonusMap` que aparece como "?" nas árvores acima: gravar daria nome a esses "?"                          |
| Symbol chance                               | não mostrado    | `Thingies("SneakSymbolChanceBase", f, 0)`, `Thingies("SneakSymbolBon", t, 0)` | candidata                    | 0,15^nível                                                                                                      |
| Glove speed / untie                         | não mostrado    | `Ninja("gloveSPD", ...)`, `("untie", ...)`                                    | candidata                    |                                                                                                                 |
| Jade Emporium → Farming, Gallery, Menagerie | alimenta        | `Ninja("EmporiumBonus", t, 0)` como Condição nos outros                       | provada (nas outras páginas) |                                                                                                                 |

## Tesseract (Arcane Cultist, W6)

Tela no app: própria (`Tesseract`).

| Árvore                                                                         | Tipo            | Chamada do jogo                                                                                                       | Estado                | Nota                                                                            |
| ------------------------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| Tesseract bonuses                                                              | sistema         | página `tesseract`                                                                                                    | provada (383 l., 0 ?) |                                                                                 |
| Tesseract upgrades                                                             | sistema         | `ArcaneType("ArcaneUpgBonus", 0..58, 0)`                                                                              | provada (223 l., 0 ?) | defeito de nome "Level × Level" (Cobertura H #32)                               |
| Map multipliers (current map)                                                  | sistema         | `ArcaneType("ArcaneMapMulti_bon", t, 0)`                                                                              | provada (147 l., 0 ?) |                                                                                 |
| Arcanist form on                                                               | sistema         | `ArcaneType("TesseractArcanist", 0, 0)`                                                                               | provada (5 l., 0 ?)   | buff 585                                                                        |
| Family bonus (Arcane Cultist)                                                  | alimenta        | `DNSM.FamBonusQTYs[80]`                                                                                               | provada (5 l., 0 ?)   |                                                                                 |
| Arcanist Defence, Mastery, Crit Damage, weapon/ring drop quality, Tenteyecle % | stat do sistema | `ArcaneType("Arcane_DEF"/"Arcane_MASTERY"/"Arcane_CRITDMG"/"WepDropQuality"/"RingDropQuality"/"TenteyeclePCT", 0, 0)` | candidata             | receita pronta em `systems-b9.cjs` ("tesseract-stats"), nunca montada na página |
| Arcanist HP, damage, accuracy, crit %, attack speed, multishot                 | stat do sistema | `ArcaneType("Arcane_HP"/"Arcane_DMG"/"Arcane_ACC"/"Arcane_CRITPCT"/"Arcane_AttackSpdPCT"/"ArcaneMultishotPCT", 0, 0)` | candidata             |                                                                                 |
| Next upgrade cost                                                              | não mostrado    | `ArcaneType("ArcaneUpgCost", t, 0)`                                                                                   | candidata             |                                                                                 |
| Upgrades unlocked / total levels                                               | não mostrado    | `ArcaneType("ArcaneUpgUNLOCKED"/"ArcaneUpgTotal", 0, 0)`                                                              | candidata             |                                                                                 |
| Map multiplier and its cap                                                     | não mostrado    | `ArcaneType("ArcaneMapMulti", ...)`, `("ArcaneMapMulti_bonMAX", ...)`                                                 | candidata             | teto                                                                            |
| Prisma bubble drop chance                                                      | não mostrado    | `ArcaneType("PrismaBubDropChance", ...)`                                                                              | candidata             | 1/(1000×1,27^nível)                                                             |
| Prisma bonus multiplier                                                        | alimenta        | `ArcaneType("PrismaBonusMult", ...)`                                                                                  | candidata             |                                                                                 |
| Crystal charge requirement                                                     | não mostrado    | `ArcaneType("CrystalChargeReq", ...)`                                                                                 | candidata             | teto 200, piso 50                                                               |
| Weapon / ring drop chance                                                      | não mostrado    | `ArcaneType("WepDropChance"/"RingDropChance", ...)`                                                                   | candidata             |                                                                                 |
| Tachyon type and base quantity                                                 | não mostrado    | `ArcaneType("ArcaneTachyonType"/"ArcaneTachyonQTYbase", ...)`, `("ExtraTachyon"/"ExtraTachyonMulti", 0, 0)`           | candidata             | taxa por kill                                                                   |
| Double item drops                                                              | não mostrado    | `ArcaneType("DoubleItemDropz", ...)`                                                                                  | candidata             |                                                                                 |
| Kills required / time left / mobs spawned                                      | não mostrado    | `ArcaneType("KillsReq"/"TimeLeft"/"ArcaneMobSpawnQTY", ...)`                                                          | precisa do jogo vivo  | mapa atual                                                                      |
| `NaNaTestTestNah`                                                              | —               | `ArcaneType("NaNaTestTestNah", ...)`                                                                                  | sem bloco             | ramo morto; não serve                                                           |

## Compass (Windwalker, W6)

Tela no app: própria (`Compass`, `Medallion Collection`).

| Árvore                                                                            | Tipo            | Chamada do jogo                                                                                                                                                     | Estado                                             | Nota                                                                                          |
| --------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Compass bonuses                                                                   | sistema         | página `compass`                                                                                                                                                    | provada (823 l., 0 ?)                              |                                                                                               |
| Compass upgrades                                                                  | sistema         | `Windwalker("CompassBonus", 0..172, 0)` (162 membros)                                                                                                               | provada (759 l., 0 ?)                              | rótulos com `CustomLists.CompassUpg[..]` (Cobertura H #33)                                    |
| Tempest form on                                                                   | sistema         | `Windwalker("CompassTempest", 0, 0)`                                                                                                                                | provada (5 l., 0 ?)                                |                                                                                               |
| Stamp Doubler                                                                     | alimenta        | `Windwalker("StampDoubler", t, 0)`                                                                                                                                  | provada (56 l., 0 ?)                               |                                                                                               |
| Tempest Defence, Mastery, Crit Damage, attack range                               | stat do sistema | `Windwalker("Compass_DEF"/"Compass_MASTERY"/"Compass_CRITDMG"/"Compass_Range", 0, 0)`                                                                               | candidata                                          | receita pronta em `systems-b9.cjs` ("compass-stats"), não montada                             |
| Tempest HP, damage, accuracy, crit %, attack speed, invuln, move speed, multishot | stat do sistema | `Windwalker("Compass_HP"/"Compass_DMG"/"Compass_ACC"/"Compass_CRITPCT"/"Compass_AttackSpdPCT"/"Compass_InvulnSec"/"Compass_MoveSpeed"/"TempestMultishotPCT", 0, 0)` | candidata                                          |                                                                                               |
| Next upgrade cost                                                                 | não mostrado    | `Windwalker("CompassUpgCost", t, 0)`                                                                                                                                | candidata                                          |                                                                                               |
| Dust per kill and dust multiplier                                                 | não mostrado    | `Windwalker("CompassDustQTYbase", ...)`, `("ExtraDust", 0, 0)`, `("CompassDustType", ...)`                                                                          | candidata                                          | `ExtraDust` multiplica ~15 fontes (Exotic, Meritocracy, Pristine, Lore, Emperor, masterclass) |
| Weapon / ring / stone drop chance                                                 | não mostrado    | `Windwalker("TempestWepDropChance"/"TempestRingDropChance"/"TempestStoneDropChance", ...)`                                                                          | candidata                                          |                                                                                               |
| Medallion drop chance (per monster)                                               | não mostrado    | `Windwalker("TempestMedallionDropChance", map, 0)`                                                                                                                  | candidata                                          | 5000×(1+floor(mapa/50))³                                                                      |
| Extra power / novadust / stone %                                                  | não mostrado    | `Windwalker("TempestWeaponXtraPowerChance"/"TempestNovadustChance"/"StoneChancePCT", ...)`                                                                          | candidata                                          |                                                                                               |
| Tempest drop bonus                                                                | não mostrado    | `Windwalker("TempestAllDropBonus", ...)`                                                                                                                            | candidata                                          | 200x ou 1x                                                                                    |
| Portal cost                                                                       | não mostrado    | `Windwalker("PortalCostQTY"/"PortalCostType", map, 0)`, `("CanWeEnterPortal", map, 0)`                                                                              | candidata                                          |                                                                                               |
| Titan weakness / kills per town / titan HP                                        | não mostrado    | `Windwalker("TitanWeakness"/"TitanKillReqTown"/"InitializeTitanHP"/"MobWeakness", ...)`                                                                             | candidata                                          | 3/8/17/25/30 por cidade                                                                       |
| Elemental effect and amount                                                       | não mostrado    | `Windwalker("CurrentEffect"/"EffectAmount", ...)`                                                                                                                   | candidata                                          |                                                                                               |
| Stamp doublers left                                                               | não mostrado    | `Windwalker("StampDoublersLeft", 0, 0)`                                                                                                                             | candidata                                          |                                                                                               |
| Compass → Drop Rate, damage, dust                                                 | alimenta        | `Windwalker("CompassBonus", n, 0)` nos stats                                                                                                                        | provada (na árvore do Drop Rate e de DamageDealed) |                                                                                               |

## Grimoire (Death Bringer, W6)

Tela no app: própria (`Grimoire`).

| Árvore                                                      | Tipo            | Chamada do jogo                                                                                | Estado                | Nota                                                                                                                                                        |
| ----------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grimoire bonuses                                            | sistema         | página `grimoire`                                                                              | provada (220 l., 0 ?) |                                                                                                                                                             |
| Grimoire upgrades                                           | sistema         | `Summoning("GrimoireUpgBonus", 0..51, 0)`                                                      | provada (207 l., 0 ?) |                                                                                                                                                             |
| Wraith form on                                              | sistema         | `Summoning("GrimoireWraith", 0, 0)`                                                            | provada (5 l., 0 ?)   | buff 195                                                                                                                                                    |
| Family bonus (Death Bringer)                                | alimenta        | `DNSM.FamBonusQTYs[28]`                                                                        | provada (5 l., 0 ?)   |                                                                                                                                                             |
| Wraith Defence, Mastery, Crit Damage, bones drop multiplier | stat do sistema | `Summoning("Grimoire_DEF"/"Grimoire_MASTERY"/"Grimoire_CRITDMG"/"GrimoireBonesDropDEC", 0, 0)` | candidata             | receita pronta em `systems-b9.cjs` ("grimoire-stats"), não montada                                                                                          |
| Wraith HP, damage, accuracy, crit %                         | stat do sistema | `Summoning("Grimoire_HP"/"Grimoire_DMG"/"Grimoire_ACC"/"Grimoire_CRITPCT", 0, 0)`              | candidata             |                                                                                                                                                             |
| Next upgrade cost                                           | não mostrado    | `Summoning("GrimoireUpgCost", t, 0)`                                                           | candidata             | conferido no `callees`: lê `Grimoire[]` e 2 colunas de `GrimoireUpg`, chama `First3MC_CostRedux` e `AllMasterclassCostRedux` (Royal Armory e Orblet dentro) |
| Upgrades unlocked / total levels                            | não mostrado    | `Summoning("GrimoireUpgUNLOCKED"/"GrimoireUpgTotal", 0, 0)`                                    | candidata             |                                                                                                                                                             |
| Bones per kill and bone type                                | não mostrado    | `Summoning("GrimoireBoneQTYbase"/"GrimoireBoneType", map, 0)`                                  | candidata             | expoente 0,9                                                                                                                                                |
| All-masterclass drop multiplier                             | alimenta        | `Summoning("AllMasterclassDropz", 0, 0)`                                                       | candidata             | comum às 4 classes (ossos, poeira, tachyons)                                                                                                                |
| Masterclass cost reduction                                  | não mostrado    | `Summoning("AllMasterclassCostRedux", 0, 0)`, `("First3MC_CostRedux", 0, 0)`                   | candidata             | o desconto que cresce por dia (`OLA[499]`)                                                                                                                  |

## Emperor (W6)

Tela no app: própria (`Emperor Showdown`).

| Árvore                  | Tipo         | Chamada do jogo                                     | Estado                             | Nota                            |
| ----------------------- | ------------ | --------------------------------------------------- | ---------------------------------- | ------------------------------- |
| Emperor bonuses         | sistema      | `Thingies("EmperorBon", 0..11, 0)`                  | provada (67 l., 0 ?)               | 2 bônus "World 7ish" sem leitor |
| Attempt stack cap       | não mostrado | `Thingies("MaxEmperorAttemptStack", 0, 0)`          | candidata                          | 5 + Emporium + 6×`OLA[382]`     |
| Daily tries             | não mostrado | `Thingies("DailyEmperorTries", 0, 0)`               | candidata                          |                                 |
| Emperor HP              | não mostrado | `Thingies("Boss6HP", lv, 0)`                        | candidata                          |                                 |
| Extra attempt chance    | não mostrado | handler `event_Every1sec`                           | sem bloco                          | 50 % com Emporium               |
| Fight win estimate      | não mostrado | —                                                   | sem bloco                          | motor da luta                   |
| Emperor → dust, stealth | alimenta     | `Thingies("EmperorBon", 4, 0)` em `ExtraDust`, etc. | provada (dentro de outras páginas) |                                 |

## W6 trophy

Tela no app: nenhuma.

| Árvore          | Tipo    | Chamada do jogo                  | Estado              | Nota                           |
| --------------- | ------- | -------------------------------- | ------------------- | ------------------------------ |
| W6 trophy bonus | sistema | `Thingies("HaveW6Trophy", 0, 0)` | provada (5 l., 0 ?) | 10 ou 0; alimenta `ArcaneType` |

## Spelunking (W7)

Tela no app: própria (`Spelunking`, `Spelunking › Upgrades`, `› Lore Journal`, `› Elixir Belt`).

| Árvore                                                               | Tipo            | Chamada do jogo                                                                                                                     | Estado                               | Nota                                                   |
| -------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| Spelunking bonuses                                                   | sistema         | página `spelunking`                                                                                                                 | provada (559 l., 0 ?)                |                                                        |
| Spelunk shop upgrades                                                | sistema         | `Spelunk("ShopUpgBonus", 0..67, 0)` (+5 na forma de nível)                                                                          | provada (356 l., 0 ?)                |                                                        |
| Lore bosses and chapter bonuses                                      | sistema         | `Spelunk("DoWeHaveLoreN1", 0..7, 0)`, `("DuperBits")`, `("6starCards")`, `("ChapterBonus", 0..22, 0)`                               | provada (198 l., 0 ?)                |                                                        |
| Spelunking power (POW)                                               | stat do sistema | `Spelunk("POW", 0, 0)`                                                                                                              | provada (480 l., 20 ?)               | 16 "?" sem código e 3 do `_GenINFO[107]` (mina aberta) |
| Spelunking efficiency                                                | stat do sistema | `Spelunk("SpelunkingEfficiency", 0, 0)`                                                                                             | provada (573 l., 6 ?, 3 progresso)   |                                                        |
| Spelunking speed                                                     | stat do sistema | `Spelunk("SpelunkingSpeed", 0, 0)`                                                                                                  | provada (65 l., 0 ?)                 |                                                        |
| Max stamina                                                          | stat do sistema | `Spelunk("StaminaMax", 0, 0)`                                                                                                       | provada (83 l., 0 ?)                 |                                                        |
| Stamina regen                                                        | stat do sistema | `Spelunk("StaminaRegenRate", 0, 0)`                                                                                                 | provada (118 l., 0 ?)                |                                                        |
| Amber gain                                                           | stat do sistema | `Spelunk("AmberGain", 0, 0)`                                                                                                        | provada (396 l., 4 ?)                | "?" = `_GenINFO` da mina                               |
| Multi-ore                                                            | stat do sistema | `Spelunk("SpelunkingMultiOre", 0, 0)`                                                                                               | provada (4 l., 0 ?)                  |                                                        |
| Ore value                                                            | stat do sistema | `Spelunk("SpelunkingOreValue", 0, 0)`                                                                                               | gravada sem conta                    | 1 linha                                                |
| Spelunking EXP multi                                                 | stat do sistema | `ExpMulti(19)`                                                                                                                      | provada (1391 l., 9 ?, 6 progresso)  |                                                        |
| Spelunking AFK gains                                                 | stat do sistema | `AFKgainrates("Spelunking")`                                                                                                        | provada (1031 l., 1 ?, 11 progresso) |                                                        |
| Spelunking actions per hour                                          | stat do sistema | `HourlyKillRate("Spelunking")`                                                                                                      | provada (629 l., 6 ?, 3 progresso)   |                                                        |
| Harvest chance                                                       | stat do sistema | `RunCodeOfTypeXforThingY("ChanceToHarvest", "Spelunking")`                                                                          | provada (577 l., 6 ?, 3 progresso)   |                                                        |
| Shop upgrade cost / cap                                              | não mostrado    | `Spelunk("ShopUpgCost", t, 0)`, `("ShopUpgMaxLV", t, 0)`                                                                            | candidata                            | custo exato e teto                                     |
| Drop chances (exalted, prisma, gold piece, misc, W7 item, bling bag) | não mostrado    | `Spelunk("ExaltDropChance"/"PrismaDropChance"/"GoldPieceDropChance"/"MiscDropChance"/"w7itemDropChance"/"blingbagDropChance", ...)` | candidata                            |                                                        |
| Amber drop chance / daily haul                                       | não mostrado    | `Spelunk("AmberDropChance"/"AmberDropChance2nd"/"AmberDailyHaul", ...)`                                                             | candidata                            |                                                        |
| Grand Discoveries find chance                                        | não mostrado    | `Spelunk("GrandDiscoveries_FindChance", 0, 0)`, `("GrandDiscoveries_Total", 0, 0)`                                                  | candidata                            | 4E-5 de base                                           |
| Escape rope chance / exit tax / holes to next floor                  | não mostrado    | `Spelunk("EscapeRopeChance"/"TollExitTax"/"HolesToNextFloor", ...)`                                                                 | candidata                            |                                                        |
| Overstim fill rate and bonus                                         | não mostrado    | `Spelunk("OverstimFillRate"/"OverstimBonus"/"OverstimBonus2"/"OverstimQtyREQ", ...)`                                                | candidata                            |                                                        |
| Elixir effect                                                        | não mostrado    | `Spelunk("ElixirEffectQTY", t, 0)`, `("ElixirMaxDupes"/"ElixirSlotsOwned", ...)`                                                    | candidata                            |                                                        |
| Shadow strike / nova blast / bonus damage                            | não mostrado    | `Spelunk("ShadowStrikeChance"/"ShadowStrikeQTY"/"NovaBlastHitChance"/"BonusDMG", ...)`                                              | candidata                            |                                                        |
| Daily page reads / page level gains                                  | não mostrado    | `Spelunk("MaxDailyPageReads"/"PageReadingLVgains", ...)`                                                                            | candidata                            | 5 + 3×Rift                                             |
| Sample reduction                                                     | alimenta        | `Spelunk("SampleRedux", 0, 0)`                                                                                                      | candidata                            |                                                        |
| Rock POW requirement / rock HP / rock amber                          | não mostrado    | `Spelunk("RockPOWreq"/"RockHP"/"RockAmber", ...)`                                                                                   | precisa do jogo vivo                 | lê `_GenINFO[70]` (andar atual)                        |
| Stamina cost multi                                                   | não mostrado    | `Spelunk("StaminaCostMulti", 0, 0)`                                                                                                 | precisa do jogo vivo                 | lê `_GenINFO[107]` (elixir ativo)                      |
| Break chance against the rock                                        | não mostrado    | handler `customEvent_SpelunkStuff2`                                                                                                 | sem bloco                            | (POW/req)^0,6 fora de bloco                            |

## Big Fish (W7)

Tela no app: só do pai (Spelunking).

| Árvore                      | Tipo         | Chamada do jogo                                                      | Estado               | Nota                                                       |
| --------------------------- | ------------ | -------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------- |
| Big Fish bonuses            | sistema      | `Spelunk("BigFishBonuses", 0..6, 0)`                                 | provada (37 l., 0 ?) | o cache `BigFishBon` já abre na página (BUILDER instalado) |
| Big Fish cost               | não mostrado | `Spelunk("BigFishCost", t, 0)`                                       | candidata            |                                                            |
| Big Fish unlock requirement | não mostrado | `Spelunk("BigFishUpgLVREQ", t, 0)`, `("isBigFishUpgUnlocked", t, 0)` | candidata            | soma o nível de todos os personagens                       |

## Lore epilogue bonuses (W7)

Tela no app: só do pai (`Spelunking › Lore Journal`).

| Árvore                     | Tipo     | Chamada do jogo                               | Estado                | Nota |
| -------------------------- | -------- | --------------------------------------------- | --------------------- | ---- |
| Lore epilogue bonuses      | sistema  | `Thingies("LoreEpiBon", 0..9, 0)`             | provada (147 l., 0 ?) |      |
| Epilogue → dust and others | alimenta | `Thingies("LoreEpiBon", 2, 0)` em `ExtraDust` | provada (na página)   |      |

## Research (W7): grid, observações, stickers

Tela no app: própria (`Research`, duas regras).

| Árvore                                                                                                                               | Tipo            | Chamada do jogo                                                                                    | Estado                               | Nota                                             |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Research bonuses                                                                                                                     | sistema         | página `research`                                                                                  | provada (615 l., 0 ?)                |                                                  |
| Grid squares + grid multi                                                                                                            | sistema         | `ResearchStuff("Grid_Bonus", t, 0)` (67), `("Grid_Bonus_Allmulti", 0, 0)`                          | provada (533 l., 0 ?)                |                                                  |
| Stickers                                                                                                                             | sistema         | `FarmingStuffs("TotalStickers")`, `("StickerDMGmulti")`, `("StickerBonus", t, i)`                  | provada (77 l., 0 ?)                 |                                                  |
| Research EXP rate                                                                                                                    | stat do sistema | `ResearchStuff("ResearchEXPrateTOT", 0, 0)`                                                        | provada (505 l., 4 ?, 2 progresso)   |                                                  |
| Research EXP multi                                                                                                                   | stat do sistema | `ResearchStuff("ResearchEXPmulti", 0, 0)`                                                          | provada (371 l., 2 ?, 2 progresso)   |                                                  |
| Research AFK gains                                                                                                                   | stat do sistema | `AFKgainrates("Research")`                                                                         | provada (1164 l., 1 ?, 11 progresso) |                                                  |
| Grid points available / earned / spent                                                                                               | não mostrado    | `ResearchStuff("Grid_PTSavailable"/"Grid_PTSearned"/"Grid_PTSspent", 0, 0)`                        | candidata                            |                                                  |
| Grid square cap                                                                                                                      | não mostrado    | `ResearchStuff("Grid_MaxLV", t, 0)`                                                                | candidata                            | teto                                             |
| Occurrences to find / found                                                                                                          | não mostrado    | `ResearchStuff("OccurrencesToBeFound"/"TotalOccurrencesFound", 0, 0)`                              | candidata                            | até 43                                           |
| Rolls per day / min / max roll                                                                                                       | não mostrado    | `ResearchStuff("RollsPerDay"/"MinRoll"/"MaxRoll", ...)`                                            | candidata                            |                                                  |
| Magnifiers per slot / owned                                                                                                          | não mostrado    | `ResearchStuff("MagnifiersPerSlot"/"MagnifiersOwned", ...)`                                        | candidata                            |                                                  |
| Observation insight rate / requirement                                                                                               | não mostrado    | `ResearchStuff("ObservationInsightExpRate"/"ObservationInsightExpREQ"/"ResearchEXPrateObj", t, 0)` | candidata                            | taxa por hora de cada observação                 |
| Kaleidoscope multi                                                                                                                   | alimenta        | `ResearchStuff("Kalei_MultiBase"/"Kalei_MultiTot", ...)`                                           | candidata                            |                                                  |
| Tiny cogs per day / small cog bonus                                                                                                  | não mostrado    | `ResearchStuff("TinyCogsPerDay"/"SmallCogBonusTOTAL", ...)`                                        | candidata                            |                                                  |
| Green sigil true damage                                                                                                              | alimenta        | `ResearchStuff("GreenSigilTrueDMG", ...)`                                                          | candidata                            |                                                  |
| Grid unlocks elsewhere (Maw Island, King Rat, Transcendent Artifacts, Green Sigils, Refinery tab 3, Tiny Cogs, Stickers, Zuper Bits) | alimenta        | `ResearchStuff("<X>Unlocked", 0, 0)`                                                               | candidata                            | 0/1: árvore de Condição, pouco valor como árvore |

## Clam Work (W7)

Tela no app: própria (`The Clamworks`).

| Árvore                                 | Tipo         | Chamada do jogo                                                                           | Estado                             | Nota                               |
| -------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| Clam Work bonuses                      | sistema      | página `clam-work`                                                                        | provada (535 l., 2 ?, 3 progresso) |                                    |
| Clam Work upgrades                     | sistema      | `Thingies("ClamWorkBonus", 0..10, 0)`                                                     | provada (35 l., 0 ?)               |                                    |
| Clam bonuses                           | sistema      | `Thingies("ClamBonuses", t, i)`, t = 0..8, i = 0/1                                        | provada (498 l., 2 ?, 3 progresso) |                                    |
| Promotion chance                       | não mostrado | `Thingies("ClamPromochance", 0, 0)`                                                       | candidata                          | 0,5/(2+`OLA[464]`)                 |
| Clam HP                                | não mostrado | `Thingies("Clamz_HP", n, 0)`                                                              | candidata                          | 1E16×30^n                          |
| Pearl value / 10x chance / black pearl | não mostrado | `Thingies("ClamPearlValue"/"ClamPearl10x"/"Clam_BlackPearlValue", ...)`                   | candidata                          |                                    |
| Clam cost / pearl upgrade requirement  | não mostrado | `Thingies("Clam_Cost"/"Clam_PearlUpgReq", t, 0)`                                          | candidata                          |                                    |
| Clams on screen / respawn              | não mostrado | `Thingies("Clam_Mobs"/"Clam_Respawn", ...)`                                               | candidata                          | 60 s                               |
| Scurge points / EXP                    | não mostrado | `MenagerieStuff("ScurgePTS_Left"/"ScurgeEXPgain"/"ScurgeEXP_Req"/"ScurgeUpg_LvREQ", ...)` | candidata                          | o nível de Scurge vem da Menagerie |

## Meritocracy (W7)

Tela no app: própria (`Multi Meritocracy`).

| Árvore                      | Tipo            | Chamada do jogo                                                   | Estado                     | Nota                                                                                |
| --------------------------- | --------------- | ----------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Meritocracy bonuses         | sistema         | `Summoning2("MeritocBonusz", 0..26, 0)`                           | provada (187 l., 0 ?)      | só a opção votada não é 0                                                           |
| Meritocracy multiplier      | stat do sistema | `Summoning2("MeritocBonuszMulti", 0, 0)`                          | provada (dentro da página) | Clam 3, companions 39 e 161, Legend 24, Arcade 59, Event shop 23, Sushi e Jelly RoG |
| What each option would give | não mostrado    | `Summoning2("MeritocBonusz", t, 0)` com `OLA[453]` trocado para t | candidata                  | what-if: rodar o bloco com a opção trocada no estado isolado                        |
| Can vote                    | não mostrado    | `Summoning2("MeritocCanVote", 0, 0)`                              | candidata                  | 0/1, pouco valor                                                                    |

## Gallery (W7)

Tela no app: própria (`The Gallery`, `› View Trophy Bonuses`, `› View Nametag Bonuses`).

| Árvore                           | Tipo         | Chamada do jogo                                                        | Estado                                              | Nota                                                                                                                                  |
| -------------------------------- | ------------ | ---------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Gallery bonuses                  | sistema      | página `gallery`                                                       | provada (137 l., 0 ?)                               |                                                                                                                                       |
| Gallery multi                    | sistema      | `Gallery("GalleryBonusMulti", 0, 0)`, `("GalleryBonusSystemON", 0, 0)` | provada (101 l., 0 ?)                               |                                                                                                                                       |
| Podiums level 2–4                | sistema      | `Gallery("PodiumsOwned_Lv2"/"_Lv3"/"_Lv4", 0, 0)`                      | provada (31 l., 0 ?)                                |                                                                                                                                       |
| Trophy bonuses / nametag bonuses | sistema      | `Gallery("InitializeTrophyBonuses"/"InitializeNametagBonuses", 0, 0)`  | gravada sem conta                                   | 2 linhas cada: cache `DNSM.GalleryTrophyBonTOT` / `GalleryNametagBonTOT` sem BUILDER (pendência 5 do BASELINE-3.1: `DNSM.GalleryDN2`) |
| Podiums owned (cap 19)           | não mostrado | `Gallery("PodiumsOwned", 0, 0)`                                        | candidata                                           | 6 fontes; não está na página (só Lv2 a Lv4)                                                                                           |
| Best exhibit layout              | não mostrado | —                                                                      | sem bloco                                           | otimizador: what-if pesado fora de um sub-caso                                                                                        |
| Gallery → Drop Rate              | alimenta     | dentro de `EtcBonuses("2")`                                            | provada (na árvore do Drop Rate e na cobertura #13) |                                                                                                                                       |

## Hat Rack (bloco Gallery, W3; incluído porque é do mesmo bloco)

Tela no app: própria (`The Hat Rack`).

| Árvore         | Tipo    | Chamada do jogo                                                          | Estado               | Nota                       |
| -------------- | ------- | ------------------------------------------------------------------------ | -------------------- | -------------------------- |
| Hat Rack multi | sistema | `Gallery("HatrackBonusMulti", 0, 0)`, `("PremHatBonusesSystemON", 0, 0)` | provada (21 l., 0 ?) | página com 24 l.           |
| Hat bonuses    | sistema | `Gallery("InitializePremHatBonuses", 0, 0)`                              | gravada sem conta    | cache `DNSM.PremHatBonTOT` |

## Legend Talents (W7)

Tela no app: própria (`Legend Talents`).

| Árvore                | Tipo         | Chamada do jogo                                                                            | Estado            | Nota                                                                                                                             |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Legend talent bonuses | sistema      | `Thingies("LegendPTS_bonus", 0..41, 0)`                                                    | gravada sem conta | 44 l., ⓘ 0/0: `round(nível×valor)` vira folha única; a Correção A da Cobertura H resolve, mas a página não foi remontada com ela |
| Legend points owned   | não mostrado | `Thingies("LegendPTS_owned", 0, 0)`                                                        | candidata         | soma os níveis acima de 400 de todos os personagens                                                                              |
| Legend points spent   | não mostrado | `Thingies("LegendPTS_spent", 0, 0)`                                                        | candidata         |                                                                                                                                  |
| Legend talent cap     | não mostrado | `Thingies("LegendTalent_MaxLV", t, 0)`                                                     | candidata         | teto móvel                                                                                                                       |
| Super talent points   | não mostrado | `Thingies("SuperTalentPTS_totaltospend"/"_lefttospend"/"_LVgiven"/"_unlockedstatus", ...)` | candidata         | talvez seja da frente de Talents                                                                                                 |

## Zenith Market (W7)

Tela no app: própria (`Zenith Market`).

| Árvore                            | Tipo         | Chamada do jogo                           | Estado            | Nota                                                  |
| --------------------------------- | ------------ | ----------------------------------------- | ----------------- | ----------------------------------------------------- |
| Zenith Market bonuses             | sistema      | `Thingies("ZenithMarketBonus", 0..11, 0)` | gravada sem conta | 14 l., ⓘ 0/0: mesmo caso do `floor(a×b)` (Correção A) |
| Real cost (above the 1E6 display) | não mostrado | `Thingies("ZenithMarketCost", t, 0)`      | candidata         | o jogo corta a exibição                               |
| Zenith auto-EXP chance            | não mostrado | `Thingies("ZenithAutoEXPchance", 0, 0)`   | candidata         | repete o Orblet índice 0                              |

## Orblet Market (tardio, Royal Guardian/Zenith)

Tela no app: própria (`Lil Orblet Shop`).

| Árvore                | Tipo         | Chamada do jogo                       | Estado    | Nota                                                               |
| --------------------- | ------------ | ------------------------------------- | --------- | ------------------------------------------------------------------ |
| Orblet Market bonuses | sistema      | `Thingies("OrbletMarketBonus", t, 0)` | candidata | sem página própria nesta bancada; entra no custo das masterclasses |
| Real cost             | não mostrado | `Thingies("OrbletMarketCost", t, 0)`  | candidata | também cortado na exibição                                         |

## Minehead (W7)

Tela no app: própria (`Mr. Minehead's Depth Charge`, `› Opponents`, `› Upgrades`, `› Bonuses`).

| Árvore                                  | Tipo         | Chamada do jogo                                                                 | Estado                | Nota                                                          |
| --------------------------------------- | ------------ | ------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------- |
| Minehead bonuses                        | sistema      | página `minehead`                                                               | provada (189 l., 0 ?) |                                                               |
| Floor bonuses                           | sistema      | `Minehead("BonusQTY", 0..22, 0)`                                                | provada (85 l., 0 ?)  |                                                               |
| Weapon power damage                     | sistema      | `Minehead("WepPowDmgPCT", 0, 0)`                                                | provada (8 l., 0 ?)   |                                                               |
| Upgrades                                | sistema      | `Minehead("UpgradeQTY", 0..25, 0)`                                              | provada (95 l., 0 ?)  |                                                               |
| Next upgrade cost                       | não mostrado | `Minehead("UpgCost", t, 0)`                                                     | precisa do jogo vivo  | lê a variável de servidor `A_MineCost` (o resto é conta pura) |
| Opponent HP                             | não mostrado | `Minehead("MaxHP_Opp", t, 0)`                                                   | precisa do jogo vivo  | lê `A_MineHP`                                                 |
| Opponent mines                          | não mostrado | `Minehead("Mines_Opp", t, 0)`                                                   | candidata             | teto 40                                                       |
| Daily tries                             | não mostrado | `Minehead("DailyTries", 0, 0)`                                                  | candidata             | 3 + grid 147                                                  |
| Your HP / upgrade level requirement     | não mostrado | `Minehead("MaxHP_You", 0, 0)`, `("UpgLvREQ", t, 0)`                             | candidata             |                                                               |
| Base damage / bonus damage per tile     | não mostrado | `Minehead("BaseDMG"/"BonusDMGperTilePCT", ...)`                                 | candidata             |                                                               |
| Jackpot / blue crown odds and multi     | não mostrado | `Minehead("JackpotOdds"/"BluecrownOdds"/"BluecrownMulti", ...)`                 | candidata             |                                                               |
| Currency gain                           | não mostrado | `Minehead("CurrencyGain", 0, 0)`                                                | candidata             | taxa                                                          |
| Tiles, gold tiles, flags, insta-reveals | não mostrado | `Minehead("TotalTiles"/"GoldTilesTotal"/"FlagsTotal"/"InstaRevealsTotal", ...)` | candidata             |                                                               |
| Current outgoing damage                 | não mostrado | `Minehead("CurrentOutgoingDMG", ...)`                                           | precisa do jogo vivo  | tabuleiro em curso                                            |

## Glimbo's Swap Meet (W7)

Tela no app: própria (`Glimbo's Swap Meet`).

| Árvore                 | Tipo            | Chamada do jogo                                               | Estado                           | Nota              |
| ---------------------- | --------------- | ------------------------------------------------------------- | -------------------------------- | ----------------- |
| Glimbo drop rate multi | sistema         | `Minehead("GlimboDRmulti", 0, 0)`                             | provada (85 l., 0 ?)             | página com 128 l. |
| Glimbo total trades    | stat do sistema | `Minehead("GlimboTotalTrades", 0, 0)`                         | provada (42 l., 0 ?)             |                   |
| Next trade cost        | não mostrado    | `Minehead("Glimbo_Cost", t, 0)`, `("Glimbo_CanAfford", t, 0)` | candidata                        |                   |
| Glimbo → Drop Rate     | alimenta        | `Minehead("GlimboDRmulti")` no Drop Rate                      | provada (na árvore do Drop Rate) |                   |

## The Button (W7)

Tela no app: própria (`The Button`).

| Árvore                                   | Tipo         | Chamada do jogo                                                        | Estado            | Nota                        |
| ---------------------------------------- | ------------ | ---------------------------------------------------------------------- | ----------------- | --------------------------- |
| Button bonuses                           | sistema      | `Minehead("Button_Bonuses", 0..8, 0)`                                  | gravada sem conta | 11 l., ⓘ 0/0                |
| Current task, requirement, what you have | não mostrado | `Minehead("Button_Task"/"Button_REQ"/"Button_uHave", 0, 0)`            | candidata         | depende do personagem ativo |
| Bonus per press / multi                  | não mostrado | `Minehead("Button_BonusPerTime", t, 0)`, `("Button_BonusMULTI", 0, 0)` | candidata         | companion 147 dentro        |

## Sushi Station (W7)

Tela no app: própria (`Sushi Station`, `› Sushi`, `› Upgrades`, `› Bonus`).

| Árvore                                           | Tipo            | Chamada do jogo                                                                                 | Estado                       | Nota                                    |
| ------------------------------------------------ | --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------- |
| Sushi bonuses                                    | sistema         | página `sushi-station`                                                                          | provada (250 l., 0 ?)        |                                         |
| RoG bonuses                                      | sistema         | `SushiStuff("RoG_BonusQTY", 0..63, 0)`                                                          | provada (245 l., 0 ?)        |                                         |
| Unique sushi / max tier                          | stat do sistema | `SushiStuff("UniqueSushi", 0, 0)`, `("MaxTier", 0, 0)`                                          | provada (2 l. cada, 0 ?)     | contagens                               |
| Currency per hour                                | não mostrado    | `SushiStuff("CurrencyperHR", 0, 0)`                                                             | candidata                    | o jogo só mostra com o upgrade 41       |
| Currency multi / per tier / per slot / overtuned | não mostrado    | `SushiStuff("CurrencyMulti"/"CurrencyPerTier"/"CurrencyPerSlot"/"OvertunedMulti", ...)`         | candidata                    |                                         |
| Combo multi                                      | não mostrado    | `SushiStuff("ComboMulti", 0, 0)`                                                                | candidata                    | satura em 1500                          |
| Perfect odds                                     | não mostrado    | `SushiStuff("PerfectOdds", tier, 0)`                                                            | candidata                    |                                         |
| Saffron hours                                    | não mostrado    | `SushiStuff("SaffronHRS", ...)`                                                                 | candidata                    |                                         |
| Fuel generation / cap / cost                     | não mostrado    | `SushiStuff("FuelGen"/"FuelCap"/"FuelCost", ...)`                                               | candidata                    | tempo até encher ou esvaziar            |
| Next upgrade cost / level requirement            | não mostrado    | `SushiStuff("UpgCost", t, 0)`, `("UpgLvREQ", t, 0)`                                             | candidata                    |                                         |
| Sushi upgrades                                   | sistema         | `SushiStuff("UpgradeQTY", t, 0)`                                                                | candidata                    | fora das páginas de propósito (Grupo B) |
| Knowledge EXP and bonus                          | não mostrado    | `SushiStuff("KnowledgeXP_req"/"KnowledgeXP_base"/"KnowledgeXP_multi"/"KnowledgeBonusTOT", ...)` | candidata                    |                                         |
| Max cook tier / bonus cook tier                  | não mostrado    | `SushiStuff("MaxCookTier"/"BonusCookTierPCT", ...)`                                             | candidata                    |                                         |
| Slot and fireplace effect                        | não mostrado    | `SushiStuff("SlotEffect"/"FireplaceEffect"/"FireplaceSparkMulti", slot, 0)`                     | candidata                    | vizinhança da fogueira                  |
| Sushi RoG → Meritocracy, Minehead cost           | alimenta        | `SushiStuff("RoG_BonusQTY", 51/1/16, 0)`                                                        | provada (nas outras páginas) |                                         |

## Jelly Operator (W7)

Tela no app: própria (`Jelly Operator`, `› Jelly`, `› Upgrade`, `› Bonus`).

| Árvore                                          | Tipo         | Chamada do jogo                                                                  | Estado                | Nota                                    |
| ----------------------------------------------- | ------------ | -------------------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| Jelly RoG bonuses                               | sistema      | `JellyOperation("RoG_BonusQTY", 0..44, 0)`                                       | provada (229 l., 0 ?) | ⓘ 44/64 (20 ramos sem fórmula, a ver)   |
| Boss HP / time / attack cooldown                | não mostrado | `JellyOperation("BossHP"/"BossTime"/"BossAtkCD", b, 0)`                          | candidata             | salto a cada 12                         |
| Daily tries                                     | não mostrado | `JellyOperation("DailyTries", 0, 0)`                                             | candidata             |                                         |
| Currency multi / DPS multi / bloodcells per day | não mostrado | `JellyOperation("CurrencyMulti"/"DPSmulti"/"BloodcellDaily", ...)`               | candidata             |                                         |
| Next upgrade cost / level requirement           | não mostrado | `JellyOperation("UpgCost"/"UpgLvREQ", t, 0)`                                     | candidata             |                                         |
| Jelly upgrades                                  | sistema      | `JellyOperation("UpgradeQTY", t, 0)`                                             | candidata             | fora das páginas de propósito (Grupo B) |
| Fever and roid                                  | não mostrado | `JellyOperation("FeverBonus"/"RoidMulti"/"SteroidTimeTOT", ...)`                 | candidata             |                                         |
| Cell damage / speed, main attack                | não mostrado | `JellyOperation("CellDMG"/"CellSPD"/"MainAtkDMG"/"MainAtkCD"/"UnitSumAtk", ...)` | candidata             |                                         |
| Viruses allowed / revives                       | não mostrado | `JellyOperation("VirusesAllowed"/"RevivesTotal", ...)`                           | candidata             |                                         |

## Luminous Menagerie (W7)

Tela no app: própria (`Luminous Menagerie`).

| Árvore                                     | Tipo         | Chamada do jogo                                                                                                     | Estado                             | Nota                                                                      |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Menagerie bonuses                          | sistema      | página `menagerie`                                                                                                  | provada (187 l., 0 ?, 1 progresso) |                                                                           |
| Boosts / unlocks / obol multi / auto-trash | sistema      | `MenagerieStuff("BoostQTY", t, 0)` (20), `("UnlockOwned", t, 0)` (21), `("ObolMISCmulti")`, `("ObolAutoTrashRate")` | provada (126 l., 0 ?)              |                                                                           |
| Nightmariner / Pink Jelly bonus            | sistema      | `MenagerieStuff("NightmarinerBon", t, 0)`, `("PinkJellyBonus", 0, 0)`                                               | provada (57 l., 0 ?, 1 progresso)  |                                                                           |
| Lumi gain rate                             | não mostrado | `MenagerieStuff("LumiGainRate", 0, 0)`                                                                              | candidata                          | taxa por hora                                                             |
| Cost / cost exponent                       | não mostrado | `MenagerieStuff("Cost"/"CostExponent", t, 0)`                                                                       | candidata                          | 3 fórmulas                                                                |
| Mission progress                           | não mostrado | `MenagerieStuff("MissionProg", t, 0)`                                                                               | candidata                          |                                                                           |
| Doublers left (Minehead, Sushi, Jelly)     | não mostrado | `MenagerieStuff("MineheadDoublersLEFT"/"SushiDoublersLEFT"/"JellyOpDoublersLEFT", 0, 0)`                            | candidata                          |                                                                           |
| Black stars / organics / orbs              | não mostrado | `MenagerieStuff("BlackStarsOwned"/"OrganicLabelOwned"/"TotalOrbs", 0, 0)`                                           | candidata                          |                                                                           |
| Pink / silver jelly costs                  | não mostrado | `MenagerieStuff("PinkJellyCosts"/"SilverJellyCosts", ...)`                                                          | candidata                          | 10^35 / 10^30                                                             |
| Coral Kid Singularity value                | não mostrado | `MenagerieStuff("CK_TotalValue"/"CK_TimeMulti"/"CK_KillMulti"/"CK_BaseValue", ...)`                                 | candidata                          | teto 1E9; curva linear até 120 e raiz depois; fora das páginas (produção) |
| Clicker cheapeners                         | alimenta     | `MenagerieStuff("ClickerCheapenerAoE"/"OrionCheapener"/"PoppyCheapener"/"BubbaCheapener", ...)`                     | candidata                          |                                                                           |
| Summoning cost reduction                   | alimenta     | `MenagerieStuff("SumCostReduxMena", 0, 0)`                                                                          | candidata                          |                                                                           |
| Omega arc ball / omni jade                 | não mostrado | `MenagerieStuff("OmegaArcBallChance"/"OmniJadeLeft"/"OmniJadeDailyLVs", ...)`                                       | candidata                          |                                                                           |
| Construction build requirement / bonuses   | não mostrado | `MenagerieStuff("ConstBuildREQ"/"ConstBuildBONUSES", ...)`                                                          | candidata                          |                                                                           |

## Coral Reef e Dancing Coral (W7)

Tela no app: própria (`Coral Reef`, `Dancing Coral`).

| Árvore                | Tipo         | Chamada do jogo                                | Estado               | Nota                                             |
| --------------------- | ------------ | ---------------------------------------------- | -------------------- | ------------------------------------------------ |
| Dancing coral bonuses | sistema      | `Thingies("DancingCoralBonus", 0..6, 0)`       | provada (44 l., 0 ?) | escala com a torre acima do nível 200            |
| Dancing coral cost    | não mostrado | `Thingies("DancingCoralCOST", t, 0)`           | candidata            |                                                  |
| Reef cost             | não mostrado | `Thingies("ReefCost", t, 0)`                   | candidata            | razão^nível                                      |
| Coral per day         | não mostrado | `Thingies("ReefDayGains", 0, 0)`               | candidata            | taxa por dia com as fontes                       |
| Grind time per day    | não mostrado | `Thingies("GrindTimeDaily", 0, 0)`             | candidata            |                                                  |
| Reef upgrade bonuses  | sistema      | — (`Spelunk[13][t]` lido cru por quem consome) | sem bloco            | não há modo de bônus: cada consumidor lê o nível |

## Coral Kid (W7)

Tela no app: própria (`Coral Kid`).

| Árvore                    | Tipo         | Chamada do jogo                          | Estado                          | Nota                        |
| ------------------------- | ------------ | ---------------------------------------- | ------------------------------- | --------------------------- |
| Coral Kid upgrade bonuses | sistema      | `Thingies("CoralKidUpgBonus", 0..11, 0)` | provada (25 l., 0 ?)            | página `coral-kid-upgrades` |
| Coral Kid upgrade cost    | não mostrado | `Thingies("CoralKidUpgCost", t, 0)`      | candidata                       |                             |
| Coral Kid → Divinity      | alimenta     | `CoralKidUpgBonus` em `Divinity`         | provada (na página da Divinity) |                             |

## Reliquarium (W7)

Tela no app: nenhuma.

| Árvore            | Tipo    | Chamada do jogo                            | Estado              | Nota            |
| ----------------- | ------- | ------------------------------------------ | ------------------- | --------------- |
| Reliquarium owned | sistema | `Thingies("ReliquariumInPosession", 0, 0)` | provada (4 l., 0 ?) | trivial (posse) |

---

## Totais por estado

Contagem das linhas das tabelas acima (uma linha pode juntar vários sub-casos irmãos).

| Estado               | Linhas  |
| -------------------- | ------- |
| provada              | 100     |
| gravada sem conta    | 7       |
| candidata            | 157     |
| precisa do jogo vivo | 8       |
| sem bloco            | 8       |
| **total**            | **280** |

## Os 5 achados mais importantes

1. **Quase todo "não mostrado" desta frente é candidata pronta.** Custo do próximo nível (Summoning, Grimoire, Compass, Tesseract, Spelunk shop, Sushi, Jelly, Minehead, Zenith, Orblet, Coral Kid, Reef, Big Fish, Clam, Jade Emporium, Market), teto (OG 1e9, Land Rank 5ª coluna, Grid, Shop, Legend talent, Emperor), chance (OG, evolução, sticker, drop do Tempest, medalhão, Prisma, promoção do Clam, Jackpot, Perfect) e taxa por hora (essência, Lumi, Sushi, coral por dia). Todos são sub-casos do N.js que só leem o estado. Nenhum foi gravado.
2. **As árvores de stat das formas de classe estão escritas e nunca foram montadas.** `systems-b9.cjs` tem as receitas "compass-stats", "tesseract-stats" e "grimoire-stats" (DEF, Mastery, Crit Damage, Range, qualidade de drop, multiplicador de ossos), e as páginas não as trazem. É o ganho mais barato da frente. O `AllMasterclassDropz`, comum às 4 classes, também está fora.
3. **Quatro páginas "provadas" não abrem a conta**: Legend Talents, Zenith Market, The Button e Jade Emporium (ⓘ 0/0, um membro por linha), e os troféus e nametags da Gallery e os chapéus do Hat Rack (caches sem BUILDER). A Correção A já resolve o `floor/round(a×b)` de Legend e Zenith, mas as páginas não foram remontadas com ela.
4. **Os "?" do Sneaking têm cura conhecida.** Detection, Stealth, coin e xp somam 38 "?", e boa parte é o mapa de trabalho `NJbonusMap0/1` que o sub-caso `Ninja("NinjaBonus", t, i)` monta. Gravá-lo, ou ligá-lo como BUILDER, dá nome a esses "?". Já o Beans per trade tem 73 "?" que são só quantidades de crop sem nome (regra de nome, não de conta).
5. **O limite real é o jogo vivo, e é pequeno.** Só 8 linhas precisam da tela aberta ou do servidor: a rocha do Spelunking (`_GenINFO[70]`/`[107]`), o mapa do Tesseract (kills e tempo), o tabuleiro do Minehead e as variáveis de servidor `A_MineCost`/`A_MineHP` no custo e no HP do Minehead. Os 8 "sem bloco" são handlers (chance de quebrar a rocha, tentativa extra do Emperor, Beanstalk), os motores de luta e o otimizador da Gallery. A Meritocracy dá um what-if limpo: rodar `MeritocBonusz(t)` com a opção trocada mostra o que cada opção daria.

---
