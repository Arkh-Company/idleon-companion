# Peças a revisar no catálogo

## A. Impacto provado, muda só com ação do jogador (11 peças, 12848 bytes)

| Peça | Bytes | Natureza | Números | Muda em | Mecânica |
| --- | ---: | --- | --- | --- | --- |
| `CurrentMap` | 1 | dado de origem | dropRate, damageMax, damageMin | buff, trocar mapa | Mapa |
| `DNSM.AlchBubbles` | 3675 | cache derivado | todos | buff | Alquimia |
| `DNSM.AlchVials` | 1696 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | buff | Alquimia |
| `DNSM.LabMFbonuses` | 507 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | buff | Laboratório |
| `DNSM.PrayNonEq` | 1 | cache derivado | damageMax, damageMin, accuracy, dropRate, afkGains | buff | Prayers (a conferir) |
| `DNSM.TotalStatsETCmap` | 1658 | cache derivado | todos | tirar item, colocar item, talento | Status do personagem |
| `EquipmentOrder` | 636 | dado de origem | todos | tirar item, colocar item | Itens e equipamento |
| `EquipmentQuantity` | 139 | dado de origem | todos | tirar item, colocar item | Itens e equipamento |
| `ObolEquippedMap` | 3813 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | trocar obol | Obols |
| `ObolEquippedOrder` | 688 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | trocar obol | Obols |
| `PrayersActive` | 34 | dado de origem | dropRate, afkGains | buff | Prayers |

## B. Impacto provado, muda também com o personagem parado (25 peças, 76591 bytes)

| Peça | Bytes | Natureza | Números | Muda em | Mecânica |
| --- | ---: | --- | --- | --- | --- |
| `Bubba` | 364 | dado de origem | damageMax, damageMin | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | AFK (a conferir) |
| `BuffsActive` | 17 | dado de origem | damageMax, damageMin, hp, str | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Buffs |
| `Cards` | 32654 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, matar | Cards |
| `CauldronP2W` | 568 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Alquimia |
| `DNSM.SailzArtiBonusL` | 247 | cache derivado | todos | buff, trocar mapa, parado | Sailing (a conferir) |
| `DNSM.StampBonuses_Map_Of_Val` | 1375 | cache derivado | todos | buff, trocar mapa, matar, parado | Stamps |
| `Dream` | 74 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | AFK (a conferir) |
| `Gaming` | 234 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Gaming |
| `GuildTasks` | 156 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, matar | Guilda |
| `Holes` | 6439 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Holes |
| `KillsLeft2Advance` | 3419 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | tirar item, colocar item, trocar obol, talento, parado, matar | Combate |
| `Menagerie` | 597 | dado de origem | damageMax, damageMin, dropRate | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Sneaking (a conferir) |
| `Ninja` | 2948 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Sneaking |
| `OptionsListAccount` | 4613 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Status do personagem |
| `Personagem.SkillLevels` | 1557 | dado de origem | luk, dropRate | talento, parado | Combate |
| `PlayerStuff` | 37 | dado de origem | damageMax, damageMin, hp, str | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Itens e equipamento (a conferir) |
| `Refinery` | 616 | dado de origem | damageMax, damageMin | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Refinaria |
| `Research` | 5921 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Skills de coleta (a conferir) |
| `RoyalG` | 2213 | dado de origem | damageMax, damageMin, dropRate | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Obols (a conferir) |
| `SkillLevels` | 1557 | dado de origem | todos | talento, parado | Combate |
| `Spelunk` | 7380 | dado de origem | todos | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Holes (a conferir) |
| `Summon` | 1462 | dado de origem | damageMax, damageMin | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Summoning |
| `Tasks` | 1145 | dado de origem | todos | tirar item, parado, buff, matar | Tarefas e conquistas |
| `TimeAway` | 450 | dado de origem | damageMax, damageMin, dropRate | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | AFK |
| `TowerInfo` | 548 | dado de origem | damageMax, damageMin | tirar item, colocar item, trocar obol, talento, parado, buff, trocar mapa, matar | Construção |

## C. Impacto provado, não mudou nas ações do roteiro (65 peças, 79412 bytes)

| Peça | Bytes | Natureza | Números | Muda em | Mecânica |
| --- | ---: | --- | --- | --- | --- |
| `AchieveReg` | 1113 | dado de origem | todos | não mudou | Tarefas e conquistas |
| `ArcadeUpg` | 302 | dado de origem | todos | não mudou | Arcade |
| `Arcane` | 288 | dado de origem | todos | não mudou | Star Signs (a conferir) |
| `Atoms` | 58 | dado de origem | damageMax, damageMin | não mudou | Átomos |
| `BribeStatus` | 83 | dado de origem | todos | não mudou | Status do personagem |
| `BundlesReceived` | 783 | dado de origem | todos | não mudou | Summoning (a conferir) |
| `CharacterClass` | 2 | dado de origem | damageMax, damageMin, accuracy | não mudou | Itens e equipamento (a conferir) |
| `Compass` | 2579 | dado de origem | damageMax, damageMin, afkGains | não mudou | Stamps (a conferir) |
| `Divinity` | 143 | dado de origem | damageMax, damageMin | matar | Divinity |
| `DNSM.CapeVineBonTOT` | 602 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Status do personagem (a conferir) |
| `DNSM.ChipBbonusz` | 122 | cache derivado | todos | não mudou | Laboratório |
| `DNSM.CompanionBon` | 805 | cache derivado | todos | não mudou | Pets e companheiros |
| `DNSM.EclipseSk` | 2 | cache derivado | damageMax, damageMin | não mudou | a conferir |
| `DNSM.EmperorBon` | 42 | cache derivado | todos | não mudou | a conferir |
| `DNSM.ExoticFarmBon` | 1108 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Farming |
| `DNSM.FamBonusQTYs` | 1072 | cache derivado | todos | não mudou | Status do personagem (a conferir) |
| `DNSM.FlurboStats` | 103 | cache derivado | damageMax, damageMin, accuracy, afkGains | não mudou | Status do personagem |
| `DNSM.FountBonT` | 302 | cache derivado | damageMax, damageMin, dropRate | não mudou | Holes (a conferir) |
| `DNSM.FrendBonzStatz` | 159 | cache derivado | damageMax, damageMin, dropRate | não mudou | Status do personagem |
| `DNSM.GalleryNametagBonTOT` | 1128 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Status do personagem (a conferir) |
| `DNSM.GalleryTrophyBonTOT` | 739 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Status do personagem (a conferir) |
| `DNSM.GlimboTOT` | 4 | cache derivado | dropRate | não mudou | Skills de coleta (a conferir) |
| `DNSM.KilRoDmg` | 3 | cache derivado | damageMax, damageMin | não mudou | Combate |
| `DNSM.MealBonusesS` | 1323 | cache derivado | todos | não mudou | Comida e cozinha |
| `DNSM.OwlBonus` | 36 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Summoning (a conferir) |
| `DNSM.PaletteBonz` | 421 | cache derivado | damageMax, damageMin | não mudou | Gaming (a conferir) |
| `DNSM.PremHatBonTOT` | 710 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Status do personagem (a conferir) |
| `DNSM.RooBonus` | 51 | cache derivado | damageMax, damageMin, accuracy, afkGains | não mudou | Summoning (a conferir) |
| `DNSM.SetBonusTOTz` | 355 | cache derivado | todos | não mudou | a conferir |
| `DNSM.ShinyBonusS` | 245 | cache derivado | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Pets e companheiros |
| `DNSM.SigTotPup2` | 2 | cache derivado | damageMax, damageMin | não mudou | Laboratório (a conferir) |
| `DNSM.skillLvRanks` | 49 | cache derivado | damageMax, damageMin | não mudou | Combate |
| `DNSM.SpelunkyUpgTOT` | 324 | cache derivado | damageMax, damageMin, dropRate | não mudou | a conferir |
| `DNSM.SummWinBonus` | 111 | cache derivado | todos | não mudou | Summoning (a conferir) |
| `DNSM.TomeQTY` | 931 | cache derivado | damageMax, damageMin, luk, dropRate | não mudou | Eventos da conta |
| `DNSM.TomeQTYtot` | 5 | cache derivado | damageMax, damageMin, dropRate | não mudou | Eventos da conta |
| `DNSM.TotStickrz` | 3 | cache derivado | damageMax, damageMin | não mudou | Farming (a conferir) |
| `DNSM.UNQ_sushi` | 2 | cache derivado | damageMax, damageMin, dropRate | não mudou | a conferir |
| `DNSM.VaultKillzTOT` | 118 | cache derivado | damageMax, damageMin | não mudou | Combate |
| `EquipmentMap` | 4166 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Itens e equipamento |
| `FarmRank` | 904 | dado de origem | damageMax, damageMin, hp, mp, accuracy, str, agi, wis, luk, dropRate | não mudou | Farming |
| `FoodSlotsOwned` | 1 | dado de origem | todos | não mudou | Comida e cozinha |
| `GemItemsPurchased` | 621 | dado de origem | todos | não mudou | Itens e equipamento |
| `GetPlayersUsernames` | 106 | cache derivado | todos | não mudou | Obols (a conferir) |
| `Grimoire` | 296 | dado de origem | todos | não mudou | Summoning (a conferir) |
| `Lv0` | 100 | dado de origem | todos | não mudou | Skills e experiência |
| `MapBon` | 2085 | dado de origem | dropRate, afkGains | não mudou | Mapa |
| `Number2Letter` | 629 | cache derivado | todos | não mudou | Quests e NPCs (a conferir) |
| `OutrosPersonagens.CharacterClass` | 42 | dado de origem | todos | não mudou | a conferir |
| `OutrosPersonagens.KillsLeft2Advance` | 32491 | dado de origem | todos | não mudou | Combate |
| `OutrosPersonagens.Lv0` | 1025 | dado de origem | afkGains | não mudou | Skills e experiência |
| `OutrosPersonagens.SkillLevels` | 15608 | dado de origem | todos | não mudou | Combate |
| `PostOfficeInfo` | 691 | dado de origem | todos | não mudou | Tarefas e conquistas (a conferir) |
| `PrayersUnlocked` | 68 | dado de origem | afkGains | não mudou | Prayers |
| `Rift` | 23 | dado de origem | todos | não mudou | Sailing (a conferir) |
| `Sailing` | 976 | dado de origem | damageMax, damageMin | não mudou | Sailing |
| `SaltLick` | 65 | dado de origem | damageMax, damageMin | não mudou | Refinaria |
| `ShrineInfo` | 323 | dado de origem | damageMax, damageMin, hp, dropRate, afkGains | não mudou | Shrines |
| `StampLevel` | 495 | dado de origem | damageMax, damageMin | não mudou | Stamps |
| `StatueG` | 121 | dado de origem | damageMax, damageMin, hp, accuracy | não mudou | Estátuas |
| `StatueLevels` | 740 | dado de origem | damageMax, damageMin, hp, accuracy | matar, parado | Estátuas |
| `TotemInfo` | 212 | dado de origem | damageMax, damageMin | não mudou | Skills de coleta (a conferir) |
| `UpgVault` | 341 | dado de origem | todos | não mudou | Summoning (a conferir) |
| `UserInfo` | 10 | cache derivado | hp, mp, str, agi, wis, luk, dropRate | não mudou | Mapa (a conferir) |
| `WeeklyBoss` | 1045 | dado de origem | damageMax, damageMin, dropRate | não mudou | Cards (a conferir) |

